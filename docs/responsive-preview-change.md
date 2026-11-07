# Responsive preview width-constrained zoom change

Date: 2026-11-07

## Product behavior

- Initial split remains 70% preview / 30% editor; each pane is constrained to a 280 DIP minimum. The WPF main window minimum width is set to 600 DIP so both panes and the 8 DIP splitter can coexist.
- Card source dimensions remain 1200 × 1600. Preview height is not used to calculate zoom and does not cap card height. Multiple cards remain vertically stacked and scroll normally.
- The preview viewport has 12 DIP horizontal padding on each side. A card's displayed width must not exceed the resulting available content width. Its height follows the original aspect ratio.
- The effective scale is the smaller of the current requested scale and `min(100%, availablePreviewWidth / 1200)`.
- Ctrl + mouse wheel controls zoom; the middle mouse button is not pressed. Requested zoom is clamped to 20%–100%. Ordinary wheel scrolling continues to scroll the preview vertically.
- If a narrower preview pane forces the current zoom down, the reduced value is committed to the zoom state. Widening the pane does not restore the previous value; the user can enlarge the card again with Ctrl + wheel.
- Cards remain horizontally centered. Horizontal overflow is hidden; vertical scrolling remains enabled. The splitter cannot overlap card content because card wrappers reserve their scaled width and height rather than relying on a visual transform alone.
- The zoom toolbar, percentage label, reset button, and fit-height behavior are removed.
- Preview zoom is presentation-only. Pagination, original card dimensions, PNG capture and ZIP export are unchanged.

## Files changed

- `src/views/CardPreview.tsx`
- `src/views/editor.css`
- `desktop/MainWindow.xaml`
- `tests/e2e/workspace.spec.ts`
- `README.md`
- `docs/project-contract.md`
- `docs/specs/ACCEPTANCE.md`
- `docs/remediation-plan.md`
- `docs/implementation-status.md`
- `docs/CODE_REVIEW_REPORT.md`

## Verification status

- Static source review performed.
- Full npm build, Vitest and Playwright have not been executed in this environment because the archive does not include `node_modules` and registry access is unavailable.
- Windows .NET tests and publish should be run as the final desktop regression check; the WPF minimum window width was also updated.

On Windows, run:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project desktop\EnglishCards.Tests\EnglishCards.Tests.csproj -c Release
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf
```

Afterward, verify width clamping at the 280 DIP minimum, permanent zoom reduction after narrowing and widening the pane, 20% / 100% zoom bounds, vertical scrolling, centering, and unchanged PNG/ZIP output.
