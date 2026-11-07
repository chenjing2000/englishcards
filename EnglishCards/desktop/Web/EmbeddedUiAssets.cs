using System.IO;
using System.Reflection;

namespace EnglishCards;

/// <summary>Version-isolated extraction of immutable assets embedded in the single-file app.</summary>
internal static class EmbeddedUiAssets
{
    private const string Prefix = "ECUI/";

    internal static string ExtractToCache(string userDataRoot)
    {
        var assembly = typeof(EmbeddedUiAssets).Assembly;
        // MVID changes whenever the executable's managed module changes.
        var version = assembly.ManifestModule.ModuleVersionId.ToString("N");
        var parent = Path.Combine(userDataRoot, "cache", "ui");
        var destination = Path.Combine(parent, version);
        if (File.Exists(Path.Combine(destination, ".complete")) &&
            File.Exists(Path.Combine(destination, "index.html")) &&
            File.Exists(Path.Combine(destination, "render.html")))
            return destination;

        var resources = assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith(Prefix, StringComparison.Ordinal)).ToArray();
        if (resources.Length == 0)
            throw new FileNotFoundException("发布程序没有内嵌的 React 资源。请先执行 npm.cmd run build，然后重新执行 dotnet publish。");
        Directory.CreateDirectory(parent);
        var staging = Path.Combine(parent, $".extract-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(staging);
            foreach (var name in resources)
            {
                var relative = name[Prefix.Length..].Replace('/', Path.DirectorySeparatorChar);
                var target = Path.GetFullPath(Path.Combine(staging, relative));
                if (!target.StartsWith(Path.GetFullPath(staging) + Path.DirectorySeparatorChar,
                    StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("内嵌资源路径非法。");
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                using var input = assembly.GetManifestResourceStream(name) ?? throw new FileNotFoundException(name);
                using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                input.CopyTo(output);
            }
            if (!File.Exists(Path.Combine(staging, "index.html")) || !File.Exists(Path.Combine(staging, "render.html")))
                throw new InvalidDataException("内嵌资源缺少 index.html 或 render.html。");
            File.WriteAllText(Path.Combine(staging, ".complete"), version);
            if (Directory.Exists(destination)) Directory.Delete(destination, recursive: true);
            Directory.Move(staging, destination);
            return destination;
        }
        finally
        {
            if (Directory.Exists(staging)) Directory.Delete(staging, recursive: true);
        }
    }
}
