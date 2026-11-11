using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Win32;

namespace EnglishCards;

/// <summary>
/// Positions the native shell folder picker over its WPF owner. The CBT hook runs
/// on the dialog's owning UI thread, so HWND coordinates are physical screen
/// coordinates and remain correct across mixed-DPI monitors.
/// </summary>
internal static class FolderDialogPositioning
{
    private const int WhCbt = 5;
    private const int HcbtActivate = 5;
    private const uint GwOwner = 4;
    private const uint GaRootOwner = 3;
    private const uint MonitorDefaultToNearest = 2;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoZOrder = 0x0004;
    private const uint SwpNoActivate = 0x0010;

    private delegate IntPtr HookProcedure(int code, IntPtr wParam, IntPtr lParam);

    internal static bool? ShowDialog(OpenFolderDialog dialog, Window owner)
    {
        var ownerHandle = new WindowInteropHelper(owner).Handle;
        if (ownerHandle == IntPtr.Zero) return dialog.ShowDialog(owner);

        IntPtr hook = IntPtr.Zero;
        HookProcedure callback = (code, window, data) =>
        {
            if (code == HcbtActivate && window != ownerHandle)
            {
                try
                {
                    if (GetWindow(window, GwOwner) == ownerHandle ||
                        GetAncestor(window, GaRootOwner) == ownerHandle)
                        CenterOverOwner(window, ownerHandle);
                }
                catch
                {
                    // Positioning must never prevent the native picker from opening.
                }
            }
            return CallNextHookEx(hook, code, window, data);
        };

        hook = SetWindowsHookEx(WhCbt, callback, IntPtr.Zero, GetCurrentThreadId());
        try
        {
            return dialog.ShowDialog(owner);
        }
        finally
        {
            if (hook != IntPtr.Zero) UnhookWindowsHookEx(hook);
            GC.KeepAlive(callback);
        }
    }

    internal static Point CalculatePosition(Rect ownerBounds, Size dialogSize, Rect workArea)
    {
        var centeredX = ownerBounds.Left + (ownerBounds.Width - dialogSize.Width) / 2;
        var centeredY = ownerBounds.Top + (ownerBounds.Height - dialogSize.Height) / 2;
        var maxX = Math.Max(workArea.Left, workArea.Right - dialogSize.Width);
        var maxY = Math.Max(workArea.Top, workArea.Bottom - dialogSize.Height);
        return new Point(
            Math.Clamp(centeredX, workArea.Left, maxX),
            Math.Clamp(centeredY, workArea.Top, maxY));
    }

    private static void CenterOverOwner(IntPtr dialogHandle, IntPtr ownerHandle)
    {
        if (!GetWindowRect(ownerHandle, out var ownerRect) ||
            !GetWindowRect(dialogHandle, out var dialogRect))
            return;

        var monitor = MonitorFromWindow(ownerHandle, MonitorDefaultToNearest);
        var info = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
        if (monitor == IntPtr.Zero || !GetMonitorInfo(monitor, ref info)) return;

        var ownerBounds = new Rect(ownerRect.Left, ownerRect.Top,
            ownerRect.Right - ownerRect.Left, ownerRect.Bottom - ownerRect.Top);
        var dialogSize = new Size(dialogRect.Right - dialogRect.Left, dialogRect.Bottom - dialogRect.Top);
        var workArea = new Rect(info.Work.Left, info.Work.Top,
            info.Work.Right - info.Work.Left, info.Work.Bottom - info.Work.Top);
        var position = CalculatePosition(ownerBounds, dialogSize, workArea);

        SetWindowPos(dialogHandle, IntPtr.Zero,
            (int)Math.Round(position.X), (int)Math.Round(position.Y),
            0, 0, SwpNoSize | SwpNoZOrder | SwpNoActivate);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        internal int Left;
        internal int Top;
        internal int Right;
        internal int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo
    {
        internal int Size;
        internal NativeRect Monitor;
        internal NativeRect Work;
        internal uint Flags;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProcedure callback, IntPtr module, uint threadId);

    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hook);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr window, uint command);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr window, uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetWindowRect(IntPtr window, out NativeRect rectangle);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);

    [DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", SetLastError = true)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter,
        int x, int y, int width, int height, uint flags);
}
