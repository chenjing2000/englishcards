using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;

namespace EnglishCards;

// Runs only under --verify, against the fresh output-owned userdata created by App.
internal static class ReaderVerification
{
    private const string FileName = "a1-script.json";
    private static readonly string SourceText = string.Concat(Enumerable.Repeat("Exact  source wording + punctuation. ", 160));
    private const string Translation = "第一行\n第二行\n\n另一段";

    internal static async Task PrepareAsync(string root, CancellationToken ct)
    {
        Directory.CreateDirectory(root);
        await File.WriteAllTextAsync(Path.Combine(root, FileName), JsonSerializer.Serialize(new
        {
            filetype = "script", title = "",
            paragraphs = new[] { new[] { new { text = SourceText, timed_units = new object?[] { new object?[] { "UNTRUSTED", null, null } } } } }
        }), ct);
        await File.WriteAllTextAsync(Path.Combine(root, "translation.json"), JsonSerializer.Serialize(new { filetype = "translation", text = Translation }), ct);
    }

    internal static async Task RunAsync(Window window, CoreWebView2 web, UserDataStore data, string output, int expectedDpi, CancellationToken ct)
    {
        var checks = new List<string>();
        async Task WaitAsync(string condition)
        {
            var until = DateTime.UtcNow.AddSeconds(30);
            while (await web.ExecuteScriptAsync(condition) != "true")
            {
                ct.ThrowIfCancellationRequested();
                if (DateTime.UtcNow >= until) throw new InvalidOperationException($"Reader verification timed out: {condition}");
                await Task.Delay(100, ct);
            }
        }
        void Check(bool passed, string name)
        {
            if (!passed) throw new InvalidOperationException($"Reader verification failed: {name}");
            checks.Add(name);
        }
        var sourcePath = Path.Combine(data.LibraryRootPath, FileName);
        var sourceBefore = await File.ReadAllBytesAsync(sourcePath, ct);
        await WaitAsync($"Array.from(document.querySelectorAll('.library-file')).some(b => b.textContent === '{FileName}')");
        await web.ExecuteScriptAsync($"Array.from(document.querySelectorAll('.library-file')).find(b => b.textContent === '{FileName}').click()");
        await WaitAsync("document.querySelectorAll('.preview .card').length === 1 && !document.querySelector('button[aria-label=\"下一页\"]').disabled");
        Check(await web.ExecuteScriptAsync("document.querySelector('button[aria-label=\"上一页\"]').disabled && !document.querySelector('.text-line[data-kind=\"title\"]')") == "true", "empty title and first-page boundary");
        Check(await web.ExecuteScriptAsync("!document.querySelector('input,textarea,[contenteditable=\"true\"]') && ['PNG','MP4','播放','停止'].every(name => Array.from(document.querySelectorAll('button')).some(b => b.textContent === name && b.disabled))") == "true", "read-only controls and unavailable future actions");
        // Test evidence only; production PNG export remains unavailable in A1.
        await using (var screenshot = File.Create(Path.Combine(output, "reader.png")))
            await web.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, screenshot);
        string actual = "", translation = "";
        int pages = 0;
        while (true)
        {
            Check(await web.ExecuteScriptAsync("document.querySelectorAll('.preview .card').length === 1") == "true", $"one displayed card on page {pages + 1}");
            actual += JsonSerializer.Deserialize<string>(await web.ExecuteScriptAsync("Array.from(document.querySelectorAll('.preview .text-line[data-kind=\"article\"]')).map(e => e.textContent).join('')"));
            translation += JsonSerializer.Deserialize<string>(await web.ExecuteScriptAsync("Array.from(document.querySelectorAll('.preview .text-line[data-kind=\"translation\"]')).map(e => e.textContent).join('')"));
            pages++;
            if (await web.ExecuteScriptAsync("document.querySelector('button[aria-label=\"下一页\"]').disabled") == "true") break;
            if (pages >= 30) throw new InvalidOperationException("Unexpectedly many reader pages.");
            await web.ExecuteScriptAsync("document.querySelector('button[aria-label=\"下一页\"]').click()");
            await WaitAsync($"document.querySelector('output[aria-label=\"页码\"]').textContent.startsWith('{pages + 1} / ')");
        }
        Check(pages > 1 && actual == SourceText && !actual.Contains("UNTRUSTED"), "all authoritative sentence characters across page turns");
        Check(translation == Translation, "native optional translation and exact line breaks");
        await web.ExecuteScriptAsync("document.querySelector('button[aria-label=\"上一页\"]').click()");
        await WaitAsync($"document.querySelector('output[aria-label=\"页码\"]').textContent === '{pages - 1} / {pages}'");
        checks.Add("previous-page navigation and page count");
        var sourceAfter = await File.ReadAllBytesAsync(sourcePath, ct);
        Check(sourceBefore.SequenceEqual(sourceAfter), "Script source unchanged");
        double dpi = VisualTreeHelper.GetDpi(window).PixelsPerInchX;
        Check(expectedDpi == 0 || Math.Abs(dpi - expectedDpi) < 1, "requested display DPI");
        await File.WriteAllTextAsync(Path.Combine(output, "verification.json"), JsonSerializer.Serialize(new
        {
            scope = "A1 real WPF/WebView2 reader; no PNG or media export", passed = true, checks, pages, dpi,
            webView2Runtime = web.Environment.BrowserVersionString, dotnet = Environment.Version.ToString(),
            isolatedDataRoot = data.LibraryRootPath
        }, App.ReportFormat), ct);
    }
}
