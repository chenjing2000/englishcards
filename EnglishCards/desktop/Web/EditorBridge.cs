using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace EnglishCards;

internal sealed class EditorBridge(Window owner, CoreWebView2 web, UserDataStore data)
{
    private static readonly JsonSerializerOptions ResponseFormat = new(JsonSerializerDefaults.Web);
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
                "openScriptFile" when payload.ValueKind == JsonValueKind.String => await ScriptFileReader.OpenAsync(payload.GetString()!),
                "listCardDirectory" when payload.ValueKind == JsonValueKind.String => await Task.Run(() => ListCardDirectory(payload.GetString()!, data.LibraryRootPath)),
                "chooseCardLibrary" when payload.ValueKind == JsonValueKind.Null => await ChooseCardLibraryAsync(),
                "defaultCardLibrary" when payload.ValueKind == JsonValueKind.Null => data.LibraryRootPath,
                "lastCardLibrary" when payload.ValueKind == JsonValueKind.Null => await data.LoadLastLibraryFolderAsync(),
                "saveLastCardLibrary" when payload.ValueKind == JsonValueKind.String => await SaveLastCardLibraryAsync(payload.GetString()!),
                "loadSettings" when payload.ValueKind == JsonValueKind.Null => await data.LoadSettingsAsync(),
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
            if (IsCurrentEditor(page)) web.PostWebMessageAsJson(JsonSerializer.Serialize(response, ResponseFormat));
        }
        catch (InvalidOperationException) { /* The WebView was disposed before delivery. */ }
        catch (COMException) { /* The WebView process exited before delivery. */ }
    }

    private static bool IsEditor(string source) => string.Equals(source, LocalWebContent.EditorSource, StringComparison.Ordinal);

    private bool IsCurrentEditor(long page) => owner.IsLoaded && navigation == page && IsEditor(web.Source);

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

    private static object ListCardDirectory(string directory, string userDataRoot)
    {
        if (string.IsNullOrWhiteSpace(directory) || !Path.IsPathFullyQualified(directory))
            throw new InvalidDataException("无效的卡片目录。");
        var path = Path.GetFullPath(directory);
        bool internalRoot = string.Equals(Path.TrimEndingDirectorySeparator(path),
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(userDataRoot)), StringComparison.OrdinalIgnoreCase);
        var folders = Directory.EnumerateDirectories(path)
            .Where(folder => !IsHiddenDirectory(Path.GetFileName(folder), internalRoot))
            .Select(folder => new { path = folder, name = Path.GetFileName(folder) })
            .OrderBy(item => item.name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.name, StringComparer.Ordinal).ToArray();
        var files = Directory.EnumerateFiles(path)
            .Where(file => string.Equals(Path.GetExtension(file), ".json", StringComparison.OrdinalIgnoreCase) && IsScript(file))
            .Select(file => new { path = file, name = Path.GetFileName(file) })
            .OrderBy(item => item.name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.name, StringComparer.Ordinal).ToArray();
        return new { path, folders, files };
    }

    private static bool IsHiddenDirectory(string name, bool internalRoot) =>
        name.Equals("cache", StringComparison.OrdinalIgnoreCase) || name.Equals("export", StringComparison.OrdinalIgnoreCase) ||
        (internalRoot && new[] { "settings", "logs", "exports", "temp", "drafts" }.Contains(name, StringComparer.OrdinalIgnoreCase));

    private static bool IsScript(string file)
    {
        try
        {
            using var stream = File.OpenRead(file);
            using var json = JsonDocument.Parse(stream);
            return json.RootElement.ValueKind == JsonValueKind.Object &&
                json.RootElement.TryGetProperty("filetype", out var type) && type.ValueKind == JsonValueKind.String && type.GetString() == "script";
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException) { return false; }
    }
}
