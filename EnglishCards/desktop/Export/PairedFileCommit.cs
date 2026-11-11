using System.IO;

namespace EnglishCards;

/// <summary>
/// Commits an already-validated JSON + ZIP pair. Both staged files must reside on
/// the destination volume. Two file renames are not a filesystem transaction, so
/// old targets are backed up first and restored on recoverable failures.
/// </summary>
internal static class PairedFileCommit
{
    internal static async Task CommitAsync(
        string stagedJson, string stagedZip, string targetJson, string targetZip,
        bool overwriteApproved, CancellationToken ct = default)
    {
        if (string.Equals(targetJson, targetZip, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("JSON and ZIP destinations must be different.");
        if (!File.Exists(stagedJson) || !File.Exists(stagedZip))
            throw new FileNotFoundException("The complete staged article pair is required.");
        if (!string.Equals(Path.GetDirectoryName(stagedJson), Path.GetDirectoryName(targetJson),
            StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(Path.GetDirectoryName(stagedZip), Path.GetDirectoryName(targetZip),
            StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Staging files must share the destination directory.");
        if (File.Exists(targetJson) || File.Exists(targetZip))
        {
            if (!overwriteApproved)
                throw new IOException("Existing files require explicit overwrite approval.");
        }

        string? backupJson = null, backupZip = null;
        bool committedJson = false, committedZip = false;
        bool restoredJson = false, restoredZip = false;
        string suffix = Guid.NewGuid().ToString("N");
        try
        {
            ct.ThrowIfCancellationRequested();
            // Copy rather than move: the originals remain in place until all
            // backup copies are complete. This also handles a locked target safely.
            if (File.Exists(targetJson))
            {
                backupJson = Path.Combine(Path.GetDirectoryName(targetJson)!, $".englishcards-{suffix}.json.bak");
                File.Copy(targetJson, backupJson, overwrite: false);
            }
            if (File.Exists(targetZip))
            {
                backupZip = Path.Combine(Path.GetDirectoryName(targetZip)!, $".englishcards-{suffix}.zip.bak");
                File.Copy(targetZip, backupZip, overwrite: false);
            }
            ct.ThrowIfCancellationRequested();
            File.Move(stagedJson, targetJson, overwrite: backupJson is not null);
            committedJson = true;
            ct.ThrowIfCancellationRequested();
            File.Move(stagedZip, targetZip, overwrite: backupZip is not null);
            committedZip = true;
        }
        catch
        {
            // Restore in reverse order. Never remove a backup before restoring it.
            // If rollback itself fails, retain the backup for manual recovery.
            try
            {
                if (committedZip) { Restore(targetZip, backupZip); restoredZip = true; }
                if (committedJson) { Restore(targetJson, backupJson); restoredJson = true; }
            }
            catch (Exception restoreError)
            {
                // Preserve any .bak files and make the incomplete rollback visible.
                throw new IOException("Paired save failed and automatic rollback also failed; recovery backups were retained.", restoreError);
            }
            throw;
        }
        finally
        {
            TryDelete(stagedJson);
            TryDelete(stagedZip);
            if (committedJson && committedZip)
            {
                TryDelete(backupJson);
                TryDelete(backupZip);
            }
            else
            {
                if (restoredJson || !committedJson) TryDelete(backupJson);
                if (restoredZip || !committedZip) TryDelete(backupZip);
            }
        }
        await Task.CompletedTask;
    }

    private static void Restore(string destination, string? backup)
    {
        if (backup is null)
        {
            File.Delete(destination);
            return;
        }
        // File.Move is same-volume, and the backup remains if this replacement fails.
        File.Move(backup, destination, overwrite: true);
    }

    private static void TryDelete(string? path)
    {
        if (path is null) return;
        try { File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
