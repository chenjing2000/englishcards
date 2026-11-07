using System.Buffers.Binary;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace EnglishCards;

internal sealed class CardCapture(CoreWebView2 web)
{
    internal async Task<byte[]> CapturePageAsync(int pageIndex, int width, int height, CancellationToken ct)
    {
        // Place one card at the origin so the clip does not depend on document scroll or page count.
        var size = await LocalWebContent.EvaluateAsync(web, $$"""
            (() => {
                const cards = Array.from(document.querySelectorAll('#root > .card'));
                const card = cards[{{pageIndex}}];
                if (!card) throw new Error('Card does not exist');
                cards.forEach(other => other.style.display = other === card ? '' : 'none');
                Object.assign(card.style, { position: 'absolute', left: '0', top: '0' });
                const { x, y, width, height } = card.getBoundingClientRect();
                return [x, y, width, height, devicePixelRatio];
            })()
            """, ct);
        if (size[0].GetDouble() != 0 || size[1].GetDouble() != 0 ||
            size[2].GetDouble() != width || size[3].GetDouble() != height || Math.Abs(size[4].GetDouble() - 1) > 0.000001)
            throw new InvalidOperationException($"Unexpected CSS bounds or device scale: {size}");

        var parameters = JsonSerializer.Serialize(new
        {
            format = "png", fromSurface = true, captureBeyondViewport = true,
            clip = new { x = 0, y = 0, width, height, scale = 1 }
        });
        using var result = JsonDocument.Parse(await web.CallDevToolsProtocolMethodAsync("Page.captureScreenshot", parameters).WaitAsync(TimeSpan.FromSeconds(20), ct));
        byte[] png = result.RootElement.GetProperty("data").GetBytesFromBase64();
        if (png.Length < 24 || !png.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ||
            BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16)) != width ||
            BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(20)) != height)
            throw new InvalidOperationException($"Screenshot was not a {width} × {height} PNG.");
        return png;
    }
}
