using System.IO;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace EnglishCards;

internal sealed class LocalWebContent(CoreWebView2Environment environment, string uiFolder)
{
    private const string Host = "englishcards.invalid";
    private const string Origin = "https://" + Host + "/";
    internal const string EditorSource = Origin + "index.html";
    internal string RuntimeVersion => environment.BrowserVersionString;

    internal async Task LoadAsync(WebView2 view, string file, CancellationToken ct, Action<CoreWebView2>? configure = null)
    {
        await view.EnsureCoreWebView2Async(environment).WaitAsync(ct);
        var web = view.CoreWebView2;
        web.SetVirtualHostNameToFolderMapping(Host, uiFolder,
            CoreWebView2HostResourceAccessKind.Deny);
        web.NavigationStarting += (_, args) => args.Cancel = !IsLocalOrigin(args.Uri);
        web.NewWindowRequested += (_, args) => args.Handled = true;
        web.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
        web.WebResourceRequested += (_, args) =>
        {
            if (!IsLocalOrigin(args.Request.Uri))
                args.Response = environment.CreateWebResourceResponse(null, 403, "Local content only", "");
        };
        configure?.Invoke(web);

        var target = new Uri(Origin + file, UriKind.Absolute);
        ulong? targetNavigationId = null;
        var loaded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnStarting(object? sender, CoreWebView2NavigationStartingEventArgs args)
        {
            if (IsLocalOrigin(args.Uri) &&
                Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) &&
                uri == target)
                targetNavigationId = args.NavigationId;
        }
        void OnLoaded(object? sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            if (targetNavigationId is null || args.NavigationId != targetNavigationId.Value)
                return;
            if (!args.IsSuccess)
                loaded.TrySetException(new InvalidOperationException($"Could not load {file}: {args.WebErrorStatus}"));
            else if (!Uri.TryCreate(web.Source, UriKind.Absolute, out var current) || current != target)
                loaded.TrySetException(new InvalidOperationException($"Could not load the expected local page: {file}."));
            else
                loaded.TrySetResult();
        }
        web.NavigationStarting += OnStarting;
        web.NavigationCompleted += OnLoaded;
        try
        {
            web.Navigate(target.AbsoluteUri);
            await loaded.Task.WaitAsync(ct);
        }
        finally
        {
            web.NavigationStarting -= OnStarting;
            web.NavigationCompleted -= OnLoaded;
        }
    }

    internal static bool IsLocalOrigin(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(uri.Host, Host, StringComparison.OrdinalIgnoreCase) &&
        uri.Port == 443 &&
        string.IsNullOrEmpty(uri.UserInfo);

    internal static async Task<JsonElement> EvaluateAsync(CoreWebView2 web, string expression, CancellationToken ct)
    {
        var args = JsonSerializer.Serialize(new { expression, awaitPromise = true, returnByValue = true });
        using var document = JsonDocument.Parse(await web.CallDevToolsProtocolMethodAsync("Runtime.evaluate", args).WaitAsync(ct));
        var response = document.RootElement;
        if (response.TryGetProperty("exceptionDetails", out var error))
            throw new InvalidOperationException(error.GetRawText());

        var result = response.GetProperty("result");
        return result.TryGetProperty("value", out var value) ? value.Clone() : JsonSerializer.SerializeToElement<object?>(null);
    }
}
