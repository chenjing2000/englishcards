using System.IO;
using System.Text.Json;

namespace EnglishCards;

/// <summary>Read-only snapshot of one Script and its optional same-directory companions.</summary>
internal static class ScriptFileReader
{
    internal sealed record Companion(string Path, string Text);
    internal sealed record Snapshot(string Path, string Text, Companion? Vocabulary, Companion? Translation, string[] Notices, string? SettingsText);

    internal static async Task<Snapshot> OpenAsync(string requestedPath)
    {
        if (string.IsNullOrWhiteSpace(requestedPath) || !Path.IsPathFullyQualified(requestedPath) ||
            !string.Equals(Path.GetExtension(requestedPath), ".json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("请选择有效的 Script JSON 文件。");
        var path = Path.GetFullPath(requestedPath);
        var text = await File.ReadAllTextAsync(path);
        using (var parsed = JsonDocument.Parse(text))
        {
            if (FileType(parsed.RootElement) != "script")
                throw new InvalidDataException("只支持 filetype=script 的 Script JSON；不兼容 Article。");
        }
        var vocabulary = new List<Companion>();
        var translation = new List<Companion>();
        var notices = new List<string>();
        // A1 companion lookup is local and flat. Directory filtering and auto-open belong to A2.
        foreach (var file in Directory.EnumerateFiles(Path.GetDirectoryName(path)!)
                     .Where(file => string.Equals(Path.GetExtension(file), ".json", StringComparison.OrdinalIgnoreCase))
                     .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase).ThenBy(Path.GetFileName, StringComparer.Ordinal))
        {
            if (string.Equals(file, path, StringComparison.OrdinalIgnoreCase)) continue;
            try
            {
                var companionText = await File.ReadAllTextAsync(file);
                using var parsed = JsonDocument.Parse(companionText);
                var type = FileType(parsed.RootElement);
                if (type == "vocabulary") vocabulary.Add(new(file, companionText));
                if (type == "translation") translation.Add(new(file, companionText));
            }
            catch (Exception error) when (error is JsonException or IOException or UnauthorizedAccessException)
            {
                notices.Add($"无法读取同目录 JSON：{Path.GetFileName(file)}（{error.Message}）");
            }
        }
        Companion? Select(List<Companion> files, string type)
        {
            if (files.Count > 1) notices.Add($"找到多个 {type}，按文件名选用：{Path.GetFileName(files[0].Path)}");
            return files.FirstOrDefault();
        }
        var selectedVocabulary = Select(vocabulary, "Vocabulary");
        var selectedTranslation = Select(translation, "Translation");
        string? settingsText = null;
        try { settingsText = await ReaderFileWrites.LoadSettingsAsync(path); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException)
        {
            notices.Add($"读取 Script 设置失败：{error.Message}");
        }
        return new(path, text, selectedVocabulary, selectedTranslation, notices.ToArray(), settingsText);
    }

    private static string? FileType(JsonElement value) =>
        value.ValueKind == JsonValueKind.Object && value.TryGetProperty("filetype", out var type) && type.ValueKind == JsonValueKind.String
            ? type.GetString() : null;
}
