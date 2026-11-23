using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace EnglishCards;

/// <summary>Scoped A3 writes. Inputs are compared with the exact bytes read when the Script was opened.</summary>
internal static class ReaderFileWrites
{
    internal sealed record VocabularyEdit(string ScriptPath, string? VocabularyPath, string? ExpectedText,
        string Word, string Meaning, string PartOfSpeech);
    internal sealed record SettingsEdit(string ScriptPath, string? ExpectedText, string Text);
    internal sealed record WrittenFile(string Path, string Text);

    private static string Script(string requested)
    {
        if (string.IsNullOrWhiteSpace(requested) || !Path.IsPathFullyQualified(requested) ||
            !string.Equals(Path.GetExtension(requested), ".json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("无效的 Script 文件路径。");
        var path = Path.GetFullPath(requested);
        using var json = JsonDocument.Parse(File.ReadAllText(path));
        if (!json.RootElement.TryGetProperty("filetype", out var filetype) || filetype.GetString() != "script")
            throw new InvalidDataException("当前文件不是 Script。");
        return path;
    }

    internal static string SettingsPath(string script)
    {
        var path = Script(script);
        var stem = Path.GetFileNameWithoutExtension(path);
        return Path.Combine(Path.GetDirectoryName(path)!, "export", stem, "settings.json");
    }

    internal static async Task<string?> LoadSettingsAsync(string script)
    {
        var path = SettingsPath(script);
        return File.Exists(path) ? await File.ReadAllTextAsync(path) : null;
    }

    private static async Task CheckUnchangedAsync(string path, string? expected)
    {
        if (expected is null)
        {
            if (File.Exists(path)) throw new IOException("文件已由其他程序创建，请重新打开 Script 后重试。");
        }
        else
        {
            if (!File.Exists(path) || !string.Equals(await File.ReadAllTextAsync(path), expected, StringComparison.Ordinal))
                throw new IOException("文件已被其他程序修改，请重新打开 Script 后重试，未覆盖外部修改。");
        }
    }

    internal static async Task<WrittenFile> AddVocabularyAsync(VocabularyEdit edit)
    {
        var script = Script(edit.ScriptPath);
        var word = edit.Word.Trim();
        var meaning = edit.Meaning.Trim();
        var pos = edit.PartOfSpeech.Trim();
        if (word.Length == 0 || word.Length > 80 || meaning.Length == 0 || meaning.Length > 500 || pos.Length > 40)
            throw new InvalidDataException("生词或释义为空，或输入内容过长。");

        var folder = Path.GetDirectoryName(script)!;
        var path = edit.VocabularyPath is null
            ? Path.Combine(folder, Path.GetFileNameWithoutExtension(script) + ".vocabulary.json")
            : Path.GetFullPath(edit.VocabularyPath);
        if (!string.Equals(Path.GetDirectoryName(path), folder, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(Path.GetExtension(path), ".json", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(path, script, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("生词本必须是当前 Script 同目录中的 JSON 文件。");
        if ((edit.VocabularyPath is null) != (edit.ExpectedText is null))
            throw new InvalidDataException("生词本版本信息不完整，请重新打开 Script。");

        await CheckUnchangedAsync(path, edit.ExpectedText);
        var root = edit.ExpectedText is null
            ? new JsonObject { ["filetype"] = "vocabulary", ["words"] = new JsonArray() }
            : JsonNode.Parse(edit.ExpectedText) as JsonObject ?? throw new InvalidDataException("生词本格式错误。");
        if (root["filetype"]?.GetValue<string>() != "vocabulary" || root["words"] is not JsonArray words)
            throw new InvalidDataException("当前文件不是有效的 Vocabulary。");
        if (words.Any(entry => string.Equals(entry?["word"]?.GetValue<string>()?.Trim(), word, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidDataException("该生词已经存在于当前 Vocabulary。");

        words.Add(new JsonObject {
            ["word"] = word, ["family"] = new JsonArray(),
            ["phonetic_uk"] = "", ["phonetic_us"] = "",
            ["meanings"] = new JsonArray(new JsonObject { ["pos"] = pos, ["meaning"] = meaning })
        });
        var text = root.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
        // Recheck immediately before atomic replacement. An externally modified source is never knowingly overwritten.
        await CheckUnchangedAsync(path, edit.ExpectedText);
        await UserDataStore.WriteAtomicallyAsync(path, text);
        return new(path, text);
    }

    internal static async Task<WrittenFile> SaveSettingsAsync(SettingsEdit edit)
    {
        var path = SettingsPath(edit.ScriptPath);
        using (var json = JsonDocument.Parse(edit.Text))
            if (json.RootElement.ValueKind != JsonValueKind.Object)
                throw new InvalidDataException("设置格式错误。");
        await CheckUnchangedAsync(path, edit.ExpectedText);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await CheckUnchangedAsync(path, edit.ExpectedText);
        await UserDataStore.WriteAtomicallyAsync(path, edit.Text);
        return new(path, edit.Text);
    }
}
