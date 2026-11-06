using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace EnglishCards;

internal static class PrototypeVerification
{
    [DllImport("user32.dll")]
    private static extern nint MonitorFromWindow(nint window, uint flags);

    private const string PreviewState = """
        (() => {
            const scroll = document.querySelector('.preview-scroll');
            return {
                scrollLeft: scroll.scrollLeft, scrollTop: scroll.scrollTop,
                previewFocused: document.activeElement === scroll,
                documentFocused: document.hasFocus(), devicePixelRatio: window.devicePixelRatio
            };
        })()
        """;

    internal static async Task RunAsync(Window editorWindow, WebView2 editor, LocalWebContent content,
        string output, int expectedDpi, CancellationToken ct)
    {
        int dpi = (int)Math.Round(VisualTreeHelper.GetDpi(editor).PixelsPerInchX);
        if (expectedDpi != 0 && dpi != expectedDpi)
            throw new InvalidOperationException($"Expected system DPI {expectedDpi}, measured {dpi}.");

        var editorWeb = editor.CoreWebView2;
        var initial = await WaitForPreviewAsync(editorWeb, "true", ct);
        var initialSignature = initial.GetProperty("signature").GetString();
        var view = new WebView2 { Focusable = false, IsHitTestVisible = false };
        var captureWindow = new Window
        {
            Content = view, Width = 800, Height = 600, WindowStyle = WindowStyle.None,
            ShowActivated = false, ShowInTaskbar = false, ResizeMode = ResizeMode.NoResize,
            Left = SystemParameters.VirtualScreenLeft + SystemParameters.VirtualScreenWidth + 32,
            Top = SystemParameters.VirtualScreenTop
        };
        editor.Focus();
        await LocalWebContent.EvaluateAsync(editorWeb, "document.querySelector('.preview-scroll').focus({preventScroll:true})", ct);
        var focusBefore = await ReadFocusedPreviewAsync(editorWindow, editorWeb, "Before starting the export renderer", ct);
        captureWindow.Show();
        try
        {
            if (MonitorFromWindow(new WindowInteropHelper(captureWindow).Handle, 0) != 0)
                throw new InvalidOperationException("The export window intersects a monitor.");
            await content.LoadAsync(view, "render.html", ct);
            var web = view.CoreWebView2;
            view.ZoomFactor = 1;
            var nativeCaptureMetrics = await LocalWebContent.EvaluateAsync(web, "[innerWidth, innerHeight, devicePixelRatio]", ct);
            // A hidden HWND stops presenting frames. Leave the export controller visible off-screen.
            await web.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride",
                """{"width":0,"height":0,"deviceScaleFactor":1,"mobile":false}""").WaitAsync(ct);
            var focusAfter = await ReadFocusedPreviewAsync(editorWindow, editorWeb, "After starting the export renderer", ct);
            if (!JsonElement.DeepEquals(focusBefore, focusAfter))
                throw new InvalidOperationException($"Starting the export renderer changed editor state. Before {focusBefore}; after {focusAfter}.");
            var capture = new CardCapture(web);
            var cases = new List<object>();
            cases.Add(await VerifyCaseAsync("default", initial, 4, 1200, 1600, editorWindow, editorWeb, web, capture, output, ct));

            await LocalWebContent.EvaluateAsync(editorWeb, """
                (() => {
                    const { styles, ...project } = window.editor.project;
                    project.title = 'Desktop prototype long article';
                    project.source.paragraphs = Array.from({ length: 8 }, (_, index) => ({
                        id: 'prototype-long-' + index, text: 'Filler sentence. '.repeat(70)
                    }));
                    const files = new DataTransfer();
                    files.items.add(new File([JSON.stringify(project)], 'long.json', {type: 'application/json'}));
                    const input = document.querySelector('input[type=file][accept*=".json"]');
                    input.files = files.files;
                    input.dispatchEvent(new Event('change', {bubbles: true}));
                })()
                """, ct);
            var longArticle = await WaitForPreviewAsync(editorWeb,
                $"window.editor.signature !== {JsonSerializer.Serialize(initialSignature)} && window.editor.project.title === 'Desktop prototype long article'", ct);
            int longPages = longArticle.GetProperty("diagnostics").GetProperty("pages").GetInt32();
            if (longPages <= 4)
                throw new InvalidOperationException($"Long article only generated {longPages} pages.");
            cases.Add(await VerifyCaseAsync("long", longArticle, longPages, 1200, 1600, editorWindow, editorWeb, web, capture, output, ct));

            await LocalWebContent.EvaluateAsync(editorWeb,
                "Array.from(document.querySelectorAll('nav button')).find(button => button.textContent === '\\u6837\\u5f0f').click()", ct);
            await LocalWebContent.EvaluateAsync(editorWeb, """
                (() => {
                    for (const key of ['pageWidth', 'pageHeight']) {
                        const input = document.getElementById('setting-' + key);
                        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '4000');
                        input.dispatchEvent(new Event('input', {bubbles: true}));
                    }
                })()
                """, ct);
            var max = await WaitForPreviewAsync(editorWeb,
                "window.editor.project.styles.pageWidth === 4000 && window.editor.project.styles.pageHeight === 4000", ct);
            int maxPages = max.GetProperty("diagnostics").GetProperty("pages").GetInt32();
            cases.Add(await VerifyCaseAsync("maximum", max, maxPages, 4000, 4000, editorWindow, editorWeb, web, capture, output, ct));

            var report = new
            {
                runtime = content.RuntimeVersion, systemDpi = dpi, nativeCaptureMetrics,
                captureWindowOffscreen = true, editorActiveAtStart = true, cases
            };
            await WriteJsonAsync(Path.Combine(output, "verification.json"), report, ct);
        }
        finally
        {
            view.Dispose();
            captureWindow.Close();
        }
    }

    private static async Task<JsonElement> ReadFocusedPreviewAsync(Window window, CoreWebView2 editor,
        string stage, CancellationToken ct)
    {
        var state = await LocalWebContent.EvaluateAsync(editor, PreviewState, ct);
        bool active = window.IsActive;
        if (!active || !state.GetProperty("documentFocused").GetBoolean() || !state.GetProperty("previewFocused").GetBoolean())
            throw new InvalidOperationException(
                $"{stage}: the editor window and WebView2 preview must have real focus. " +
                $"Window active: {active}; preview state: {state}. Run verification on an interactive Windows desktop in the foreground.");
        return state;
    }

    private static async Task<JsonElement> WaitForPreviewAsync(CoreWebView2 editor, string condition, CancellationToken ct)
    {
        for (int attempt = 0; attempt < 200; attempt++)
        {
            var result = await LocalWebContent.EvaluateAsync(editor,
                $"document.querySelector('.preview[data-ready=true]') && window.editor && ({condition}) ? window.editor : null", ct);
            if (result.ValueKind == JsonValueKind.Object)
                return result;
            await Task.Delay(100, ct);
        }
        var status = await LocalWebContent.EvaluateAsync(editor,
            "[location.href, document.querySelector('[role=alert]')?.textContent, window.editor?.project?.styles]", ct);
        throw new InvalidOperationException($"The editor did not render the requested fixture: {condition}. State: {status}");
    }

    private static async Task<object> VerifyCaseAsync(string name, JsonElement snapshot, int pages, int width, int height,
        Window editorWindow, CoreWebView2 editor, CoreWebView2 renderer, CardCapture capture, string output, CancellationToken ct)
    {
        string directory = Path.Combine(output, name);
        Directory.CreateDirectory(directory);
        await WriteJsonAsync(Path.Combine(directory, "preview.json"), snapshot, ct);
        await LocalWebContent.EvaluateAsync(editor, "document.querySelector('.preview-scroll').scrollTop = 200", ct);
        var before = await ReadFocusedPreviewAsync(editorWindow, editor, $"{name}: before export", ct);
        if (before.GetProperty("scrollTop").GetDouble() == 0)
            throw new InvalidOperationException($"{name}: the preview must have a nonzero scroll position before export.");
        var pngHashes = new List<string>();
        int textLinesWithInk = 0;
        for (int pass = 0; pass < 2; pass++)
        {
            var project = snapshot.GetProperty("project");
            var actual = await LocalWebContent.EvaluateAsync(renderer, $$"""
                (async () => ({
                    signature: await window.renderProject({{project.GetRawText()}}),
                    diagnostics: window.renderDiagnostics
                }))()
                """, ct);
            if (!JsonElement.DeepEquals(actual.GetProperty("signature"), snapshot.GetProperty("signature")) ||
                !JsonElement.DeepEquals(actual.GetProperty("diagnostics"), snapshot.GetProperty("diagnostics")) ||
                actual.GetProperty("diagnostics").GetProperty("pages").GetInt32() != pages)
                throw new InvalidOperationException($"{name}: preview and export layouts differ.");
            if (pass == 0)
                await WriteJsonAsync(Path.Combine(directory, "export.json"), actual, ct);
            for (int index = 0; index < pages; index++)
            {
                var bytes = await capture.CapturePageAsync(index, width, height, ct);
                byte[] pixels = ReadPixels(bytes, width, height);
                string hash = Convert.ToHexString(SHA256.HashData(pixels));
                if (pass == 0)
                {
                    textLinesWithInk += await VerifyTextPixelsAsync(renderer, index, width, height, pixels, ct);
                    pngHashes.Add(hash);
                    await File.WriteAllBytesAsync(Path.Combine(directory, $"page-{index + 1:00}.png"), bytes, ct);
                }
                else if (pngHashes[index] != hash)
                    throw new InvalidOperationException($"{name}: repeated export differs at page {index + 1}.");
            }
        }
        var after = await ReadFocusedPreviewAsync(editorWindow, editor, $"{name}: after export", ct);
        if (pngHashes.Distinct().Count() != pages)
            throw new InvalidOperationException($"{name}: two different pages produced identical pixels.");
        if (!JsonElement.DeepEquals(before, after))
            throw new InvalidOperationException($"{name}: editor scroll or state changed. Before {before}; after {after}.");
        return new
        {
            name, width, height, pages, lineRecords = snapshot.GetProperty("diagnostics").GetProperty("records").GetArrayLength(),
            textLinesWithInk, sameSignatureAndDiagnostics = true, repeatPixelsIdentical = true, editorStateUnchanged = true, editorState = before, pngHashes
        };
    }

    private static async Task<int> VerifyTextPixelsAsync(CoreWebView2 renderer, int pageIndex,
        int width, int height, byte[] pixels, CancellationToken ct)
    {
        // The capture leaves this card at the origin. Text ranges exclude whitespace and
        // generated content, and clipping to each line's box excludes its divider above it.
        var lines = await LocalWebContent.EvaluateAsync(renderer, $$"""
            (() => {
                const card = document.querySelectorAll('#root > .card')[{{pageIndex}}];
                const origin = card.getBoundingClientRect();
                const range = document.createRange();
                return Array.from(card.querySelectorAll('.text-line, .eyebrow, .footer > span'))
                    .filter(line => line.textContent.trim())
                    .map(line => {
                        const bounds = line.getBoundingClientRect();
                        const rects = [];
                        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
                        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                            if (!node.data.trim()) continue;
                            range.setStart(node, node.data.length - node.data.trimStart().length);
                            range.setEnd(node, node.data.trimEnd().length);
                            for (const rect of range.getClientRects()) {
                                const left = Math.floor(Math.max(bounds.left, rect.left) - origin.left);
                                const top = Math.floor(Math.max(bounds.top, rect.top) - origin.top);
                                const right = Math.ceil(Math.min(bounds.right, rect.right) - origin.left);
                                const bottom = Math.ceil(Math.min(bounds.bottom, rect.bottom) - origin.top);
                                if (right > left && bottom > top) rects.push([left, top, right, bottom]);
                            }
                        }
                        return { source: line.dataset.source ?? line.textContent, start: line.dataset.start, rects };
                    });
            })()
            """, ct);

        if (lines.GetArrayLength() == 0)
            throw new InvalidOperationException($"Page {pageIndex + 1}: no text lines were available for PNG verification.");
        foreach (var line in lines.EnumerateArray())
        {
            int ink = 0;
            foreach (var rect in line.GetProperty("rects").EnumerateArray())
            {
                int left = rect[0].GetInt32(), top = rect[1].GetInt32();
                int right = rect[2].GetInt32(), bottom = rect[3].GetInt32();
                if (left < 0 || top < 0 || right > width || bottom > height)
                    throw new InvalidOperationException($"Page {pageIndex + 1}: text rectangle is outside the PNG: {line}.");

                for (int y = top; y < bottom && ink < 2; y++)
                for (int x = left; x < right && ink < 2; x++)
                {
                    int offset = (y * width + x) * 4;
                    // Colored type such as orange headings may only have one low RGB channel.
                    if (pixels[offset] < 180 || pixels[offset + 1] < 180 || pixels[offset + 2] < 180)
                        ink++;
                }
            }

            if (ink < 2)
                throw new InvalidOperationException($"Page {pageIndex + 1}: text line has no visible PNG ink: {line}.");
        }
        return lines.GetArrayLength();
    }

    private static byte[] ReadPixels(byte[] png, int width, int height)
    {
        using var stream = new MemoryStream(png);
        var frame = BitmapDecoder.Create(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad).Frames[0];
        if (frame.PixelWidth != width || frame.PixelHeight != height)
            throw new InvalidOperationException("Decoded PNG dimensions do not match the card.");
        var bitmap = new FormatConvertedBitmap(frame, PixelFormats.Bgra32, null, 0);
        int stride = checked(width * 4);
        var pixels = new byte[checked(stride * height)];
        bitmap.CopyPixels(pixels, stride, 0);
        foreach (int corner in new[] { 0, stride - 4, pixels.Length - stride, pixels.Length - 4 })
        {
            if (!pixels.AsSpan(corner, 4).SequenceEqual(new byte[] { 246, 248, 248, 255 }))
                throw new InvalidOperationException($"Expected opaque card background at corner byte {corner}.");
        }
        if (!HasInk(pixels.AsSpan(stride * 60, stride * (height - 130))) ||
            !HasInk(pixels.AsSpan(stride * (height - 65), stride * 55)))
            throw new InvalidOperationException("Card body or footer is blank.");
        return pixels;
    }

    private static bool HasInk(ReadOnlySpan<byte> pixels)
    {
        int dark = 0;
        for (int i = 0; i < pixels.Length; i += 4)
            if (pixels[i] < 160 && pixels[i + 1] < 160 && pixels[i + 2] < 160 && ++dark >= 16)
                return true;
        return false;
    }

    private static Task WriteJsonAsync<T>(string path, T value, CancellationToken ct) =>
        File.WriteAllTextAsync(path, JsonSerializer.Serialize(value, App.ReportFormat), ct);
}
