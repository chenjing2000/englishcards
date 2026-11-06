using System.IO;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace EnglishCards;

/// <summary>Formats exported article JSON for people to inspect and edit.</summary>
internal static class ArticleJsonFormatter
{
    internal static byte[] FormatUtf8(string json)
    {
        using var document = JsonDocument.Parse(json);
        using var output = new MemoryStream();
        using (var writer = new Utf8JsonWriter(output, new JsonWriterOptions
        {
            Indented = true,
            IndentSize = 2,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        }))
        {
            document.RootElement.WriteTo(writer);
        }

        // UTF-8 without BOM, with a final newline for editor-friendly files.
        output.WriteByte((byte)'\n');
        return output.ToArray();
    }
}
