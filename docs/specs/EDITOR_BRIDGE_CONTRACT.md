# Editor Bridge Contract

## Authority and scope

This document records the current bridge observed in the supplied source baseline. `desktop/Web/EditorBridge.cs` and `src/services/desktopBridge.ts` are the implementation references. A disagreement between host and client is a defect to investigate, not a reason to silently expand host permissions.

## Trust boundary

- WPF owns filesystem access, native dialogs, user-data persistence, and ZIP export.
- React requests only explicitly named host operations through WebView2 messages.
- The host accepts messages only from the local editor origin `https://englishcards.invalid/`.
- Do not expose arbitrary filesystem access, shell execution, generic method invocation, or unrestricted URL navigation.
- Navigation and new-window requests remain restricted to local content.

## Request and response envelope

Observed request:

```json
{"id":1,"command":"loadSettings","payload":null}
```

- `id`: positive integer used to correlate the response.
- `command`: allow-listed command name.
- `payload`: operation-specific JSON value, validated by the host.
- Success response: `{ "id": 1, "ok": true, "value": ... }`.
- Failure response: `{ "id": 1, "ok": false, "error": "..." }`.

## Current command allow-list

| Command | Expected payload | Host responsibility |
|---|---|---|
| `openProject` | `null` | Native open dialog; return selected file name and text |
| `saveProject` | JSON string | Validate schemaVersion 5 envelope; native save dialog; atomic write |
| `loadSettings` | `null` | Read settings from userdata |
| `loadDraft` | `null` | Read draft from userdata |
| `saveSettings` | `{text, preserveOriginal}` | Validate and persist settings |
| `saveDraft` | `{text, preserveOriginal}` | Validate and persist draft |
| `saveRejectedDraft` | `null` | Explicitly save retained rejected draft elsewhere |
| `exportAllZip` | object | Validate snapshot and run full ZIP export |

## Ordering and navigation

- File commands are serialized by a task tail to preserve order.
- The navigation generation is captured when a message arrives; stale-page responses must not be delivered to a later page.
- Yield the dispatcher before showing native modal dialogs.
- Do not post a response to a disposed or no-longer-current WebView.

## Required checks for bridge changes

Test unknown commands, missing/wrong payload fields, malformed JSON, invalid IDs, wrong source origin, stale navigation, dialog cancellation, I/O failure, and WebView disposal. Event-boundary asynchronous handlers must observe and contain exceptions. Keep filesystem authority in WPF; do not accept arbitrary caller-selected paths unless a native user action authorizes them.


## WebView2 origin and navigation lifecycle

- Local navigation and resource requests must use an absolute URI with HTTPS, host `englishcards.invalid`, port 443, and no user information.
- Prefix string comparisons are not the origin authority; use parsed URI components.
- A `LoadAsync` call completes only for the `NavigationCompleted` event whose `NavigationId` matches the navigation it initiated and whose final source is the expected local page.
- Cancellation of a `WaitAsync` wrapper does not cancel the underlying WebView2 initialization or DevTools operation. Callers must dispose/retire the associated WebView2 instance when abandoning work; do not assume the underlying operation was cancelled.
