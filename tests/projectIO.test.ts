import { expect, it, vi } from 'vitest';
import fixture from '../assets/projects/brainco/project.json';
import { parseRenderProject } from '../src/models/project';
import { loadDesktopData, requestExport, restoreDraft } from '../src/services/projectIO';
import { defaults } from '../src/models/settings';

it('desktop bootstrap creates the default settings without overwriting a restored draft', async () => {
  const messages = new EventTarget();
  const writes: { command: string; payload: { text: string } }[] = [];
  vi.stubGlobal('window', { chrome: { webview: {
    postMessage({ id, command, payload }: { id: number; command: string; payload: { text: string } }) {
      if (command.startsWith('save')) writes.push({ command, payload });
      const value = command === 'loadSettings' ? null
        : command === 'loadDraft' ? JSON.stringify({ project: { ...fixture, title: 'Disk draft' } }) : true;
      messages.dispatchEvent(new MessageEvent('message', { data: { id, ok: true, value } }));
    },
    addEventListener: messages.addEventListener.bind(messages),
    removeEventListener: messages.removeEventListener.bind(messages),
  } } });
  try {
    const { settings, draft, persistence } = await loadDesktopData();
    expect(draft.project.title).toBe('Disk draft');
    await persistence.save({ ...draft.project, styles: settings });
    expect(writes.map(write => write.command)).toEqual(['saveSettings']);
    expect(JSON.parse(writes[0].payload.text)).toEqual(defaults);
  } finally { vi.unstubAllGlobals(); }
});

it('rejects an old-format draft while preserving its original bytes in quarantine', () => {
  const raw = JSON.stringify({ project: { ...fixture, schemaVersion: 2 } });
  const store = new Map([['reading-editor.draft.v2', raw]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
  try {
    const restored = restoreDraft();
    expect(restored.project.schemaVersion).toBe(5);
    expect(restored.rejected).toBe(raw);
    expect(restored.notice).toContain('格式不受支持');
    expect(store.get('reading-editor.rejected-draft')).toBe(raw);
    expect(store.get('reading-editor.draft.v2')).toBe(raw);
  } finally { vi.unstubAllGlobals(); }
});

it('sends one complete ZIP export snapshot through the desktop bridge', async () => {
  const messages = new EventTarget();
  const requests: { command: string; payload: unknown }[] = [];
  vi.stubGlobal('window', { chrome: { webview: {
    postMessage({ id, command, payload }: { id: number; command: string; payload: unknown }) {
      requests.push({ command, payload });
      messages.dispatchEvent(new MessageEvent('message', { data: { id, ok: true, value: true } }));
    },
    addEventListener: messages.addEventListener.bind(messages),
    removeEventListener: messages.removeEventListener.bind(messages),
  } } });
  try {
    const project = parseRenderProject(fixture);
    expect(await requestExport(project, 'signature-1234567890', 6)).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].command).toBe('exportAllZip');
    const payload = requests[0].payload as { signature: string; pages: number; document: { schemaVersion: number }; project: unknown };
    expect(payload.signature).toBe('signature-1234567890');
    expect(payload.pages).toBe(6);
    expect(payload.document.schemaVersion).toBe(5);
    expect(payload.project).toEqual(project);
  } finally { vi.unstubAllGlobals(); }
});

it('does not silently fall back to the removed web export service', async () => {
  vi.stubGlobal('window', {});
  try {
    await expect(requestExport(parseRenderProject(fixture), 'signature', 2)).rejects.toThrow('桌面版');
  } finally { vi.unstubAllGlobals(); }
});
