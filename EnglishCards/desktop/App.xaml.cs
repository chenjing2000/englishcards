using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;

namespace EnglishCards;

public partial class App : Application
{
    internal static readonly JsonSerializerOptions ReportFormat = new() { WriteIndented = true };

    protected override async void OnStartup(StartupEventArgs args)
    {
        base.OnStartup(args);
        bool verify = args.Args is ["--verify", _, _];
        string? output = verify ? Path.GetFullPath(args.Args[1]) : null;
        try
        {
            if (!verify && args.Args.Length > 0)
                throw new ArgumentException("Usage: EnglishCards.exe [--verify <output-dir> <expected-DPI-or-0>]");
            if (output is not null)
                Directory.CreateDirectory(output);

            var window = new MainWindow();
            MainWindow = window;
            window.Show();
            using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(4));
            string dataRoot = output is null
                ? Path.Combine(AppContext.BaseDirectory, "userdata")
                : Path.Combine(output, $"user-data-{Guid.NewGuid():N}");
            await window.InitializeAsync(dataRoot, saveOnClose: output is null, timeout.Token);
            if (output is null)
                return;

            await window.VerifyAsync(output, int.Parse(args.Args[2]), timeout.Token);
            Shutdown(0);
        }
        catch (WebView2StartupException error) when (output is null)
        {
            Trace.TraceError("EnglishCards WebView2 startup failed: {0}", error);
            var answer = MessageBox.Show(
                $"{error.Message}\n\n微软官方安装与修复入口：\n{WebView2StartupException.RuntimeDownloadUrl}\n\n是否现在打开官方页面？",
                "EnglishCards - WebView2 运行环境", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (answer == MessageBoxResult.Yes)
            {
                try
                {
                    Process.Start(new ProcessStartInfo(WebView2StartupException.RuntimeDownloadUrl) { UseShellExecute = true });
                }
                catch (Exception launchError)
                {
                    MessageBox.Show(
                        $"无法自动打开浏览器。请复制以下地址，在浏览器中手动打开：\n{WebView2StartupException.RuntimeDownloadUrl}\n\n{launchError.Message}",
                        "EnglishCards", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            }
            Shutdown(1);
        }
        catch (Exception error)
        {
            if (output is null)
                MessageBox.Show(error.Message, "EnglishCards", MessageBoxButton.OK, MessageBoxImage.Error);
            else
                await File.WriteAllTextAsync(Path.Combine(output, "verification.json"),
                    JsonSerializer.Serialize(new { error = error.ToString() }, ReportFormat));
            Shutdown(1);
        }
    }
}
