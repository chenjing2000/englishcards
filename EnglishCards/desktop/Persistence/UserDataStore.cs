using System.IO;

namespace EnglishCards;

internal sealed class UserDataStore(string root)
    : IDisposable
{
    private string SettingsPath => Path.Combine(root, "settings", "settings.json");
    private string DraftPath => Path.Combine(root, "drafts", "draft.json");
    private string? rejectedSettings;
    private string? rejectedDraft;
    private bool rejectedDraftUnavailable;
    private FileStream? instanceLease;
    internal string ProfilePath => Path.Combine(root, "cache", "WebView2");

    internal void AcquireInstanceLease()
    {
        InitializeDirectories();
        try
        {
            instanceLease = new FileStream(Path.Combine(root, ".instance.lock"), FileMode.OpenOrCreate,
                FileAccess.ReadWrite, FileShare.None);
        }
        catch (IOException error)
        {
            if ((error.HResult & 0xFFFF) is 32 or 33)
                throw new IOException("EnglishCards 已经在运行。请先关闭另一个窗口后再启动。", error);
            throw;
        }
    }

    internal string LibraryRootPath => root;
    internal string ProjectsPath => Path.Combine(root, "projects");
    internal string ExportsPath => Path.Combine(root, "exports");
    internal string TempPath => Path.Combine(root, "temp");

    private void InitializeDirectories()
    {
        try
        {
            foreach (var path in new[] { root, ProjectsPath, Path.GetDirectoryName(SettingsPath)!,
                Path.GetDirectoryName(DraftPath)!, ExportsPath, TempPath,
                Path.Combine(root, "logs"), Path.GetDirectoryName(ProfilePath)! })
                Directory.CreateDirectory(path);
            var probe = Path.Combine(root, $".write-test-{Guid.NewGuid():N}");
            using (File.Create(probe)) { }
            File.Delete(probe);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new IOException($"无法创建或写入程序目录下的 userdata 文件夹：{root}。请将程序放在有写权限的目录。", error);
        }
    }

    public void Dispose() => instanceLease?.Dispose();

    internal Task<string?> LoadSettingsAsync() => ReadAsync(SettingsPath);
    internal Task<string?> LoadDraftAsync() => ReadAsync(DraftPath);

    private static async Task<string?> ReadAsync(string path)
    {
        try { return await File.ReadAllTextAsync(path); }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }
    }

    internal async Task<bool> SaveSettingsAsync(string text, bool preserveOriginal)
    {
        if (preserveOriginal && rejectedSettings is null) rejectedSettings = await PreserveAsync(SettingsPath);
        await SaveAsync(SettingsPath, text);
        return true;
    }

    internal async Task<bool> SaveDraftAsync(string text, bool preserveOriginal)
    {
        bool originalMissing = false;
        if (preserveOriginal && rejectedDraft is null && !rejectedDraftUnavailable)
        {
            rejectedDraft = await PreserveAsync(DraftPath);
            originalMissing = rejectedDraft is null;
        }
        await SaveAsync(DraftPath, text);
        if (originalMissing) rejectedDraftUnavailable = true;
        return true;
    }

    private Task SaveAsync(string path, string text)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        return WriteAtomicallyAsync(path, text);
    }

    private static async Task<string?> PreserveAsync(string path)
    {
        FileStream input;
        try { input = File.OpenRead(path); }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }

        var backup = Path.Combine(Path.GetDirectoryName(path)!, $"{Path.GetFileNameWithoutExtension(path)}.rejected-{Guid.NewGuid():N}.json");
        await using (input)
            await StageAndMoveAsync(backup, stream => input.CopyToAsync(stream));
        return backup;
    }

    internal void EnsureRejectedDraftAvailable()
    {
        if (rejectedDraftUnavailable || !File.Exists(rejectedDraft ?? DraftPath))
            throw new IOException("原始草稿已不存在，无法另存。");
    }

    internal Task ExportRejectedDraftAsync(string destination)
    {
        EnsureRejectedDraftAvailable();
        if (string.Equals(destination, SettingsPath, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(destination, DraftPath, StringComparison.OrdinalIgnoreCase))
            throw new IOException("请选择其他位置另存原始草稿。");
        return CopyAtomicallyAsync(rejectedDraft ?? DraftPath, destination);
    }

    internal static Task WriteAtomicallyAsync(string path, string text) =>
        StageAndMoveAsync(path, async stream =>
        {
            await using var writer = new StreamWriter(stream, leaveOpen: true);
            await writer.WriteAsync(text);
        });

    private static Task CopyAtomicallyAsync(string source, string destination) =>
        StageAndMoveAsync(destination, async stream =>
        {
            await using var input = File.OpenRead(source);
            await input.CopyToAsync(stream);
        });

    private static async Task StageAndMoveAsync(string path, Func<Stream, Task> write)
    {
        // If a file appears while staging a new document, leave it in place.
        bool overwrite = File.Exists(path);
        var temporary = Path.Combine(Path.GetDirectoryName(path)!, $".englishcards-{Guid.NewGuid():N}.tmp");
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                             bufferSize: 4096, useAsync: true))
                await write(stream);
            File.Move(temporary, path, overwrite);
        }
        finally
        {
            try { File.Delete(temporary); }
            catch (IOException) { /* Preserve the original write failure. */ }
            catch (UnauthorizedAccessException) { /* Preserve the original write failure. */ }
        }
    }
}
