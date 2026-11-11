using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Imaging;
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
    private HwndSource? windowSource;
    public MainWindow()
    {
        InitializeComponent();
        ApplyWindowIcon();
    }

    private void ApplyWindowIcon()
    {
        try
        {
            var resource = Application.GetResourceStream(new Uri(
                "pack://application:,,,/EnglishCards;component/Assets/clover_icon.ico", UriKind.Absolute));
            if (resource is null) return;
            using (resource.Stream)
                Icon = BitmapFrame.Create(resource.Stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
        }
        catch (IOException error)
        {
            // The source icon is supplied as a separate project asset; retain the Windows fallback until it is present.
            Trace.TraceWarning("EnglishCards application icon could not be loaded: {0}", error);
        }
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        windowSource = PresentationSource.FromVisual(this) as HwndSource;
        windowSource?.AddHook(BlockWindowContextMenu);
    }

    private static IntPtr BlockWindowContextMenu(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        // Prevent the native system context menu opened by right-clicking the title bar/window chrome.
        if (message is 0x007B or 0x00A5)
        {
            handled = true;
            return IntPtr.Zero;
        }
        return IntPtr.Zero;
    }

    internal async Task InitializeAsync(string dataRoot, bool saveOnClose, CancellationToken ct)
    {
        this.saveOnClose = saveOnClose;
        var userData = new UserDataStore(dataRoot);
        data = userData;
        userData.AcquireInstanceLease();
        try
        {
            CoreWebView2Environment environment;
            try
            {
                environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userData.ProfilePath).WaitAsync(ct);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                throw new WebView2StartupException(error);
            }

            var uiFolder = EmbeddedUiAssets.ExtractToCache(dataRoot);
            content = new LocalWebContent(environment, uiFolder);
            exporter = new ZipExportService(this, content);
            try
            {
                await content.LoadAsync(Editor, "index.html", ct, web =>
                {
                    web.Settings.AreDefaultContextMenusEnabled = false;
                    web.Settings.IsGeneralAutofillEnabled = false;
                    web.Settings.IsPasswordAutosaveEnabled = false;
                    web.ContextMenuRequested += (_, args) => args.Handled = true;
                    new EditorBridge(this, web, userData, exporter).Attach();
                });
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                throw new WebView2StartupException(error);
            }
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
        windowSource?.RemoveHook(BlockWindowContextMenu);
        windowSource = null;
        try
        {
            Editor.Dispose();
        }
        catch (Exception error)
        {
            // A failed WebView2/browser process must not prevent releasing the single-instance lease.
            Trace.TraceWarning("EnglishCards WebView2 disposal failed during window close: {0}", error);
        }
        finally
        {
            try
            {
                data?.Dispose();
            }
            catch (Exception error)
            {
                Trace.TraceWarning("EnglishCards user-data lease disposal failed during window close: {0}", error);
            }
            finally
            {
                data = null;
                base.OnClosed(e);
            }
        }
    }
}
