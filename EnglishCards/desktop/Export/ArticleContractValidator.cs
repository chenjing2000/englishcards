using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EnglishCards;

/// <summary>
/// Revalidates Article v6 at the desktop trust boundary. The browser validates before
/// sending, but the WPF bridge and ZIP exporter must not rely on renderer-side checks.
/// </summary>
internal static class ArticleContractValidator
{
    private const int Version = 6;
    private const int MaxParagraphs = 999;
    private const int MaxVocabulary = 999;
    private const int MaxTextLength = 300_000;
    private static readonly Regex ParagraphId = new("^p(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})$", RegexOptions.CultureInvariant);
    private static readonly Regex VocabularyId = new("^v(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})$", RegexOptions.CultureInvariant);

    internal static void Validate(JsonElement article)
    {
        RequireKind(article, JsonValueKind.Object, "article");
        RequireProperties(article,
            ["schemaVersion", "id", "title", "identityTag", "content", "vocabulary", "translation"],
            "article");

        var version = article.GetProperty("schemaVersion");
        if (version.ValueKind != JsonValueKind.Number || !version.TryGetInt32(out int schema) || schema != Version)
            Fail("schemaVersion", "只支持 schemaVersion: 6。");

        RequireString(article.GetProperty("id"), "id", allowEmpty: false);
        RequireString(article.GetProperty("title"), "title");
        RequireString(article.GetProperty("identityTag"), "identityTag");
        ValidateParagraphCollection(article.GetProperty("content"), "content");
        ValidateVocabulary(article.GetProperty("vocabulary"));
        ValidateParagraphCollection(article.GetProperty("translation"), "translation");
    }

    private static void ValidateParagraphCollection(JsonElement section, string path)
    {
        RequireKind(section, JsonValueKind.Object, path);
        RequireProperties(section, ["paragraphs"], path);
        var paragraphs = section.GetProperty("paragraphs");
        RequireKind(paragraphs, JsonValueKind.Array, $"{path}.paragraphs");
        if (paragraphs.GetArrayLength() > MaxParagraphs)
            Fail($"{path}.paragraphs", $"最多允许 {MaxParagraphs} 段。");

        int index = 0;
        foreach (var paragraph in paragraphs.EnumerateArray())
        {
            string itemPath = $"{path}.paragraphs[{index}]";
            RequireKind(paragraph, JsonValueKind.Object, itemPath);
            RequireProperties(paragraph, ["id", "text"], itemPath);
            string expected = $"p{index + 1:000}";
            string id = RequireString(paragraph.GetProperty("id"), $"{itemPath}.id", allowEmpty: false);
            if (!ParagraphId.IsMatch(id) || !string.Equals(id, expected, StringComparison.Ordinal))
                Fail($"{itemPath}.id", $"必须为 {expected}，段落需按当前顺序连续编号。");
            RequireString(paragraph.GetProperty("text"), $"{itemPath}.text");
            index++;
        }
    }

    private static void ValidateVocabulary(JsonElement vocabulary)
    {
        RequireKind(vocabulary, JsonValueKind.Array, "vocabulary");
        if (vocabulary.GetArrayLength() > MaxVocabulary)
            Fail("vocabulary", $"最多允许 {MaxVocabulary} 个词条。");

        var words = new HashSet<string>(StringComparer.Ordinal);
        int index = 0;
        foreach (var entry in vocabulary.EnumerateArray())
        {
            string path = $"vocabulary[{index}]";
            RequireKind(entry, JsonValueKind.Object, path);
            RequireProperties(entry, ["id", "word", "highlight", "senses"], path, ["ipa"]);
            string expected = $"v{index + 1:000}";
            string id = RequireString(entry.GetProperty("id"), $"{path}.id", allowEmpty: false);
            if (!VocabularyId.IsMatch(id) || !string.Equals(id, expected, StringComparison.Ordinal))
                Fail($"{path}.id", $"必须为 {expected}。");

            string word = RequireString(entry.GetProperty("word"), $"{path}.word");
            string normalized = NormalizeVocabulary(word);
            if (normalized.Length > 0 && !words.Add(normalized))
                Fail($"{path}.word", $"重复词条：{word}");

            if (entry.TryGetProperty("ipa", out var ipa))
                RequireString(ipa, $"{path}.ipa");

            var highlights = entry.GetProperty("highlight");
            RequireKind(highlights, JsonValueKind.Array, $"{path}.highlight");
            if (highlights.GetArrayLength() > 2000)
                Fail($"{path}.highlight", "高亮项最多允许 2000 个。");
            int highlightIndex = 0;
            foreach (var highlight in highlights.EnumerateArray())
                RequireString(highlight, $"{path}.highlight[{highlightIndex++}]");

            var senses = entry.GetProperty("senses");
            RequireKind(senses, JsonValueKind.Array, $"{path}.senses");
            if (senses.GetArrayLength() is < 1 or > 2000)
                Fail($"{path}.senses", "义项数量必须为 1–2000。");
            int senseIndex = 0;
            foreach (var sense in senses.EnumerateArray())
            {
                string sensePath = $"{path}.senses[{senseIndex++}]";
                RequireKind(sense, JsonValueKind.Object, sensePath);
                RequireProperties(sense,
                    ["pos", "meaning", "example", "exampleTranslation"], sensePath);
                RequireString(sense.GetProperty("pos"), $"{sensePath}.pos");
                RequireString(sense.GetProperty("meaning"), $"{sensePath}.meaning");
                RequireString(sense.GetProperty("example"), $"{sensePath}.example");
                RequireString(sense.GetProperty("exampleTranslation"), $"{sensePath}.exampleTranslation");
            }
            index++;
        }
    }

    private static string NormalizeVocabulary(string value) =>
        string.Join(' ', value.Normalize(NormalizationForm.FormC)
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            .ToLowerInvariant();

    private static string RequireString(JsonElement value, string path, bool allowEmpty = true)
    {
        RequireKind(value, JsonValueKind.String, path);
        string text = value.GetString()!;
        if (!allowEmpty && string.IsNullOrWhiteSpace(text))
            Fail(path, "不能为空。");
        if (text.Length > MaxTextLength)
            Fail(path, $"文本超过 {MaxTextLength} 个字符。");
        foreach (char character in text)
        {
            if ((character < ' ' && character is not '\t' and not '\n' and not '\r') || character == '\uFFFD')
                Fail(path, "包含非法控制字符或乱码替代符。");
        }
        return text;
    }

    private static void RequireProperties(JsonElement value, string[] required, string path, string[]? optional = null)
    {
        var allowed = new HashSet<string>(required, StringComparer.Ordinal);
        if (optional is not null) allowed.UnionWith(optional);
        var found = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
        {
            if (!found.Add(property.Name))
                Fail($"{path}.{property.Name}", "字段重复。");
            if (!allowed.Contains(property.Name))
                Fail($"{path}.{property.Name}", "不支持的字段（旧格式不兼容）。");
        }
        foreach (string property in required)
            if (!found.Contains(property))
                Fail($"{path}.{property}", "缺少必需字段。");
    }

    private static void RequireKind(JsonElement value, JsonValueKind kind, string path)
    {
        if (value.ValueKind != kind)
            Fail(path, $"数据类型必须为 {kind}。");
    }

    private static void Fail(string path, string message) =>
        throw new InvalidDataException($"{path}: {message}");
}
