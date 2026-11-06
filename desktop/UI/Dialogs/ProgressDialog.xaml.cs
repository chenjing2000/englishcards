using System.ComponentModel;
using System.Windows;

namespace EnglishCards;

/// <summary>A reusable, owner-centered progress dialog for long-running desktop operations.</summary>
public partial class ProgressDialog : Window
{
    private readonly Action requestCancellation;
    private bool cancellationRequested;
    private bool allowClose;

    internal ProgressDialog(Window owner, string title, Action requestCancellation)
    {
        InitializeComponent();
        Owner = owner;
        TitleText.Text = title;
        this.requestCancellation = requestCancellation;
        CancelButton.Click += (_, _) => RequestCancellation();
        CloseButton.Click += (_, _) => RequestCancellation();
        Closing += HandleClosing;
    }

    internal void SetIndeterminate(string status, string? detail = null)
    {
        if (cancellationRequested) return;
        StatusText.Text = status;
        DetailText.Text = detail ?? string.Empty;
        ProgressIndicator.IsIndeterminate = true;
    }

    internal void SetProgress(string status, double progress, string? detail = null)
    {
        if (cancellationRequested) return;
        StatusText.Text = status;
        DetailText.Text = detail ?? string.Empty;
        ProgressIndicator.IsIndeterminate = false;
        ProgressIndicator.Value = Math.Clamp(progress, 0d, 1d) * 100d;
    }

    internal void CloseAfterOperation()
    {
        allowClose = true;
        if (IsVisible) Close();
    }


    internal void RequestCancellationFromOwner() => RequestCancellation();

    private void RequestCancellation()
    {
        if (cancellationRequested || allowClose) return;
        cancellationRequested = true;
        CancelButton.IsEnabled = false;
        CloseButton.IsEnabled = false;
        StatusText.Text = "正在取消……";
        DetailText.Text = "正在停止当前任务并清理临时文件。";
        ProgressIndicator.IsIndeterminate = true;
        requestCancellation();
    }

    private void HandleClosing(object? sender, CancelEventArgs e)
    {
        if (allowClose) return;
        e.Cancel = true;
        RequestCancellation();
    }
}
