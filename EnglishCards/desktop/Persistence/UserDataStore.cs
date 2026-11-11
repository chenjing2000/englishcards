using System.IO;

namespace EnglishCards;

internal sealed class UserDataStore(string root)
    : IDisposable
{
    private string SettingsPath => Path.Combine(root, "settings", "settings.json");
    private string LastLibraryFolderPath => Path.Combine(root, "settings", "last-library-folder.txt");
    private string? rejectedSettings;
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
    internal string ExportsPath => Path.Combine(root, "exports");
    internal string TempPath => Path.Combine(root, "temp");

    private void InitializeDirectories()
    {
        try
        {
            foreach (var path in new[] { root, Path.GetDirectoryName(SettingsPath)!,
                ExportsPath, TempPath, Path.Combine(root, "logs"), Path.GetDirectoryName(ProfilePath)! })
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

    internal Task<string> LoadLastLibraryFolderAsync() => LoadDirectoryPreferenceAsync(LastLibraryFolderPath);

    internal Task SaveLastLibraryFolderAsync(string path) =>
        SaveDirectoryPreferenceAsync(LastLibraryFolderPath, path);

    private async Task<string> LoadDirectoryPreferenceAsync(string path)
    {
        try
        {
            var saved = (await File.ReadAllTextAsync(path)).Trim();
            if (!string.IsNullOrWhiteSpace(saved))
            {
                var fullPath = Path.GetFullPath(saved);
                if (Directory.Exists(fullPath)) return fullPath;
            }
        }
        catch (FileNotFoundException) { }
        catch (DirectoryNotFoundException) { }
        catch (ArgumentException) { }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        catch (NotSupportedException) { }

        return root;
    }

    private async Task SaveDirectoryPreferenceAsync(string path, string directory)
    {
        var fullPath = Path.GetFullPath(directory);
        if (!Directory.Exists(fullPath))
            throw new DirectoryNotFoundException($"目录不存在，无法记住该路径：{fullPath}");
        await SaveAsync(path, fullPath);
    }

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

    internal static Task WriteAtomicallyAsync(string path, string text) =>
        StageAndMoveAsync(path, async stream =>
        {
            await using var writer = new StreamWriter(stream, leaveOpen: true);
            await writer.WriteAsync(text);
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
