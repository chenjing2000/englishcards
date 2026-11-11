using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace EnglishCards;

internal sealed class EditorBridge(Window owner, CoreWebView2 web, UserDataStore data, ZipExportService exporter)
{
    private const string OpenArticleFilter = "EnglishCards 文章 (*.json;*.txt)|*.json;*.txt|Article JSON (*.json)|*.json|Plain Text (*.txt)|*.txt";
    private const string SaveArticleFilter = "Article JSON (*.json)|*.json";
    private string? activeCardPath;
    private string? activeFingerprint;
    private long navigation;
    private Task fileCommandTail = Task.CompletedTask;

    internal void Attach()
    {
        web.NavigationStarting += (_, args) => { if (!args.Cancel) navigation++; };
        web.WebMessageReceived += Receive;
    }

    private async void Receive(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (!IsEditor(args.Source) || !IsEditor(web.Source)) return;
        long page = navigation;
        try
        {
            string message = args.WebMessageAsJson;
            await RunFileCommandAsync(() => HandleFileCommandAsync(page, message));
        }
        catch (Exception error)
        {
            // WebView2 event handlers are async void boundaries: no exception may escape to the WPF dispatcher.
            Trace.TraceError("EnglishCards editor bridge event failed: {0}", error);
        }
    }

    private async Task RunFileCommandAsync(Func<Task> command)
    {
        // WebView2 delivers messages on the UI thread in order. Keep I/O and its reply in that order too.
        var previous = fileCommandTail;
        var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        fileCommandTail = finished.Task;
        try
        {
            await previous;
            await command();
        }
        finally { finished.SetResult(); }
    }

    private async Task HandleFileCommandAsync(long page, string message)
    {
        long id = 0;
        object response;
        try
        {
            using var document = JsonDocument.Parse(message);
            var request = document.RootElement;
            if (request.ValueKind != JsonValueKind.Object || !request.TryGetProperty("id", out var requestId) ||
                requestId.ValueKind != JsonValueKind.Number || !requestId.TryGetInt64(out id) || id <= 0) return;
            if (!request.TryGetProperty("command", out var command) || command.ValueKind != JsonValueKind.String ||
                !request.TryGetProperty("payload", out var payload))
                throw new InvalidDataException("无效的桌面文件请求。");

            // Show modal UI only after WebView2 has returned from the message callback.
            await Dispatcher.Yield(DispatcherPriority.Normal);
            if (!IsCurrentEditor(page)) return;
            object? value = command.GetString() switch
            {
                "openProject" when payload.ValueKind == JsonValueKind.Null => await OpenProjectAsync(),
                "openCardFile" when payload.ValueKind == JsonValueKind.String => await OpenCardFileAsync(payload.GetString()!),
                "activateCardFile" when payload.ValueKind == JsonValueKind.Object => await ActivateCardFileAsync(payload),
                "saveCardFile" when payload.ValueKind == JsonValueKind.Object => await SaveCardFileAsync(payload),
                "listCardDirectory" when payload.ValueKind == JsonValueKind.String => ListCardDirectory(payload.GetString()!),
                "chooseCardLibrary" when payload.ValueKind == JsonValueKind.Null => await ChooseCardLibraryAsync(),
                "defaultCardLibrary" when payload.ValueKind == JsonValueKind.Null => data.LibraryRootPath,
                "lastCardLibrary" when payload.ValueKind == JsonValueKind.Null => await data.LoadLastLibraryFolderAsync(),
                "saveLastCardLibrary" when payload.ValueKind == JsonValueKind.String => await SaveLastCardLibraryAsync(payload.GetString()!),
                "chooseArticlePairTarget" when payload.ValueKind == JsonValueKind.String => await ChooseArticlePairTargetAsync(payload.GetString()!),
                "saveArticlePair" when payload.ValueKind == JsonValueKind.Object => await SaveArticlePairAsync(payload),
                "saveProject" when payload.ValueKind == JsonValueKind.String => await SaveProjectAsync(payload.GetString()!),
                "loadSettings" when payload.ValueKind == JsonValueKind.Null => await data.LoadSettingsAsync(),
                "loadDraft" when payload.ValueKind == JsonValueKind.Null => await data.LoadDraftAsync(),
                "saveSettings" => await SaveUserDataAsync(payload, data.SaveSettingsAsync),
                "saveDraft" => await SaveUserDataAsync(payload, data.SaveDraftAsync),
                "saveRejectedDraft" when payload.ValueKind == JsonValueKind.Null => await SaveRejectedDraftAsync(),
                "exportAllZip" when payload.ValueKind == JsonValueKind.Object => await exporter.ExportAsync(payload, activeCardPath ?? throw new InvalidOperationException("请先打开并保存一张 JSON 卡片。")),
                _ => throw new InvalidDataException("不支持的桌面文件请求。")
            };
            response = new { id, ok = true, value };
        }
        catch (Exception error) when (error is JsonException or IOException or UnauthorizedAccessException or
                                      ArgumentException or InvalidOperationException or InvalidDataException or NotSupportedException or COMException)
        {
            if (id <= 0) return;
            response = new { id, ok = false, error = error.Message };
        }
        catch (Exception error)
        {
            Trace.TraceError("EnglishCards editor command failed: {0}", error);
            if (id <= 0) return;
            response = new { id, ok = false, error = "操作失败，请重试。" };
        }

        try
        {
            if (IsCurrentEditor(page)) web.PostWebMessageAsJson(JsonSerializer.Serialize(response));
        }
        catch (InvalidOperationException) { /* The WebView was disposed before delivery. */ }
        catch (COMException) { /* The WebView process exited before delivery. */ }
    }

