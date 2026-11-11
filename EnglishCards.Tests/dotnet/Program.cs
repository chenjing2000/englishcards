using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

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

bool failedCommandObserved = false;
try
{
    await Send(() => Task.FromException(new InvalidOperationException("expected test failure")));
}
catch (InvalidOperationException error) when (error.Message == "expected test failure")
{
    failedCommandObserved = true;
}
var afterFailure = false;
await Send(() =>
{
    afterFailure = true;
    return Task.CompletedTask;
});
if (!failedCommandObserved || !afterFailure)
    throw new Exception("A failed bridge command must be observable without blocking subsequent commands.");
Console.WriteLine("PASS failed bridge command does not block subsequent commands");

var storeType = bridgeType.Assembly.GetType("EnglishCards.UserDataStore", throwOnError: true)!;
var write = storeType.GetMethod("WriteAtomicallyAsync", BindingFlags.Static | BindingFlags.NonPublic)!;
Task Save(string path, string text) => (Task)write.Invoke(null, [path, text])!;
var directory = Directory.CreateTempSubdirectory("EnglishCards-file-test-");
var destination = Path.Combine(directory.FullName, "sample.json");
try
{
    const string original = """{"schemaVersion":6,"id":"x","title":"保存原文","identityTag":"","content":{"paragraphs":[]},"vocabulary":[],"translation":{"paragraphs":[]}}""";
    const string edited = """{"schemaVersion":6,"id":"x","title":"保存成功","identityTag":"","content":{"paragraphs":[]},"vocabulary":[],"translation":{"paragraphs":[]}}""";
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

// A failed writer must leave the committed target untouched and remove only its staging file.
var stageAndMove = storeType.GetMethod("StageAndMoveAsync", BindingFlags.Static | BindingFlags.NonPublic)!;
Task Stage(string path, Func<Stream, Task> fill) => (Task)stageAndMove.Invoke(null, [path, fill])!;
var failureDirectory = Directory.CreateTempSubdirectory("EnglishCards-stage-failure-");
try
{
    var originalPath = Path.Combine(failureDirectory.FullName, "original.json");
    await File.WriteAllTextAsync(originalPath, "committed original");
    bool writerFailed = false;
    try
    {
        await Stage(originalPath, async stream =>
        {
            await stream.WriteAsync(Encoding.UTF8.GetBytes("incomplete replacement"));
            throw new IOException("injected staging failure");
        });
    }
    catch (IOException error) when (error.Message == "injected staging failure") { writerFailed = true; }
    if (!writerFailed || File.ReadAllText(originalPath) != "committed original" ||
        Directory.GetFiles(failureDirectory.FullName).Length != 1)
        throw new Exception("Failed staging must preserve the committed target and clean its temporary file.");
    Console.WriteLine("PASS staging writer failure preserves the committed target and removes its temporary file");

    // If another writer creates a new destination while the staging write is in flight,
    // the pending save must fail instead of overwriting that other writer's new file.
    var contestedPath = Path.Combine(failureDirectory.FullName, "contested.json");
    var stagingStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var continueStaging = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var pendingSave = Stage(contestedPath, async stream =>
    {
        await stream.WriteAsync(Encoding.UTF8.GetBytes("our staged content"));
        stagingStarted.SetResult();
        await continueStaging.Task;
    });
    try
    {
        await stagingStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await File.WriteAllTextAsync(contestedPath, "externally created content");
    }
    finally { continueStaging.TrySetResult(); }
    bool collisionRejected = false;
    try { await pendingSave; }
    catch (IOException) { collisionRejected = true; }
    if (!collisionRejected || File.ReadAllText(contestedPath) != "externally created content" ||
        Directory.GetFiles(failureDirectory.FullName).Length != 2)
        throw new Exception("A newly created destination must not be overwritten by an in-flight first save.");
    Console.WriteLine("PASS concurrent new destination is preserved and task staging is cleaned");
}
finally { failureDirectory.Delete(recursive: true); }

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

var loadNewCardFolder = storeType.GetMethod("LoadLastNewCardFolderAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
var loadLibraryFolder = storeType.GetMethod("LoadLastLibraryFolderAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
var saveNewCardFolder = storeType.GetMethod("SaveLastSuccessfulNewCardFolderAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
var saveLibraryFolder = storeType.GetMethod("SaveLastLibraryFolderAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
Task<string> LoadPath(object store, System.Reflection.MethodInfo method) => (Task<string>)method.Invoke(store, null)!;
Task SavePath(object store, System.Reflection.MethodInfo method, string path) => (Task)method.Invoke(store, [path])!;

var preferenceRoot = Directory.CreateTempSubdirectory("EnglishCards-path-preferences-");
var newCardFolderOne = Directory.CreateDirectory(Path.Combine(preferenceRoot.FullName, "cards-one"));
var newCardFolderTwo = Directory.CreateDirectory(Path.Combine(preferenceRoot.FullName, "cards-two"));
var libraryFolder = Directory.CreateDirectory(Path.Combine(preferenceRoot.FullName, "library"));
var preferenceStore = NewStore(preferenceRoot.FullName);
try
{
    if (await LoadPath(preferenceStore, loadNewCardFolder) != preferenceRoot.FullName ||
        await LoadPath(preferenceStore, loadLibraryFolder) != preferenceRoot.FullName)
        throw new Exception("Both remembered folder preferences must initially fall back to userdata.");

    await SavePath(preferenceStore, saveNewCardFolder, newCardFolderOne.FullName);
    await SavePath(preferenceStore, saveLibraryFolder, libraryFolder.FullName);
    if (await LoadPath(preferenceStore, loadNewCardFolder) != newCardFolderOne.FullName ||
        await LoadPath(preferenceStore, loadLibraryFolder) != libraryFolder.FullName)
        throw new Exception("New-card and library folders must be persisted independently.");

    Dispose(preferenceStore);
    preferenceStore = NewStore(preferenceRoot.FullName);
    if (await LoadPath(preferenceStore, loadNewCardFolder) != newCardFolderOne.FullName ||
        await LoadPath(preferenceStore, loadLibraryFolder) != libraryFolder.FullName)
        throw new Exception("Remembered folder preferences must survive a new store instance.");

    await SavePath(preferenceStore, saveNewCardFolder, newCardFolderTwo.FullName);
    Directory.Delete(newCardFolderTwo.FullName);
    if (await LoadPath(preferenceStore, loadNewCardFolder) != preferenceRoot.FullName)
        throw new Exception("A missing remembered destination must fall back to userdata.");
    Console.WriteLine("PASS last successful new-card folder and last library folder persist independently and recover from missing paths");
}
finally
{
    Dispose(preferenceStore);
    preferenceRoot.Delete(recursive: true);
}

var positioningType = bridgeType.Assembly.GetType("EnglishCards.FolderDialogPositioning", throwOnError: true)!;
var calculatePosition = positioningType.GetMethod("CalculatePosition", BindingFlags.Static | BindingFlags.NonPublic)!;
var centered = (System.Windows.Point)calculatePosition.Invoke(null, [
    new System.Windows.Rect(100, 100, 800, 600),
    new System.Windows.Size(400, 300),
    new System.Windows.Rect(0, 0, 1920, 1080)
])!;
if (centered != new System.Windows.Point(300, 250))
    throw new Exception("The folder picker must be centered over its owner.");
var clamped = (System.Windows.Point)calculatePosition.Invoke(null, [
    new System.Windows.Rect(1600, 850, 300, 180),
    new System.Windows.Size(500, 400),
    new System.Windows.Rect(0, 0, 1920, 1080)
])!;
if (clamped != new System.Windows.Point(1420, 680))
    throw new Exception("The centered folder picker must remain within the monitor work area.");
Console.WriteLine("PASS native folder picker positioning centers over its owner and clamps to the monitor work area");

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
    Directory.CreateDirectory(Path.Combine(blockedRoot, "drafts"));
    const string restoredOriginal = "restored original rejected draft";
    await File.WriteAllTextAsync(Path.Combine(blockedRoot, "drafts", "draft.json"), restoredOriginal);
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
var rejectedSettingsDirectory = Path.Combine(rejectedDirectory.FullName, "settings");
Directory.CreateDirectory(rejectedSettingsDirectory);
var rejectedPath = Path.Combine(rejectedSettingsDirectory, "settings.json");
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
    if (!preserveFailed || !File.ReadAllBytes(rejectedPath).SequenceEqual(rejectedBytes) ||
        Directory.GetFiles(rejectedDirectory.FullName, "*", SearchOption.AllDirectories).Length != 1)
        throw new Exception("An unreadable rejected source must block replacement and remain byte-identical.");
    Console.WriteLine("PASS unreadable rejected source blocks replacement and retains original bytes");
}
finally
{
    Dispose(rejectedStore);
    Directory.Delete(rejectedDirectory.FullName, recursive: true);
}

// Embedded React resource names can contain platform-specific path separators because
// MSBuild's %(RecursiveDir) metadata is evaluated on the build host.
var resources = bridgeType.Assembly.GetManifestResourceNames()
    .Select(name => name.Replace("\\", "/"))
    .ToArray();

var missingResources = new List<string>();
if (!resources.Contains("ECUI/index.html", StringComparer.Ordinal))
    missingResources.Add("ECUI/index.html");
if (!resources.Contains("ECUI/render.html", StringComparer.Ordinal))
    missingResources.Add("ECUI/render.html");
if (!resources.Any(name => name.StartsWith("ECUI/assets/", StringComparison.Ordinal) &&
                           name.EndsWith(".js", StringComparison.Ordinal)))
    missingResources.Add("ECUI/assets/*.js");
if (!resources.Any(name => name.StartsWith("ECUI/assets/", StringComparison.Ordinal) &&
                           name.EndsWith(".css", StringComparison.Ordinal)))
    missingResources.Add("ECUI/assets/*.css");
if (!resources.Any(name => name.StartsWith("ECUI/assets/", StringComparison.Ordinal) &&
                           name.EndsWith(".woff2", StringComparison.Ordinal)))
    missingResources.Add("ECUI/assets/*.woff2");

if (missingResources.Count > 0)
{
    var discovered = resources
        .Where(name => name.StartsWith("ECUI/", StringComparison.Ordinal))
        .OrderBy(name => name, StringComparer.Ordinal)
        .Take(20);
    throw new Exception(
        $"Embedded React resources are incomplete. Missing: {string.Join(", ", missingResources)}. " +
        $"Discovered resources: {string.Join(", ", discovered)}");
}
Console.WriteLine("PASS embedded React editor, render page, JS/CSS bundles and fonts");

// WebView2 navigation and resource requests must remain on the exact local HTTPS origin.
var localWebType = bridgeType.Assembly.GetType("EnglishCards.LocalWebContent", throwOnError: true)!;
var isLocalOriginMethod = localWebType.GetMethod("IsLocalOrigin", BindingFlags.Static | BindingFlags.NonPublic)!;
bool IsLocalOrigin(string value) => (bool)isLocalOriginMethod.Invoke(null, [value])!;
string[] allowedOrigins =
[
    "https://englishcards.invalid/",
    "https://ENGLISHCARDS.INVALID/index.html",
    "https://englishcards.invalid/assets/app.js",
    "https://englishcards.invalid:443/render.html"
];
string[] rejectedOrigins =
[
    "http://englishcards.invalid/",
    "https://englishcards.invalid.evil.example/",
    "https://englishcards.invalid@evil.example/",
    "https://evil.example/englishcards.invalid/",
    "https://englishcards.invalid:444/",
    "not a URL"
];
if (allowedOrigins.Any(uri => !IsLocalOrigin(uri)) || rejectedOrigins.Any(uri => IsLocalOrigin(uri)))
    throw new Exception("WebView2 must accept only the exact local HTTPS origin and default port.");
Console.WriteLine("PASS WebView2 origin validation accepts only the exact local HTTPS origin");

var startupExceptionType = bridgeType.Assembly.GetType("EnglishCards.WebView2StartupException", throwOnError: true)!;
var runtimeUrl = (string)startupExceptionType.GetField("RuntimeDownloadUrl", BindingFlags.Static | BindingFlags.NonPublic)!.GetRawConstantValue()!;
var startupExceptionCtor = startupExceptionType.GetConstructor(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
    binder: null, [typeof(Exception)], modifiers: null)!;
var startupException = (Exception)startupExceptionCtor.Invoke([new InvalidOperationException("test initialization failure")]);
if (runtimeUrl != "https://developer.microsoft.com/microsoft-edge/webview2/" ||
    !startupException.Message.Contains("WebView2 Evergreen Runtime", StringComparison.Ordinal))
    throw new Exception("WebView2 startup failures must provide a clear Evergreen Runtime recovery route.");
Console.WriteLine("PASS WebView2 startup failure exposes the official Microsoft Evergreen Runtime recovery URL");

// Exported article JSON must be readable, UTF-8 without BOM, and semantically identical.
var formatterType = bridgeType.Assembly.GetType("EnglishCards.ArticleJsonFormatter", throwOnError: true)!;
var formatJson = formatterType.GetMethod("FormatUtf8", BindingFlags.Static | BindingFlags.NonPublic)!;
const string compactArticle = """{"schemaVersion":6,"id":"x","title":"中文标题","identityTag":"","content":{"paragraphs":[]},"vocabulary":[],"translation":{"paragraphs":[]}}""";
var prettyBytes = (byte[])formatJson.Invoke(null, [compactArticle])!;
var prettyArticle = Encoding.UTF8.GetString(prettyBytes);
if ((prettyBytes.Length >= 3 && prettyBytes[0] == 0xEF && prettyBytes[1] == 0xBB && prettyBytes[2] == 0xBF) ||
    !prettyArticle.Contains("\n  \"schemaVersion\": 6", StringComparison.Ordinal) ||
    !prettyArticle.Contains("中文标题", StringComparison.Ordinal) ||
    !prettyArticle.EndsWith('\n') ||
    !JsonNode.DeepEquals(JsonNode.Parse(compactArticle), JsonNode.Parse(prettyArticle)))
    throw new Exception("Exported article JSON must use readable two-space indentation without changing its data.");
Console.WriteLine("PASS exported article JSON is pretty-printed UTF-8 without BOM and preserves its data");

// Validate the staged ZIP before the final destination is replaced.
var exportType = bridgeType.Assembly.GetType("EnglishCards.ZipExportService", throwOnError: true)!;
var getExportDestination = exportType.GetMethod("GetDestinationPath", BindingFlags.Static | BindingFlags.NonPublic)
    ?? throw new Exception("Card-relative ZIP destination resolution is missing.");
var exportPathTestDirectory = Directory.CreateTempSubdirectory("EnglishCards-export-path-test-");
try
{
    var sourceJson = Path.Combine(exportPathTestDirectory.FullName, "Nested", "My Article.json");
    var expectedZip = Path.Combine(exportPathTestDirectory.FullName, "Nested", "My Article.zip");
    var actualZip = (string)getExportDestination.Invoke(null, [sourceJson])!;
    if (!string.Equals(actualZip, expectedZip, StringComparison.OrdinalIgnoreCase))
        throw new Exception("ZIP export must use the active JSON directory and basename.");
    bool invalidExtensionRejected = false;
    try { getExportDestination.Invoke(null, [Path.Combine(exportPathTestDirectory.FullName, "article.txt")]); }
    catch (TargetInvocationException error) when (error.InnerException is InvalidDataException) { invalidExtensionRejected = true; }
    if (!invalidExtensionRejected) throw new Exception("Card-relative ZIP export must reject non-JSON paths.");
    Console.WriteLine("PASS ZIP destination uses the active JSON directory and basename");
}
finally { exportPathTestDirectory.Delete(recursive: true); }

var validateArchive = exportType.GetMethod("ValidateArchiveAsync", BindingFlags.Static | BindingFlags.NonPublic)!;
Task ValidateArchive(string path, int pages, int width, int height) =>
    (Task)validateArchive.Invoke(null, [path, pages, width, height, CancellationToken.None])!;

byte[] ValidPng() => Convert.FromBase64String(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==");

async Task WriteTestArchive(string path, byte[] png, string article = """{"schemaVersion":6,"id":"test","title":"test","identityTag":"","content":{"paragraphs":[]},"vocabulary":[],"translation":{"paragraphs":[]}}""")
{
    await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
    using var archive = new ZipArchive(file, ZipArchiveMode.Create, leaveOpen: true);
    var articleEntry = archive.CreateEntry("article.json");
    await using (var stream = articleEntry.Open())
        await stream.WriteAsync(Encoding.UTF8.GetBytes(article));
    var imageEntry = archive.CreateEntry("images/page-001.png");
    await using (var stream = imageEntry.Open())
        await stream.WriteAsync(png);
}

var archiveTestDirectory = Directory.CreateTempSubdirectory("EnglishCards-zip-validation-test-");
try
{
    var validArchive = Path.Combine(archiveTestDirectory.FullName, "valid.zip");
    await WriteTestArchive(validArchive, ValidPng());
    await ValidateArchive(validArchive, 1, 1, 1);

    var invalidSignature = Path.Combine(archiveTestDirectory.FullName, "invalid-signature.zip");
    var invalidPng = ValidPng();
    invalidPng[0] = 0;
    await WriteTestArchive(invalidSignature, invalidPng);
    bool signatureRejected = false;
    try { await ValidateArchive(invalidSignature, 1, 1, 1); }
    catch (InvalidDataException) { signatureRejected = true; }
    if (!signatureRejected) throw new Exception("ZIP validation must reject a non-PNG page payload.");

    var wrongDimensions = Path.Combine(archiveTestDirectory.FullName, "wrong-dimensions.zip");
    await WriteTestArchive(wrongDimensions, ValidPng());
    bool dimensionsRejected = false;
    try { await ValidateArchive(wrongDimensions, 1, 2, 1); }
    catch (InvalidDataException) { dimensionsRejected = true; }
    if (!dimensionsRejected) throw new Exception("ZIP validation must reject a PNG with unexpected dimensions.");

    var truncated = Path.Combine(archiveTestDirectory.FullName, "truncated.zip");
    await WriteTestArchive(truncated, ValidPng()[..23]);
    bool truncatedRejected = false;
    try { await ValidateArchive(truncated, 1, 1, 1); }
    catch (InvalidDataException) { truncatedRejected = true; }
    if (!truncatedRejected) throw new Exception("ZIP validation must reject a truncated PNG header.");

    var invalidArticle = Path.Combine(archiveTestDirectory.FullName, "invalid-article.zip");
    await WriteTestArchive(invalidArticle, ValidPng(), """{"schemaVersion":"6"}""");
    bool articleRejected = false;
    try { await ValidateArchive(invalidArticle, 1, 1, 1); }
    catch (InvalidDataException) { articleRejected = true; }
    if (!articleRejected) throw new Exception("ZIP validation must reject an invalid article schema version.");

    var malformedArticle = Path.Combine(archiveTestDirectory.FullName, "malformed-article.zip");
    await WriteTestArchive(malformedArticle, ValidPng(),
        """{"schemaVersion":6,"id":"x","title":"missing required fields"}""");
    bool malformedArticleRejected = false;
    try { await ValidateArchive(malformedArticle, 1, 1, 1); }
    catch (InvalidDataException) { malformedArticleRejected = true; }
    if (!malformedArticleRejected) throw new Exception("ZIP validation must reject Article v6 documents with missing required fields.");

    Console.WriteLine("PASS ZIP validation checks PNG signature, dimensions and reads the complete entry");
    Console.WriteLine("PASS ZIP validation rejects truncated images and invalid article schema");
}
finally { archiveTestDirectory.Delete(recursive: true); }


// The WPF boundary must validate the complete Article v6 contract, not only its version number.
var articleValidatorType = bridgeType.Assembly.GetType("EnglishCards.ArticleContractValidator", throwOnError: true)!;
var validateArticle = articleValidatorType.GetMethod("Validate", BindingFlags.Static | BindingFlags.NonPublic)!;
const string validArticleV6 = """{"schemaVersion":6,"id":"x","title":"Article","identityTag":"","content":{"paragraphs":[{"id":"p001","text":"Body"}]},"vocabulary":[{"id":"v001","word":"run","ipa":"/rʌn/","highlight":["run"],"senses":[{"pos":"v.","meaning":"跑","example":"Run fast.","exampleTranslation":"快跑。"}]}],"translation":{"paragraphs":[{"id":"p001","text":"正文"}]}}""";

void ValidateArticle(string json)
{
    using var parsed = JsonDocument.Parse(json);
    validateArticle.Invoke(null, [parsed.RootElement]);
}
void ExpectArticleRejected(string json, string scenario)
{
    bool rejected = false;
    try { ValidateArticle(json); }
    catch (TargetInvocationException error) when (error.InnerException is InvalidDataException) { rejected = true; }
    if (!rejected) throw new Exception($"Article v6 validator must reject {scenario}.");
}

ValidateArticle(validArticleV6);
ExpectArticleRejected("""{"schemaVersion":5,"id":"x","title":"","identityTag":"","content":{"paragraphs":[]},"vocabulary":[],"translation":{"paragraphs":[]}}""", "v5 schema");
ExpectArticleRejected(validArticleV6.Replace("\"identityTag\":\"\"", "\"identityTag\":\"\",\"mainIdea\":\"legacy\"", StringComparison.Ordinal), "legacy fields");
ExpectArticleRejected(validArticleV6.Replace("\"id\":\"p001\"", "\"id\":\"p002\"", StringComparison.Ordinal), "non-sequential paragraph IDs");
ExpectArticleRejected(validArticleV6.Replace("\"id\":\"v001\"", "\"id\":\"v002\"", StringComparison.Ordinal), "non-sequential vocabulary IDs");
var duplicateVocabularyArticle = JsonNode.Parse(validArticleV6)!.AsObject();
var duplicateVocabulary = duplicateVocabularyArticle["vocabulary"]!.AsArray();
var duplicateEntry = duplicateVocabulary[0]!.DeepClone().AsObject();
duplicateEntry["id"] = "v002";
duplicateEntry["word"] = "RUN";
duplicateVocabulary.Add(duplicateEntry);
ExpectArticleRejected(duplicateVocabularyArticle.ToJsonString(), "duplicate vocabulary entries");
var tooManyParagraphs = JsonNode.Parse(validArticleV6)!.AsObject();
var paragraphArray = tooManyParagraphs["content"]!["paragraphs"]!.AsArray();
for (int i = 2; i <= 1000; i++)
    paragraphArray.Add(new JsonObject { ["id"] = $"p{i:000}", ["text"] = $"p{i}" });
ExpectArticleRejected(tooManyParagraphs.ToJsonString(), "the 1000th paragraph");
Console.WriteLine("PASS WPF Article v6 boundary validates complete schema, canonical IDs, duplicate vocabulary and paragraph limits");


// Phase E: only absolute JSON paths are eligible for file-backed cards.
// Directory listing is deliberately shallow and does not index nested cards.
var bridgeFlags = BindingFlags.Static | BindingFlags.NonPublic;
var validateCardPath = bridgeType.GetMethod("ValidateCardPath", bridgeFlags)
    ?? throw new Exception("Phase E card path validation is missing.");
var listCardDirectory = bridgeType.GetMethod("ListCardDirectory", bridgeFlags)
    ?? throw new Exception("Phase E lazy directory listing is missing.");
var cardDirectory = Directory.CreateTempSubdirectory("EnglishCards-card-library-");
try
{
    var cardFile = Path.Combine(cardDirectory.FullName, "A.json");
    await File.WriteAllTextAsync(cardFile, compactArticle);
    await File.WriteAllTextAsync(Path.Combine(cardDirectory.FullName, "ignore.txt"), "ignore");
    var childDirectory = Directory.CreateDirectory(Path.Combine(cardDirectory.FullName, "nested"));
    await File.WriteAllTextAsync(Path.Combine(childDirectory.FullName, "nested.json"), compactArticle);

    if ((string)validateCardPath.Invoke(null, [cardFile])! != Path.GetFullPath(cardFile))
        throw new Exception("Absolute JSON card paths must be normalized.");
    bool invalidPathRejected = false;
    try { validateCardPath.Invoke(null, [Path.Combine(cardDirectory.FullName, "ignore.txt")]); }
    catch (TargetInvocationException error) when (error.InnerException is InvalidDataException)
    { invalidPathRejected = true; }
    if (!invalidPathRejected) throw new Exception("Non-JSON card paths must be rejected.");

    var listing = listCardDirectory.Invoke(null, [cardDirectory.FullName])!;
    var files = (System.Collections.IEnumerable)listing.GetType().GetProperty("files")!.GetValue(listing)!;
    var folders = (System.Collections.IEnumerable)listing.GetType().GetProperty("folders")!.GetValue(listing)!;
    var fileNames = files.Cast<object>().Select(item =>
        (string)item.GetType().GetProperty("name")!.GetValue(item)!).ToArray();
    if (!fileNames.SequenceEqual(["A.json"]) || folders.Cast<object>().Count() != 1)
        throw new Exception("Card directory listing must return only immediate JSON files and folders.");
    Console.WriteLine("PASS Phase E validated JSON paths and shallow card library listing");
}
finally { cardDirectory.Delete(recursive: true); }


// Phase E: new-card creation must never overwrite existing files, including races.
var writeNewCard = bridgeType.GetMethod("WriteNewCardAsync", BindingFlags.Static | BindingFlags.NonPublic)
    ?? throw new Exception("Phase E exclusive card creation primitive is missing.");
Task CreateNewCard(string path, string json) =>
    (Task)writeNewCard.Invoke(null, [path, json])!;
var newCardDirectory = Directory.CreateTempSubdirectory("EnglishCards-new-card-test-");
try
{
    var existing = Path.Combine(newCardDirectory.FullName, "Existing.json");
    var created = Path.Combine(newCardDirectory.FullName, "New.json");
    await File.WriteAllTextAsync(existing, "ORIGINAL");
    await CreateNewCard(created, compactArticle);
    if (await File.ReadAllTextAsync(created) != compactArticle)
        throw new Exception("New-card creation must write the complete JSON snapshot.");
    bool collisionRejected = false;
    try { await CreateNewCard(existing, compactArticle); }
    catch (IOException) { collisionRejected = true; }
    if (!collisionRejected || await File.ReadAllTextAsync(existing) != "ORIGINAL")
        throw new Exception("Existing JSON must remain byte-identical when creation conflicts.");
    if (Directory.GetFiles(newCardDirectory.FullName, "*.tmp").Length != 0)
        throw new Exception("New-card staging files must be removed after creation or failure.");
    Console.WriteLine("PASS Phase E new-card creation is exclusive and cleans temporary files");
}
finally { newCardDirectory.Delete(recursive: true); }
