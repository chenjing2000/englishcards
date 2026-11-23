using System.IO;
using System.Reflection;
using System.Text.Json;

internal static class A3ReaderChecks
{
    internal static async Task RunAsync()
    {
        var folder = Path.Combine(Path.GetTempPath(), "EnglishCards-A3-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        var checks = 0;
        void Check(bool condition, string label)
        {
            if (!condition) throw new Exception(label);
            checks++; Console.WriteLine("PASS " + label);
        }
        var service = typeof(EnglishCards.MainWindow).Assembly.GetType("EnglishCards.ReaderFileWrites", true)!;
        var vocabularyType = service.GetNestedType("VocabularyEdit", BindingFlags.NonPublic)!;
        var settingsType = service.GetNestedType("SettingsEdit", BindingFlags.NonPublic)!;
        var add = service.GetMethod("AddVocabularyAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
        var save = service.GetMethod("SaveSettingsAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
        var load = service.GetMethod("LoadSettingsAsync", BindingFlags.NonPublic | BindingFlags.Static)!;

        async Task<(string Path, string Text)> Invoke(MethodInfo method, object payload)
        {
            var task = (Task)method.Invoke(null, [payload])!;
            await task;
            var result = task.GetType().GetProperty("Result")!.GetValue(task)!;
            return ((string)result.GetType().GetProperty("Path")!.GetValue(result)!,
                (string)result.GetType().GetProperty("Text")!.GetValue(result)!);
        }
        async Task<bool> Rejected(MethodInfo method, object payload)
        {
            try { await Invoke(method, payload); return false; }
            catch (IOException) { return true; }
            catch (InvalidDataException) { return true; }
        }
        object Vocabulary(string script, string? path, string? expected, string word) =>
            Activator.CreateInstance(vocabularyType, script, path, expected, word, "释义", "n.")!;
        object Styles(string script, string? expected, string text) =>
            Activator.CreateInstance(settingsType, script, expected, text)!;

        try
        {
            var script = Path.Combine(folder, "lesson.script.json");
            await File.WriteAllTextAsync(script, """{"filetype":"script","title":"","paragraphs":[[{"text":"Test word."}]]}""");
            var before = await File.ReadAllBytesAsync(script);
            var created = await Invoke(add, Vocabulary(script, null, null, "Test"));
            Check(Path.GetFileName(created.Path) == "lesson.script.vocabulary.json", "Missing Vocabulary created beside Script");
            using (var json = JsonDocument.Parse(created.Text))
                Check(json.RootElement.GetProperty("words")[0].GetProperty("meanings")[0].GetProperty("meaning").GetString() == "释义",
                    "Created word has native required fields");
            Check(await Rejected(add, Vocabulary(script, created.Path, created.Text, "test")), "Case-insensitive duplicate refused");
            var updated = await Invoke(add, Vocabulary(script, created.Path, created.Text, "Other"));
            using (var json = JsonDocument.Parse(updated.Text))
                Check(json.RootElement.GetProperty("words").GetArrayLength() == 2, "Existing Vocabulary extended without losing words");
            await File.AppendAllTextAsync(updated.Path, "\n");
            Check(await Rejected(add, Vocabulary(script, updated.Path, updated.Text, "Third")), "External Vocabulary edit refuses overwrite");
            Check(await File.ReadAllTextAsync(updated.Path) == updated.Text + "\n", "External edit bytes preserved");
            var missing = (Task)load.Invoke(null, [script])!;
            await missing;
            Check(missing.GetType().GetProperty("Result")!.GetValue(missing) is null, "Missing settings does not auto-create file");
            var first = await Invoke(save, Styles(script, null, """{"bodySize":34}"""));
            Check(first.Path.EndsWith(Path.Combine("export", "lesson.script", "settings.json"), StringComparison.OrdinalIgnoreCase),
                "Per-Script settings saved in export folder");
            var loaded = (Task)load.Invoke(null, [script])!;
            await loaded;
            Check((string?)loaded.GetType().GetProperty("Result")!.GetValue(loaded) == first.Text, "Settings reload uses saved bytes");
            await File.WriteAllTextAsync(first.Path, """{"bodySize":40}""");
            Check(await Rejected(save, Styles(script, first.Text, """{"bodySize":35}""")), "External settings modification refuses overwrite");
            Check(await File.ReadAllTextAsync(first.Path) == """{"bodySize":40}""", "Rejected settings are preserved");
            Check((await File.ReadAllBytesAsync(script)).SequenceEqual(before), "A3 does not modify Script");
            Console.WriteLine($"A3 native checks passed: {checks}");
        }
        finally { Directory.Delete(folder, recursive: true); }
    }
}