    private static bool IsEditor(string source) => string.Equals(source, LocalWebContent.EditorSource, StringComparison.Ordinal);

    private bool IsCurrentEditor(long page) => owner.IsLoaded && navigation == page && IsEditor(web.Source);

    private string? ChooseFile(FileDialog dialog) => dialog.ShowDialog(owner) == true ? dialog.FileName : null;

    private async Task<object?> OpenProjectAsync()
    {
        var path = ChooseFile(new OpenFileDialog { Filter = OpenArticleFilter, CheckFileExists = true, InitialDirectory = data.ProjectsPath });
        if (path is null) return null;
        return new { name = Path.GetFileName(path), text = await File.ReadAllTextAsync(path) };
    }

    // Phase E: a file-backed card has an explicit identity; no save dialog or draft fallback.
    private static string ValidateCardPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path) ||
            !string.Equals(Path.GetExtension(path), ".json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("请选择有效的 JSON 卡片文件。");
        return Path.GetFullPath(path);
    }

    private static string Fingerprint(string text) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));

    private async Task<object> OpenCardFileAsync(string requestedPath)
    {
        var path = ValidateCardPath(requestedPath);
        var text = await File.ReadAllTextAsync(path);
        using var parsed = JsonDocument.Parse(text);
        ArticleContractValidator.Validate(parsed.RootElement);
        // Identity remains unchanged until frontend validation also succeeds.
        return new { path, text, fingerprint = Fingerprint(text) };
    }

    private async Task<bool> ActivateCardFileAsync(JsonElement payload)
    {
        if (!payload.TryGetProperty("path", out var pathValue) || pathValue.ValueKind != JsonValueKind.String ||
            !payload.TryGetProperty("fingerprint", out var fingerprintValue) ||
            fingerprintValue.ValueKind != JsonValueKind.String)
            throw new InvalidDataException("无效的卡片激活请求。");
        var path = ValidateCardPath(pathValue.GetString()!);
        var expected = fingerprintValue.GetString()!;
        var current = await File.ReadAllTextAsync(path);
        if (!string.Equals(Fingerprint(current), expected, StringComparison.Ordinal))
            throw new IOException("卡片文件在读取过程中发生外部修改，请重新选择。");
        activeCardPath = path;
        activeFingerprint = expected;
        return true;
    }

    private async Task<bool> SaveCardFileAsync(JsonElement payload)
    {
        if (!payload.TryGetProperty("path", out var pathValue) || pathValue.ValueKind != JsonValueKind.String ||
            !payload.TryGetProperty("text", out var textValue) || textValue.ValueKind != JsonValueKind.String)
            throw new InvalidDataException("无效的卡片保存请求。");
        var path = ValidateCardPath(pathValue.GetString()!);
        if (activeCardPath is null || !string.Equals(activeCardPath, path, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("当前卡片文件身份不匹配，已拒绝保存。");
        var text = textValue.GetString()!;
        using var parsed = JsonDocument.Parse(text);
        ArticleContractValidator.Validate(parsed.RootElement);
        if (!File.Exists(path)) throw new FileNotFoundException("卡片文件已被删除，已拒绝自动重新创建。", path);
        var onDisk = await File.ReadAllTextAsync(path);
        if (activeFingerprint is null || !string.Equals(Fingerprint(onDisk), activeFingerprint, StringComparison.Ordinal))
            throw new IOException("卡片文件已被其他程序修改，自动保存已停止，请先处理文件冲突。");
        await UserDataStore.WriteAtomicallyAsync(path, text);
        activeFingerprint = Fingerprint(text);
        return true;
    }

    private async Task<string?> ChooseCardLibraryAsync()
    {
        var picker = new OpenFolderDialog
        {
            Title = "选择卡片馆目录",
            InitialDirectory = await data.LoadLastLibraryFolderAsync(),
            Multiselect = false
        };
        return FolderDialogPositioning.ShowDialog(picker, owner) == true ? picker.FolderName : null;
    }

    private async Task<bool> SaveLastCardLibraryAsync(string directory)
    {
        await data.SaveLastLibraryFolderAsync(directory);
        return true;
    }

    private static void ValidatePairFileName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name is "." or ".." ||
            !string.Equals(Path.GetFileName(name), name, StringComparison.Ordinal) ||
            !string.Equals(Path.GetExtension(name), ".json", StringComparison.OrdinalIgnoreCase) ||
            name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            name.EndsWith(' ') || name.EndsWith('.'))
            throw new InvalidDataException("保存文件名无效。");
    }

    private async Task<object?> ChooseArticlePairTargetAsync(string name)
    {
        if (exporter.IsRunning) throw new InvalidOperationException("请等待当前保存任务完成。");
        ValidatePairFileName(name);
        var picker = new OpenFolderDialog
        {
            Title = "选择文章 JSON 和 ZIP 的保存文件夹",
            InitialDirectory = await data.LoadLastLibraryFolderAsync(),
            Multiselect = false
        };
        if (FolderDialogPositioning.ShowDialog(picker, owner) != true) return null;
        var folder = Path.GetFullPath(picker.FolderName);
        var path = ValidateCardPath(Path.Combine(folder, name));
        var zip = Path.ChangeExtension(path, ".zip");
        var existingFiles = new[] { path, zip }.Where(File.Exists).ToArray();
        return new { path, folder, existingFiles };
    }

    private async Task<object?> SaveArticlePairAsync(JsonElement payload)
    {
        if (exporter.IsRunning) throw new InvalidOperationException("请等待当前保存任务完成。");
        if (!payload.TryGetProperty("fileName", out var nameValue) ||
            nameValue.ValueKind != JsonValueKind.String ||
            !payload.TryGetProperty("document", out var document) ||
            document.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty("path", out var pathValue) ||
            pathValue.ValueKind != JsonValueKind.String ||
            !payload.TryGetProperty("overwriteApproved", out var approvedValue) ||
            approvedValue.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            throw new InvalidDataException("保存请求缺少文章、目标路径或覆盖确认状态。");
        ArticleContractValidator.Validate(document);
        var title = document.GetProperty("title").GetString();
        if (string.IsNullOrWhiteSpace(title))
            throw new InvalidDataException("请先填写英文标题，再保存 JSON 和 ZIP。");

        var name = nameValue.GetString()!;
        ValidatePairFileName(name);
        var path = ValidateCardPath(pathValue.GetString()!);
        if (!string.Equals(Path.GetFileName(path), name, StringComparison.Ordinal))
            throw new InvalidDataException("保存目标文件名与文章标题不一致。");
        var folder = Path.GetDirectoryName(path)!;
        var zip = Path.ChangeExtension(path, ".zip");
        var overwriting = File.Exists(path) || File.Exists(zip);
        if (overwriting && !approvedValue.GetBoolean())
            throw new IOException("目标文件已发生变化，请重新确认覆盖后再保存。");

        var saved = await exporter.SavePairAsync(payload, path, approvedValue.GetBoolean());
        if (saved != true) return null;

        var jsonText = await File.ReadAllTextAsync(path);
        activeCardPath = path;
        activeFingerprint = Fingerprint(jsonText);
        bool remembered = true;
        try { await data.SaveLastLibraryFolderAsync(folder); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException)
        {
            remembered = false;
            Trace.TraceWarning("Article files saved, but the library path was not remembered: {0}", error);
        }
        return new { path, text = jsonText, folder, folderPreferenceSaved = remembered };
    }

    private static object ListCardDirectory(string directory)
    {
        if (string.IsNullOrWhiteSpace(directory) || !Path.IsPathFullyQualified(directory))
            throw new InvalidDataException("无效的卡片目录。");
        var path = Path.GetFullPath(directory);
        var folders = Directory.EnumerateDirectories(path)
            .Select(folder => new { path = folder, name = Path.GetFileName(folder) })
            .OrderBy(item => item.name, StringComparer.OrdinalIgnoreCase).ToArray();
        var files = Directory.EnumerateFiles(path, "*.json")
            .Where(file => string.Equals(Path.GetExtension(file), ".json", StringComparison.OrdinalIgnoreCase))
            .Select(file => new { path = file, name = Path.GetFileName(file) })
            .OrderBy(item => item.name, StringComparer.OrdinalIgnoreCase).ToArray();
        return new { path, folders, files };
    }

    private async Task<bool?> SaveProjectAsync(string text)
    {
        // The editor validates the full schema with parseProject before sending the snapshot.
        using var document = JsonDocument.Parse(text);
        var project = document.RootElement;
        ArticleContractValidator.Validate(project);

        var path = ChooseFile(new SaveFileDialog
        {
            Filter = SaveArticleFilter, DefaultExt = ".json", FileName = "article.json", OverwritePrompt = true, InitialDirectory = data.ProjectsPath
        });
        if (path is null) return null;
        await UserDataStore.WriteAtomicallyAsync(path, text);
        return true;
    }

    private static Task<bool> SaveUserDataAsync(JsonElement payload, Func<string, bool, Task<bool>> write)
    {
        if (payload.ValueKind != JsonValueKind.Object || !payload.TryGetProperty("text", out var text) ||
            text.ValueKind != JsonValueKind.String || !payload.TryGetProperty("preserveOriginal", out var preserve) ||
            preserve.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            throw new InvalidDataException("无效的本机数据写入请求。");
        return write(text.GetString()!, preserve.GetBoolean());
    }

    private async Task<bool?> SaveRejectedDraftAsync()
    {
        data.EnsureRejectedDraftAvailable();
        var path = ChooseFile(new SaveFileDialog
        {
            Filter = SaveArticleFilter, DefaultExt = ".json", FileName = "rejected-draft.json", OverwritePrompt = true, InitialDirectory = data.ProjectsPath
        });
        if (path is null) return null;
        await data.ExportRejectedDraftAsync(path);
        return true;
    }
}
