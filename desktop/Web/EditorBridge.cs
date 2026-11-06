using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace EnglishCards;

internal sealed class EditorBridge(Window owner, CoreWebView2 web, UserDataStore data, ZipExportService exporter)
{
    private const string ProjectFilter = "EnglishCards 项目 (*.json)|*.json";
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
        string message = args.WebMessageAsJson;
        await RunFileCommandAsync(() => HandleFileCommandAsync(page, message));
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
                "saveProject" when payload.ValueKind == JsonValueKind.String => await SaveProjectAsync(payload.GetString()!),
                "loadSettings" when payload.ValueKind == JsonValueKind.Null => await data.LoadSettingsAsync(),
                "loadDraft" when payload.ValueKind == JsonValueKind.Null => await data.LoadDraftAsync(),
                "saveSettings" => await SaveUserDataAsync(payload, data.SaveSettingsAsync),
                "saveDraft" => await SaveUserDataAsync(payload, data.SaveDraftAsync),
                "saveRejectedDraft" when payload.ValueKind == JsonValueKind.Null => await SaveRejectedDraftAsync(),
                "exportAllZip" when payload.ValueKind == JsonValueKind.Object => await exporter.ExportAsync(payload),
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
        var path = ChooseFile(new OpenFileDialog { Filter = ProjectFilter, CheckFileExists = true, InitialDirectory = data.ProjectsPath });
        if (path is null) return null;
        return new { name = Path.GetFileName(path), text = await File.ReadAllTextAsync(path) };
    }

    private async Task<bool?> SaveProjectAsync(string text)
    {
        // The editor validates the full schema with parseProject before sending the snapshot.
        using var document = JsonDocument.Parse(text);
        var project = document.RootElement;
        if (project.ValueKind != JsonValueKind.Object || !project.TryGetProperty("schemaVersion", out var version) ||
            version.ValueKind != JsonValueKind.Number || !version.TryGetInt32(out int schema) || schema != 5)
            throw new InvalidDataException("仅支持 schemaVersion: 5。");

        var path = ChooseFile(new SaveFileDialog
        {
            Filter = ProjectFilter, DefaultExt = ".json", FileName = "reading-project.json", OverwritePrompt = true, InitialDirectory = data.ProjectsPath
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
            Filter = ProjectFilter, DefaultExt = ".json", FileName = "rejected-draft.json", OverwritePrompt = true, InitialDirectory = data.ProjectsPath
        });
        if (path is null) return null;
        await data.ExportRejectedDraftAsync(path);
        return true;
    }
}
