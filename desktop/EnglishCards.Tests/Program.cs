using System.IO;
using System.Reflection;
using System.Text;

var bridgeType = Assembly.Load("EnglishCards").GetType("EnglishCards.EditorBridge", throwOnError: true)!;
var bridge = Activator.CreateInstance(bridgeType, [null, null, null, null]);
var enqueue = bridgeType.GetMethod("RunFileCommandAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
Task Send(Func<Task> command) => (Task)enqueue.Invoke(bridge, [command])!;

var replaceFile = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
string contents = "old project";
var replies = new List<string>();

var saving = Send(async () =>
{
    await replaceFile.Task;
    contents = "saved project";
    replies.Add("saved");
});
var opening = Send(() =>
{
    replies.Add(contents);
    return Task.CompletedTask;
});

if (opening.IsCompleted) throw new Exception("Open replied while save still had an unfinished replacement.");
replaceFile.SetResult();
await Task.WhenAll(saving, opening).WaitAsync(TimeSpan.FromSeconds(5));
if (!replies.SequenceEqual(["saved", "saved project"]))
    throw new Exception("Open must read the replaced contents after the save reply.");

Console.WriteLine("PASS open waits for the previous save replacement and reply");

var storeType = bridgeType.Assembly.GetType("EnglishCards.UserDataStore", throwOnError: true)!;
var write = storeType.GetMethod("WriteAtomicallyAsync", BindingFlags.Static | BindingFlags.NonPublic)!;
Task Save(string path, string text) => (Task)write.Invoke(null, [path, text])!;
var directory = Directory.CreateTempSubdirectory("EnglishCards-file-test-");
var destination = Path.Combine(directory.FullName, "sample.json");
try
{
    const string original = """{"schemaVersion":5,"title":"保存原文"}""";
    const string edited = """{"schemaVersion":5,"title":"保存成功"}""";
    var originalBytes = Encoding.UTF8.GetBytes(original);
    await Save(destination, original);
    if (!File.ReadAllBytes(destination).SequenceEqual(originalBytes))
        throw new Exception("New file bytes do not match.");

    bool failed = false;
    using (var locked = File.Open(destination, FileMode.Open, FileAccess.Read, FileShare.Read))
    {
        try { await Save(destination, edited); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { failed = true; }
    }
    if (!failed || !File.ReadAllBytes(destination).SequenceEqual(originalBytes) || directory.GetFiles().Length != 1)
        throw new Exception("Locked replace must fail, preserve the original bytes, and clean up the temporary file.");

    await Save(destination, edited);
    if (File.ReadAllText(destination) != edited || directory.GetFiles().Length != 1)
        throw new Exception("Retry did not replace the original cleanly.");
    Console.WriteLine("PASS new UTF-8 JSON, locked-target preservation and cleanup, successful retry");
}
finally
{
    File.Delete(destination);
    if (directory.GetFiles().Length == 0) directory.Delete();
}

var storeCtor = storeType.GetConstructor(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
    binder: null, [typeof(string)], modifiers: null)!;
var acquireLease = storeType.GetMethod("AcquireInstanceLease", BindingFlags.Instance | BindingFlags.NonPublic)!;
var disposeStore = storeType.GetMethod("Dispose", BindingFlags.Instance | BindingFlags.Public)!;
var saveSettings = storeType.GetMethod("SaveSettingsAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
var saveDraft = storeType.GetMethod("SaveDraftAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
var ensureDraft = storeType.GetMethod("EnsureRejectedDraftAvailable", BindingFlags.Instance | BindingFlags.NonPublic)!;
var exportDraft = storeType.GetMethod("ExportRejectedDraftAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
object NewStore(string path) => storeCtor.Invoke([path]);
void Acquire(object store) => acquireLease.Invoke(store, null);
void Dispose(object store) => disposeStore.Invoke(store, null);
Task SaveSettings(object store, string text) => (Task)saveSettings.Invoke(store, [text, true])!;
Task SaveDraft(object store, string text) => (Task)saveDraft.Invoke(store, [text, true])!;

var leaseDirectory = Directory.CreateTempSubdirectory("EnglishCards-lease-test-");
var firstStore = NewStore(leaseDirectory.FullName);
var secondStore = NewStore(leaseDirectory.FullName);
try
{
    Acquire(firstStore);
    bool alreadyOpen = false;
    try { Acquire(secondStore); }
    catch (TargetInvocationException error) when (error.InnerException is IOException) { alreadyOpen = true; }
    if (!alreadyOpen) throw new Exception("A second instance must not acquire the same user-data root.");
    Dispose(firstStore);
    Acquire(secondStore);
    Console.WriteLine("PASS exclusive instance lease releases on disposal and can be reacquired");
}
finally
{
    Dispose(firstStore);
    Dispose(secondStore);
    Directory.Delete(leaseDirectory.FullName, recursive: true);
}

var missingDirectory = Directory.CreateTempSubdirectory("EnglishCards-missing-reject-test-");
var missingStore = NewStore(missingDirectory.FullName);
try
{
    await SaveSettings(missingStore, "replacement settings");
    if (File.ReadAllText(Path.Combine(missingDirectory.FullName, "settings", "settings.json")) != "replacement settings")
        throw new Exception("A rejected source that disappeared should allow replacement.");
    Console.WriteLine("PASS missing rejected source permits the next settings write");
}
finally
{
    Dispose(missingStore);
    Directory.Delete(missingDirectory.FullName, recursive: true);
}

var missingDraftDirectory = Directory.CreateTempSubdirectory("EnglishCards-missing-draft-test-");
var missingDraftStore = NewStore(missingDraftDirectory.FullName);
var replacementDraft = "new valid draft";
var recoveryPath = Path.Combine(missingDraftDirectory.FullName, "recovered.json");
try
{
    await SaveDraft(missingDraftStore, replacementDraft);
    bool unavailable = false;
    try { ensureDraft.Invoke(missingDraftStore, null); }
    catch (TargetInvocationException error) when (error.InnerException is IOException) { unavailable = true; }
    bool exportFailed = false;
    try { await (Task)exportDraft.Invoke(missingDraftStore, [recoveryPath])!; }
    catch (TargetInvocationException error) when (error.InnerException is IOException) { exportFailed = true; }
    if (!unavailable || !exportFailed || File.Exists(recoveryPath) ||
        File.ReadAllText(Path.Combine(missingDraftDirectory.FullName, "drafts", "draft.json")) != replacementDraft)
        throw new Exception("Recovery must report a missing original before export and must not copy the replacement draft.");
    Console.WriteLine("PASS missing rejected draft is unavailable for recovery after replacement");
}
finally
{
    Dispose(missingDraftStore);
    Directory.Delete(missingDraftDirectory.FullName, recursive: true);
}

var retryParent = Directory.CreateTempSubdirectory("EnglishCards-rejected-retry-test-");
var blockedRoot = Path.Combine(retryParent.FullName, "user-data");
var retryRecovery = Path.Combine(retryParent.FullName, "recovered.json");
await File.WriteAllTextAsync(blockedRoot, "blocks directory creation");
var retryStore = NewStore(blockedRoot);
try
{
    bool firstSaveFailed = false;
    try { await SaveDraft(retryStore, "first replacement"); }
    catch (IOException) { firstSaveFailed = true; }
    if (!firstSaveFailed) throw new Exception("The first save must fail while the data root is a file.");

    File.Delete(blockedRoot);
    Directory.CreateDirectory(blockedRoot);
    const string restoredOriginal = "restored original rejected draft";
    await File.WriteAllTextAsync(Path.Combine(blockedRoot, "draft.json"), restoredOriginal);
    await SaveDraft(retryStore, "successful replacement");
    ensureDraft.Invoke(retryStore, null);
    await (Task)exportDraft.Invoke(retryStore, [retryRecovery])!;
    if (File.ReadAllText(retryRecovery) != restoredOriginal)
        throw new Exception("A retry must preserve and export the original restored after the failed write.");
    Console.WriteLine("PASS failed missing-source write leaves retry able to preserve restored original");
}
finally
{
    Dispose(retryStore);
    Directory.Delete(retryParent.FullName, recursive: true);
}

var rejectedDirectory = Directory.CreateTempSubdirectory("EnglishCards-reject-test-");
var rejectedPath = Path.Combine(rejectedDirectory.FullName, "settings.json");
const string rejectedContents = "original unreadable settings";
await File.WriteAllTextAsync(rejectedPath, rejectedContents);
var rejectedBytes = File.ReadAllBytes(rejectedPath);
var rejectedStore = NewStore(rejectedDirectory.FullName);
try
{
    bool preserveFailed = false;
    using (File.Open(rejectedPath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
    {
        try { await SaveSettings(rejectedStore, "replacement settings"); }
        catch (IOException) { preserveFailed = true; }
    }
    if (!preserveFailed || !File.ReadAllBytes(rejectedPath).SequenceEqual(rejectedBytes) || rejectedDirectory.GetFiles().Length != 1)
        throw new Exception("An unreadable rejected source must block replacement and remain byte-identical.");
    Console.WriteLine("PASS unreadable rejected source blocks replacement and retains original bytes");
}
finally
{
    Dispose(rejectedStore);
    Directory.Delete(rejectedDirectory.FullName, recursive: true);
}

// Embedded single-file React resources must include both entry pages and at least one font.
var resources = bridgeType.Assembly.GetManifestResourceNames();
if (!resources.Contains("ECUI/index.html") || !resources.Contains("ECUI/render.html") ||
    !resources.Any(name => name.StartsWith("ECUI/assets/", StringComparison.Ordinal) && name.EndsWith(".woff2", StringComparison.Ordinal)))
    throw new Exception("Single-file resources are missing index.html, render.html or bundled fonts.");
Console.WriteLine("PASS embedded React editor, render page and font resources");
