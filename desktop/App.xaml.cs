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
