using System.IO;
using System.IO.Compression;
using System.Buffers.Binary;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace EnglishCards;

// Captures a single immutable editor snapshot in a separate WebView2 renderer.
// The ZIP is staged in the destination directory and is committed only after verification.
internal sealed class ZipExportService(Window owner, LocalWebContent content)
{
    private CancellationTokenSource? cancellation;
    private ProgressDialog? activeProgress;
    internal bool IsRunning => cancellation is not null;
    internal void Cancel()
    {
        if (activeProgress is not null) activeProgress.RequestCancellationFromOwner();
        else cancellation?.Cancel();
    }

    /// <summary>
    /// Render and commit a JSON + ZIP pair from the same validated Article v6
    /// snapshot. This method does not choose the folder or confirm overwrites;
    /// both decisions must happen before creating the progress window.
    /// </summary>
    internal async Task<bool?> SavePairAsync(JsonElement request, string targetJson, bool overwriteApproved)
    {
        if (IsRunning) throw new InvalidOperationException("已有保存任务正在运行。");
        if (request.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("project", out var project) || project.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("document", out var document) || document.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("signature", out var signatureValue) || signatureValue.ValueKind != JsonValueKind.String ||
            !request.TryGetProperty("pages", out var pagesValue) || !pagesValue.TryGetInt32(out var pages) || pages < 1)
            throw new InvalidDataException("保存快照格式无效。");

        // Validate the complete Article v6 document exactly once, at the save-service boundary.
        ArticleContractValidator.Validate(document);
        if (string.IsNullOrWhiteSpace(document.GetProperty("title").GetString()))
            throw new InvalidDataException("请先填写英文标题，再保存 JSON 和 ZIP。");
        if (Encoding.UTF8.GetByteCount(project.GetRawText()) > 5 * 1024 * 1024)
            throw new InvalidDataException("文章数据超过 5 MiB 的保存请求上限。");
        string signature = signatureValue.GetString()!;
        if (signature.Length is < 10 or > 512) throw new InvalidDataException("分页签名无效。");
        var styles = project.GetProperty("styles");
        int width = styles.GetProperty("pageWidth").GetInt32();
        int height = styles.GetProperty("pageHeight").GetInt32();
        if (width is < 400 or > 4000 || height is < 400 or > 4000)
            throw new InvalidDataException("页面尺寸超出允许范围。");
        var fullJson = Path.GetFullPath(targetJson);
        if (!string.Equals(Path.GetExtension(fullJson), ".json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("保存目标必须是 JSON 文件。");
        var fullZip = Path.ChangeExtension(fullJson, ".zip");
        var folder = Path.GetDirectoryName(fullJson)!;
        if (!Directory.Exists(folder)) throw new DirectoryNotFoundException("保存目标文件夹不存在。");

        var identifier = Guid.NewGuid().ToString("N");
        var stagedJson = Path.Combine(folder, $".englishcards-{identifier}.json.tmp");
        var stagedZip = Path.Combine(folder, $".englishcards-{identifier}.zip.tmp");
        using var cts = new CancellationTokenSource();
        cancellation = cts;
        var dialog = new ProgressDialog(owner, "正在保存 JSON 与 ZIP", cts.Cancel);
        activeProgress = dialog;
        try
        {
            dialog.Show();
            var formatted = ArticleJsonFormatter.FormatUtf8(document.GetRawText());
            cts.Token.ThrowIfCancellationRequested();
            dialog.SetIndeterminate("正在准备文章 JSON…", "正在生成与 ZIP 一致的 Article v6 数据。");
            await using (var stream = new FileStream(stagedJson, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                             65536, FileOptions.Asynchronous))
                await stream.WriteAsync(formatted, cts.Token);

            await GenerateAsync(stagedZip, project.GetRawText(), document.GetRawText(), signature,
                pages, width, height, dialog, cts.Token);
            cts.Token.ThrowIfCancellationRequested();
            dialog.SetIndeterminate("正在提交 JSON 和 ZIP…", "两个文件均已完成验证，正在保护并更新正式文件。");
            await PairedFileCommit.CommitAsync(stagedJson, stagedZip, fullJson, fullZip,
                overwriteApproved, cts.Token);
            return true;
        }
        catch (OperationCanceledException) when (cts.IsCancellationRequested)
        {
            return false;
        }
        finally
        {
            activeProgress = null;
            cancellation = null;
            dialog.CloseAfterOperation();
            try { File.Delete(stagedJson); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { Trace.TraceWarning("JSON staging cleanup failed: {0}", error); }
            try { File.Delete(stagedZip); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { Trace.TraceWarning("ZIP staging cleanup failed: {0}", error); }
        }
    }

    private async Task GenerateAsync(string destination, string projectJson, string documentJson,
        string signature, int pages, int width, int height, ProgressDialog progress, CancellationToken ct)
    {
        string stage = Path.Combine(Path.GetDirectoryName(destination)!, $".englishcards-{Guid.NewGuid():N}.zip.tmp");
        var renderer = new WebView2 { Focusable = false, IsHitTestVisible = false };
        var renderWindow = new Window
        {
            Content = renderer, Width = 800, Height = 600, WindowStyle = WindowStyle.None,
            ShowActivated = false, ShowInTaskbar = false, ResizeMode = ResizeMode.NoResize,
            Left = SystemParameters.VirtualScreenLeft + SystemParameters.VirtualScreenWidth + 32,
            Top = SystemParameters.VirtualScreenTop
        };
        try
        {
            renderWindow.Show();
            await content.LoadAsync(renderer, "render.html", ct);
            renderer.ZoomFactor = 1;
            var web = renderer.CoreWebView2;
            await web.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride",
                """{"width":0,"height":0,"deviceScaleFactor":1,"mobile":false}""").WaitAsync(ct);
            progress.SetIndeterminate("正在验证字体和分页…", "正在检查页面数量、字体和预览一致性。");
            var actual = await LocalWebContent.EvaluateAsync(web, $$"""
                (async () => {
                    await document.fonts.ready;
                    return { signature: await window.renderProject({{projectJson}}),
                             diagnostics: window.renderDiagnostics,
                             cards: document.querySelectorAll('#root > .card').length };
                })()
                """, ct);
            if (actual.GetProperty("signature").GetString() != signature ||
                actual.GetProperty("diagnostics").GetProperty("pages").GetInt32() != pages ||
                actual.GetProperty("cards").GetInt32() != pages)
                throw new InvalidOperationException("预览与导出分页不一致；已拒绝导出。");

            progress.SetIndeterminate("正在生成文章 JSON…", "正在按 2 空格缩进格式化文章数据。");
            var formattedDocument = ArticleJsonFormatter.FormatUtf8(documentJson);
            ct.ThrowIfCancellationRequested();
            progress.SetIndeterminate("正在打包 ZIP 文件…", "正在写入文章 JSON，并准备逐页生成 PNG。");
            await using (var file = new FileStream(stage, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                             65536, FileOptions.Asynchronous))
            {
                using (var zip = new ZipArchive(file, ZipArchiveMode.Create, leaveOpen: true, Encoding.UTF8))
                {
                    var jsonEntry = zip.CreateEntry("article.json", CompressionLevel.Optimal);
                    await using (var output = jsonEntry.Open())
                        await output.WriteAsync(formattedDocument, ct);

                    var capture = new CardCapture(web);
                    for (int i = 0; i < pages; i++)
                    {
                        ct.ThrowIfCancellationRequested();
                        progress.SetProgress($"正在生成图片（{i + 1}/{pages}）…", (double)i / pages,
                            $"正在渲染第 {i + 1} 页，并写入 ZIP 文件。");
                        var image = await capture.CapturePageAsync(i, width, height, ct);
                        var entry = zip.CreateEntry($"images/page-{i + 1:D3}.png", CompressionLevel.Optimal);
                        await using var stream = entry.Open();
                        await stream.WriteAsync(image, ct);
                        progress.SetProgress($"已生成图片（{i + 1}/{pages}）", (double)(i + 1) / pages,
                            "正在继续处理剩余页面。");
                    }
                }
                await file.FlushAsync(ct);
            }
            ct.ThrowIfCancellationRequested();
            progress.SetIndeterminate("正在验证压缩包…", "正在检查文章 JSON 和全部页面图片。");
            await ValidateArchiveAsync(stage, pages, width, height, ct);
            ct.ThrowIfCancellationRequested();
            File.Move(stage, destination, overwrite: true);
        }
        finally
        {
            // A renderer can already be disconnected when WebView2 or its browser process fails.
            // Cleanup must still attempt to close the window and remove this task's staging file.
            try { renderer.Dispose(); }
            catch (Exception error) when (error is COMException or InvalidOperationException)
            {
                Trace.TraceWarning("EnglishCards export renderer disposal failed: {0}", error);
            }

            try { renderWindow.Close(); }
            catch (Exception error) when (error is COMException or InvalidOperationException)
            {
                Trace.TraceWarning("EnglishCards export renderer window close failed: {0}", error);
            }

            try { File.Delete(stage); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                Trace.TraceWarning("EnglishCards export staging cleanup failed for {0}: {1}", stage, error);
            }
        }
    }

    internal static async Task ValidateArchiveAsync(
        string archivePath, int pages, int width, int height, CancellationToken ct)
    {
        using var zip = ZipFile.OpenRead(archivePath);
        if (zip.Entries.Count != pages + 1)
            throw new InvalidDataException("导出 ZIP 文件数量不完整。");

        var articleEntry = zip.GetEntry("article.json")
            ?? throw new InvalidDataException("导出 ZIP 缺少 article.json。");
        await using (var articleStream = articleEntry.Open())
        using (var exportedArticle = await JsonDocument.ParseAsync(articleStream, cancellationToken: ct))
        {
            ArticleContractValidator.Validate(exportedArticle.RootElement);
        }

        byte[] pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
        for (int i = 0; i < pages; i++)
        {
            ct.ThrowIfCancellationRequested();
            var entry = zip.GetEntry($"images/page-{i + 1:D3}.png")
                ?? throw new InvalidDataException($"缺少第 {i + 1} 页图片。");
            if (entry.Length < 24)
                throw new InvalidDataException($"第 {i + 1} 页图片不完整。");

            await using var imageStream = entry.Open();
            var header = new byte[24];
            try
            {
                await imageStream.ReadExactlyAsync(header, ct);
            }
            catch (EndOfStreamException error)
            {
                throw new InvalidDataException($"第 {i + 1} 页图片头部不完整。", error);
            }

            if (!header.AsSpan(0, 8).SequenceEqual(pngSignature) ||
                BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(8, 4)) != 13 ||
                Encoding.ASCII.GetString(header, 12, 4) != "IHDR" ||
                BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(16, 4)) != width ||
                BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(20, 4)) != height)
                throw new InvalidDataException($"第 {i + 1} 页图片不是预期尺寸的 PNG。");

            // Read the complete entry so ZIP decompression/data errors are detected before commit.
            await imageStream.CopyToAsync(Stream.Null, 81920, ct);
        }
    }
}
