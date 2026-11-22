using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;

namespace EnglishCards;

public partial class MainWindow : Window
{
    private LocalWebContent? content;
    private UserDataStore? data;
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
            try
            {
                await content.LoadAsync(Editor, "index.html", ct, web =>
                {
                    web.Settings.AreDefaultContextMenusEnabled = false;
                    web.Settings.IsGeneralAutofillEnabled = false;
                    web.Settings.IsPasswordAutosaveEnabled = false;
                    web.ContextMenuRequested += (_, args) => args.Handled = true;
                    new EditorBridge(this, web, userData).Attach();
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
        ReaderVerification.RunAsync(this, Editor.CoreWebView2, data!, output, expectedDpi, ct);

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
