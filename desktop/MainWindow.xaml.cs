using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;

namespace EnglishCards;

public partial class MainWindow : Window
{
    private LocalWebContent? content;
    private UserDataStore? data;
    private ZipExportService? exporter;
    private bool saveOnClose;
    private bool preparingClose;
    private bool allowClose;
    public MainWindow() => InitializeComponent();

    internal async Task InitializeAsync(string dataRoot, bool saveOnClose, CancellationToken ct)
    {
        this.saveOnClose = saveOnClose;
        var userData = new UserDataStore(dataRoot);
        data = userData;
        userData.AcquireInstanceLease();
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userData.ProfilePath).WaitAsync(ct);
            var uiFolder = EmbeddedUiAssets.ExtractToCache(dataRoot);
            content = new LocalWebContent(environment, uiFolder);
            exporter = new ZipExportService(this, content, userData);
            await content.LoadAsync(Editor, "index.html", ct, web => new EditorBridge(this, web, userData, exporter).Attach());
        }
        catch
        {
            userData.Dispose();
            data = null;
            throw;
        }
    }

    internal Task VerifyAsync(string output, int expectedDpi, CancellationToken ct) =>
        PrototypeVerification.RunAsync(this, Editor, content!, output, expectedDpi, ct);

    protected override async void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        var web = Editor.CoreWebView2;
        if (e.Cancel) return;
        if (exporter?.IsRunning == true)
        {
            e.Cancel = true;
            if (MessageBox.Show(this, "导出仍在进行。是否取消当前导出？完成取消后可再次关闭程序。",
                "EnglishCards", MessageBoxButton.YesNo, MessageBoxImage.Warning) == MessageBoxResult.Yes)
                exporter.Cancel();
            return;
        }
        if (!saveOnClose || allowClose || web is null) return;
        e.Cancel = true;
        if (preparingClose) return;
        preparingClose = true;
        try
        {
            await Dispatcher.Yield(DispatcherPriority.Normal);
            Editor.IsEnabled = false;
            string? failure;
            try
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
                // The page sends its final writes through EditorBridge while this request is awaiting completion.
                var result = await LocalWebContent.EvaluateAsync(web,
                    "window.prepareClose?.() ?? { pending: false, errors: [] }", timeout.Token);
                if (result.TryGetProperty("busy", out var busy) && busy.GetBoolean())
                {
                    MessageBox.Show(this, "请等待当前文件操作完成，再关闭窗口。", "EnglishCards");
                    return;
                }
                var errors = result.GetProperty("errors").EnumerateArray().Select(error => error.GetString()).ToArray();
                failure = errors.Length == 0 ? null : string.Join(Environment.NewLine, errors);
            }
            catch (Exception error) when (error is InvalidOperationException or COMException or JsonException or OperationCanceledException)
            {
                failure = $"无法确认本机数据已保存：{error.Message}";
            }
            if (failure is not null &&
                MessageBox.Show(this, $"{failure}\n\n是否放弃尚未保存的更改并关闭？选择“否”可保留编辑，修正后再次关闭以重试。",
                    "EnglishCards", MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) != MessageBoxResult.Yes)
                return;

            allowClose = true;
            Close();
        }
        finally
        {
            preparingClose = false;
            if (!allowClose) Editor.IsEnabled = true;
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        Editor.Dispose();
        data?.Dispose();
        base.OnClosed(e);
    }
}
