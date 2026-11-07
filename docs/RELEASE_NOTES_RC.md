# EnglishCards — Release Candidate Notes

Date: 2026-11-06  
Label: **Release Candidate**; final semantic version/tag is not yet chosen.

## Product

EnglishCards is a local Windows x64 English close-reading card editor built with WPF (.NET 10), WebView2 and React/TypeScript. It supports article editing, vocabulary and expressions, multi-page preview, local JSON projects and complete ZIP export (`article.json` plus each page's PNG image).

## Reliability improvements completed in seven review rounds

- Documented current project, editor bridge and ZIP export contracts; retained historical documents as historical.
- Isolated WebView2 bridge command exceptions and added coverage for request ordering.
- Reviewed atomic staged persistence, rejected-source protection and concurrent-destination behavior; added regression tests.
- Strengthened ZIP validation of PNG signatures, IHDR and dimensions, and separated resource cleanup failure paths.
- Enforced exact local HTTPS origin checks, navigation completion correlation and close-path lease cleanup.
- Blocked editor/history actions during an asynchronous JSON open while preserving newer-open and failure-recovery behavior.
- Added WebView2 startup failure guidance pointing to Microsoft's Evergreen Runtime.

## Size optimization

- Removed bundled Noto Sans SC and switched Chinese glyphs to Windows font fallback (`Microsoft YaHei UI`, `Microsoft YaHei`, `DengXian`, `sans-serif`).
- Bundled only Nunito Sans Latin / Latin Extended, weights 400 and 800.
- Owner-reported EXE shrank **14.9 MB → 1.9 MB (~87.2%)** with no obvious CJK preview-vs-PNG discrepancy on the tested Windows machine.
- This is an intentional rendering/dependency change; pagination can vary across Windows installations with different system fonts.

## Quality evidence

The final font-optimized source was verified by the project owner on Windows: Vitest 35/35, Playwright 59/59, .NET desktop checks 16/16, TypeScript+Vite build successful, and framework-dependent win-x64 single-file publish successful. Browser E2E is not the same as an independent-machine WPF runtime acceptance test.

## Requirements and known limitations

- Windows x64, .NET 10 **Desktop Runtime** x64 and WebView2 Evergreen Runtime required on the target PC.
- No Node.js, npm, Visual Studio, .NET SDK or standalone Chromium needed by end users.
- The portable `userdata/` directory stays beside the EXE and must not be overwritten or distributed with personal data.
- External clean-machine runtime testing, upgrade preservation tests, and assets redistribution-rights review remain open; see [`RELEASE_ACCEPTANCE.md`](RELEASE_ACCEPTANCE.md).
- Release version needs a final decision: historical `v0.1.0` discussion versus npm package version `1.0.0`.

No Git commit, push, tag, or GitHub Release was performed as part of this handoff.
