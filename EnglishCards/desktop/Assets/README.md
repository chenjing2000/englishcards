# Application icon

Place the supplied multi-size ICO at:

`EnglishCards/desktop/Assets/clover_icon.ico`

The WPF project uses this single asset for the executable icon and the main window/taskbar icon. The project keeps a Windows fallback icon when the asset is not present, so frontend and unit-test workflows remain buildable before the binary is added.

The ICO should retain its 16, 32, 48, 128 and 256 px images.
