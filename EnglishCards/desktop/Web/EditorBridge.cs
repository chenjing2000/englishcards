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
                "chooseCardFolder" when payload.ValueKind == JsonValueKind.String => await ChooseCardFolderAsync(payload.GetString()!),
                "defaultCardLibrary" when payload.ValueKind == JsonValueKind.Null => data.LibraryRootPath,
                "lastNewCardFolder" when payload.ValueKind == JsonValueKind.Null => await data.LoadLastNewCardFolderAsync(),
                "lastCardLibrary" when payload.ValueKind == JsonValueKind.Null => await data.LoadLastLibraryFolderAsync(),
                "saveLastCardLibrary" when payload.ValueKind == JsonValueKind.String => await SaveLastCardLibraryAsync(payload.GetString()!),
                "createCardFile" when payload.ValueKind == JsonValueKind.Object => await CreateCardFileAsync(payload),
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

    private async Task<string?> ChooseCardFolderAsync(string requestedInitialDirectory)
    {
        string initialDirectory = await data.LoadLastNewCardFolderAsync();
        if (!string.IsNullOrWhiteSpace(requestedInitialDirectory))
        {
            try
            {
                var candidate = Path.GetFullPath(requestedInitialDirectory);
                if (Directory.Exists(candidate)) initialDirectory = candidate;
            }
            catch (Exception error) when (error is ArgumentException or IOException or NotSupportedException)
            {
                // Keep the last successfully used destination, or userdata on first use.
            }
        }
        var picker = new OpenFolderDialog
        {
            Title = "选择新卡片保存文件夹",
            InitialDirectory = initialDirectory,
            Multiselect = false
        };
        return FolderDialogPositioning.ShowDialog(picker, owner) == true ? picker.FolderName : null;
    }

    private async Task<bool> SaveLastCardLibraryAsync(string directory)
    {
        await data.SaveLastLibraryFolderAsync(directory);
        return true;
    }

    private async Task<object> CreateCardFileAsync(JsonElement payload)
    {
        if (!payload.TryGetProperty("text", out var textValue) || textValue.ValueKind != JsonValueKind.String ||
            !payload.TryGetProperty("directory", out var folderValue) || folderValue.ValueKind != JsonValueKind.String ||
            !payload.TryGetProperty("fileName", out var fileValue) || fileValue.ValueKind != JsonValueKind.String)
            throw new InvalidDataException("无效的新建卡片请求。");

        var folder = Path.GetFullPath(folderValue.GetString()!);
        if (!Directory.Exists(folder)) throw new DirectoryNotFoundException("卡片馆目录不存在。");
        var text = textValue.GetString()!;
        using (var parsed = JsonDocument.Parse(text))
            ArticleContractValidator.Validate(parsed.RootElement);

        var fileName = fileValue.GetString()!;
        if (string.IsNullOrWhiteSpace(fileName) || fileName is "." or ".." ||
            !string.Equals(Path.GetFileName(fileName), fileName, StringComparison.Ordinal) ||
            !string.Equals(Path.GetExtension(fileName), ".json", StringComparison.OrdinalIgnoreCase) ||
            fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            fileName.EndsWith(' ') || fileName.EndsWith('.'))
            throw new InvalidDataException("文件名无效，必须为当前目录下的 JSON 文件。");

        var destination = ValidateCardPath(Path.Combine(folder, fileName));
        if (File.Exists(destination)) throw new IOException("同名卡片已存在，请更换标题或文件名。");
        await WriteNewCardAsync(destination, text);
        bool folderPreferenceSaved = true;
        try
        {
            // Only a successfully created card may update the remembered destination.
            await data.SaveLastSuccessfulNewCardFolderAsync(folder);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            folderPreferenceSaved = false;
            Trace.TraceWarning("EnglishCards could not remember the last successful new-card folder: {0}", error);
        }
        activeCardPath = destination;
        activeFingerprint = Fingerprint(text);
        return new { path = destination, text, folderPreferenceSaved };
    }

    // Testable exclusive creation primitive shared by the new-card dialog.
    internal static async Task WriteNewCardAsync(string destination, string text)
    {
        var staged = Path.Combine(Path.GetDirectoryName(destination)!,
            $".englishcards-{Guid.NewGuid():N}.tmp");
        try
        {
            await using (var output = new FileStream(staged, FileMode.CreateNew, FileAccess.Write,
                             FileShare.None, 4096, useAsync: true))
            await using (var writer = new StreamWriter(output))
                await writer.WriteAsync(text);
            File.Move(staged, destination, overwrite: false);
        }
        finally
        {
            try { File.Delete(staged); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
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
