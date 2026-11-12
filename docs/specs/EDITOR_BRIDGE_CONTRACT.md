# Editor Bridge Contract

## Authority and scope

This document describes the WPF/WebView2 message boundary and the current Article v6 desktop workflow. The current implementation reference is `EnglishCards/desktop/Web/EditorBridge.cs`; the frontend request wrapper is `EnglishCards/frontend/src/services/desktopBridge.ts`.

The bridge is an internal host boundary, not a declaration that every registered command is part of the current user-facing workflow. The Card Library and paired-save workflow in [PHASE_E_CARD_LIBRARY.md](PHASE_E_CARD_LIBRARY.md) and [COMBINED_ARTICLE_SAVE.md](COMBINED_ARTICLE_SAVE.md) define the current user behavior.

## Trust boundary

- WPF owns filesystem access, native dialogs, user-data persistence and ZIP generation.
- React requests only named host operations through WebView2 messages.
- The host accepts messages only from the local editor origin `https://englishcards.invalid/`.
- Do not expose arbitrary filesystem access, shell execution, generic method invocation or unrestricted URL navigation.
- Navigation and new-window requests remain restricted to local content.
- Article content crossing the bridge must be validated as strict Article schemaVersion 6 at the host boundary.

## Request and response envelope

Example request:

```json
{"id":1,"command":"loadSettings","payload":null}
```

- `id`: positive integer used to correlate the response.
- `command`: allow-listed command name.
- `payload`: operation-specific JSON value, validated by the host.
- Success: `{ "id": 1, "ok": true, "value": ... }`.
- Failure: `{ "id": 1, "ok": false, "error": "..." }`.

## Current Card Library and paired-save commands

| Command | Payload | Host responsibility |
|---|---|---|
| `openCardFile` | absolute JSON path string | Read the selected file, parse JSON and validate Article v6; return path, text and content fingerprint |
| `activateCardFile` | `{path, fingerprint}` | Re-read and fingerprint-check the file before recording active file identity |
| `saveCardFile` | `{path, text}` | Verify active path and on-disk fingerprint, validate Article v6 and atomically save the file |
| `listCardDirectory` | directory path string | List immediate child directories and JSON files |
| `chooseCardLibrary` | `null` | Show native folder picker |
| `defaultCardLibrary` | `null` | Return executable-adjacent default library root |
| `lastCardLibrary` | `null` | Read last successfully remembered library folder |
| `saveLastCardLibrary` | directory path string | Persist the successful library folder |
| `chooseArticlePairTarget` | proposed JSON filename string | Show native folder picker and return target JSON path, folder and existing pair members |
| `saveArticlePair` | `{fileName, document, path, overwriteApproved}` | Validate Article v6 and save matching JSON + ZIP pair through the export service |
| `loadSettings` | `null` | Read settings from EXE-sibling `userdata/` |
| `saveSettings` | `{text, preserveOriginal}` | Validate and persist settings |

The paired-save command must receive one complete Article v6 document. The host must not trust a caller-supplied path without validating it, and overwrite must be explicitly approved by the frontend after the user confirms the shared overwrite dialog.

## Removed desktop commands

The current `EditorBridge.cs` command switch does **not** register `openProject`, `saveProject`, `loadDraft`, `saveDraft`, `saveRejectedDraft` or `exportAllZip`. These historical names must not be treated as available host operations. Browser-only development workflows are separate from the desktop bridge.

## Ordering and navigation

- File commands are serialized by a task tail to preserve order.
- The navigation generation is captured when a message arrives; stale-page responses must not be delivered to a later page.
- Yield the dispatcher before showing native modal dialogs.
- Do not post a response to a disposed or no-longer-current WebView.
- The frontend must block card switching while its save coordinator reports dirty/saving/error. A blocked click is discarded, not queued.

## Required checks for bridge changes

Test unknown commands, missing/wrong payload fields, malformed JSON, invalid IDs, wrong source origin, stale navigation, dialog cancellation, I/O failure, external file modification, overwrite approval changes, paired-save rollback and WebView disposal. Event-boundary asynchronous handlers must observe and contain exceptions. Keep filesystem authority in WPF.

## WebView2 origin and navigation lifecycle

- Local navigation and resource requests must use an absolute URI with HTTPS, host `englishcards.invalid`, port 443 and no user information.
- Prefix string comparisons are not the origin authority; use parsed URI components.
- A `LoadAsync` call completes only for the `NavigationCompleted` event whose `NavigationId` matches the navigation it initiated and whose final source is the expected local page.
- Cancellation of a `WaitAsync` wrapper does not cancel the underlying WebView2 initialization or DevTools operation. Callers must dispose/retire the associated WebView2 instance when abandoning work; do not assume the underlying operation was cancelled.
