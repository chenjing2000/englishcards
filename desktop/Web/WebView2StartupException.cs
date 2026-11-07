namespace EnglishCards;

internal sealed class WebView2StartupException(Exception innerException)
    : Exception("无法初始化 Microsoft Edge WebView2。请安装或修复 WebView2 Evergreen Runtime，然后重新启动 EnglishCards。", innerException)
{
    internal const string RuntimeDownloadUrl = "https://developer.microsoft.com/microsoft-edge/webview2/";
}
