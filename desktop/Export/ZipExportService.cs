using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Microsoft.Win32;

namespace EnglishCards;

// Captures a single immutable editor snapshot in a separate WebView2 renderer.
// The ZIP is staged in the destination directory and is committed only after verification.
internal sealed class ZipExportService(Window owner, LocalWebContent content, UserDataStore data)
{
    private CancellationTokenSource? cancellation;
    private ProgressDialog? activeProgress;
    internal bool IsRunning => cancellation is not null;
    internal void Cancel()
    {
        if (activeProgress is not null) activeProgress.RequestCancellationFromOwner();
        else cancellation?.Cancel();
    }

    internal async Task<bool?> ExportAsync(JsonElement request)
    {
        if (IsRunning) throw new InvalidOperationException("已有导出任务正在运行。");
        if (request.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("project", out var project) || project.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("document", out var document) || document.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty("signature", out var signatureValue) || signatureValue.ValueKind != JsonValueKind.String ||
            !request.TryGetProperty("pages", out var pagesValue) || !pagesValue.TryGetInt32(out var pages) || pages < 1)
            throw new InvalidDataException("导出快照格式无效。");
        if (!document.TryGetProperty("schemaVersion", out var version) || version.GetInt32() != 5)
            throw new InvalidDataException("只能导出 schemaVersion 5 项目。");
        if (Encoding.UTF8.GetByteCount(project.GetRawText()) > 5 * 1024 * 1024)
            throw new InvalidDataException("项目数据超过 5 MiB 的导出请求上限。");
        string signature = signatureValue.GetString()!;
        if (signature.Length is < 10 or > 512) throw new InvalidDataException("无效的分页签名。");
        var styles = project.GetProperty("styles");
        int width = styles.GetProperty("pageWidth").GetInt32();
        int height = styles.GetProperty("pageHeight").GetInt32();
        if (width is < 400 or > 4000 || height is < 400 or > 4000)
            throw new InvalidDataException("页面尺寸超出允许范围。");

        var name = document.TryGetProperty("title", out var title) ? title.GetString() ?? "EnglishCards" : "EnglishCards";
        name = string.Concat(name.Select(c => Path.GetInvalidFileNameChars().Contains(c) || char.IsControl(c) ? '_' : c)).Trim().TrimEnd('.');
        if (name.Length > 80) name = name[..80];
        if (name.Length == 0) name = "EnglishCards";
        var selected = new SaveFileDialog
        {
            Filter = "ZIP 压缩包 (*.zip)|*.zip", DefaultExt = ".zip", AddExtension = true,
            FileName = name + ".zip", InitialDirectory = data.ExportsPath, OverwritePrompt = true
        };
        if (selected.ShowDialog(owner) != true) return null;

        using var cts = new CancellationTokenSource();
        cancellation = cts;
        var progressWindow = new ProgressDialog(owner, "正在导出全部卡片", cts.Cancel);
        activeProgress = progressWindow;
        try
        {
            progressWindow.Show();
            await GenerateAsync(selected.FileName, project.GetRawText(), document.GetRawText(), signature,
                pages, width, height, progressWindow, cts.Token);
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
            progressWindow.CloseAfterOperation();
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
            using (var zip = ZipFile.OpenRead(stage))
            {
                if (zip.Entries.Count != pages + 1)
                    throw new InvalidDataException("导出 ZIP 文件数量不完整。");
                var articleEntry = zip.GetEntry("article.json")
                    ?? throw new InvalidDataException("导出 ZIP 缺少 article.json。");
                await using (var articleStream = articleEntry.Open())
                using (var exportedArticle = await JsonDocument.ParseAsync(articleStream, cancellationToken: ct))
                {
                    if (!exportedArticle.RootElement.TryGetProperty("schemaVersion", out var exportedVersion) ||
                        exportedVersion.GetInt32() != 5)
                        throw new InvalidDataException("导出的 article.json 结构无效。");
                }
                for (int i = 0; i < pages; i++)
                {
                    var entry = zip.GetEntry($"images/page-{i + 1:D3}.png")
                        ?? throw new InvalidDataException($"缺少第 {i + 1} 页图片。");
                    if (entry.Length < 24) throw new InvalidDataException($"第 {i + 1} 页图片不完整。");
                }
            }
            ct.ThrowIfCancellationRequested();
            File.Move(stage, destination, overwrite: true);
        }
        finally
        {
            renderer.Dispose();
            renderWindow.Close();
            try { File.Delete(stage); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }
}
