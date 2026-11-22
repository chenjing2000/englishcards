using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;

internal static class ReaderChecks
{
    internal static async Task RunAsync()
    {
        var directory = Path.Combine(Path.GetTempPath(), "EnglishCards-A1-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        int checks = 0;
        void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; Console.WriteLine("PASS " + name); }
        var reader = typeof(EnglishCards.MainWindow).Assembly.GetType("EnglishCards.ScriptFileReader", true)!;
        var open = reader.GetMethod("OpenAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
        async Task<JsonElement> Open(string path)
        {
            var task = (Task)open.Invoke(null, [path])!;
            await task;
            var value = task.GetType().GetProperty("Result")!.GetValue(task);
            return JsonSerializer.SerializeToElement(value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        }
        try
        {
            var script = Path.Combine(directory, "lesson.json");
            await File.WriteAllTextAsync(script, """{"filetype":"script","title":"","paragraphs":[[{"text":"Exact wording.","timed_units":[]}]]}""");
            var before = SHA256.HashData(await File.ReadAllBytesAsync(script));
            var empty = await Open(script);
            Check(empty.GetProperty("vocabulary").ValueKind == JsonValueKind.Null, "Script without optional files opens");
            await File.WriteAllTextAsync(Path.Combine(directory, "z.json"), """{"filetype":"vocabulary","words":[]}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "A.JSON"), """{"filetype":"vocabulary","words":[]}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "translation.json"), """{"filetype":"translation","text":"line1\nline2"}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "broken.json"), "{");
            Directory.CreateDirectory(Path.Combine(directory, "nested"));
            await File.WriteAllTextAsync(Path.Combine(directory, "nested", "0.json"), """{"filetype":"vocabulary","words":[]}""");
            var selected = await Open(script);
            Check(Path.GetFileName(selected.GetProperty("vocabulary").GetProperty("path").GetString()) == "A.JSON", "Deterministic filename choice including uppercase extension, no recursion");
            Check(selected.GetProperty("translation").GetProperty("text").GetString()!.Contains("line1\\nline2"), "Translation raw JSON retained unchanged");
            Check(selected.GetProperty("notices").EnumerateArray().Any(value => value.GetString()!.Contains("A.JSON")), "Multiple companion choice reports selected filename");
            Check(selected.GetProperty("notices").EnumerateArray().Any(value => value.GetString()!.Contains("broken.json")), "Unreadable companion reports failure without blocking Script");
            var after = SHA256.HashData(await File.ReadAllBytesAsync(script));
            Check(before.SequenceEqual(after), "Reading does not modify Script bytes");
            var article = Path.Combine(directory, "article.json");
            await File.WriteAllTextAsync(article, """{"schemaVersion":6,"title":"Old Article"}""");
            bool rejected = false;
            try { await Open(article); } catch (InvalidDataException) { rejected = true; }
            Check(rejected, "Article v6 rejected without migration");
            Check(Directory.GetFiles(directory, "*.zip").Length == 0 && Directory.GetFiles(directory, "*.tmp").Length == 0, "Reader creates no ZIP or staged source writes");
            var bridge = typeof(EnglishCards.MainWindow).Assembly.GetType("EnglishCards.EditorBridge", true)!;
            var list = bridge.GetMethod("ListCardDirectory", BindingFlags.NonPublic | BindingFlags.Static)!;
            JsonElement List(string path) => JsonSerializer.SerializeToElement(list.Invoke(null, [path, Path.Combine(directory, "internal")])!);
            await File.WriteAllTextAsync(Path.Combine(directory, "zz-script.JSON"), """{"filetype":"script"}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "nested-only.json"), """{"nested":{"filetype":"script"}}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "wrong-case.json"), """{"filetype":"Script"}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "not-json.txt"), """{"filetype":"script"}""");
            foreach (var name in new[] { "cache", "export", "logs", "settings", "external-userdata", "internal" }) Directory.CreateDirectory(Path.Combine(directory, name));
            Directory.CreateDirectory(Path.Combine(directory, "external-userdata", "logs"));
            foreach (var name in new[] { "logs", "settings", "exports", "temp", "cache", "lessons" }) Directory.CreateDirectory(Path.Combine(directory, "internal", name));
            await File.WriteAllTextAsync(Path.Combine(directory, "nested", "not-recursed.json"), """{"filetype":"script"}""");
            await File.WriteAllTextAsync(Path.Combine(directory, "array.json"), """[{"filetype":"script"}]""");
            await File.WriteAllTextAsync(Path.Combine(directory, "numeric-type.json"), """{"filetype":1}""");
            var listing = List(directory);
            Check(listing.GetProperty("files").EnumerateArray().Select(item => item.GetProperty("name").GetString()).SequenceEqual(new[] { "lesson.json", "zz-script.JSON" }), "A2 only immediate JSON with exact top-level Script type, sorted");
            Check(listing.GetProperty("folders").EnumerateArray().Select(item => item.GetProperty("name").GetString()).SequenceEqual(new[] { "external-userdata", "internal", "logs", "nested", "settings" }), "A2 generated directories hidden, legitimate logs and settings retained");
            Check(List(Path.Combine(directory, "internal")).GetProperty("folders").EnumerateArray().Select(item => item.GetProperty("name").GetString()).SequenceEqual(new[] { "lessons" }), "A2 actual internal userdata directories hidden by identity");
            Check(List(Path.Combine(directory, "external-userdata")).GetProperty("folders").GetArrayLength() == 1, "A2 external userdata name does not hide legitimate logs");
            Console.WriteLine($"Reader checks passed: {checks}");
        }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
