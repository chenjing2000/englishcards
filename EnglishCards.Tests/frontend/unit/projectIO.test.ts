import { expect, it, vi } from 'vitest';
import fixture from '@fixtures/projects/brainco/project.json';
import { createEmptyArticle, parseRenderProject } from '@frontend/models/project';
import { loadDesktopData, restoreDraft } from '@frontend/services/projectIO';
import { defaults } from '@frontend/models/settings';

it('Phase E desktop bootstrap reads settings without restoring a legacy draft', async () => {
  const messages = new EventTarget();
  const writes: { command: string; payload: { text: string } }[] = [];
  const reads: string[] = [];
  vi.stubGlobal('window', { chrome: { webview: {
    postMessage({ id, command, payload }: { id: number; command: string; payload: { text: string } }) {
      if (command.startsWith('load')) reads.push(command);
      if (command.startsWith('save')) writes.push({ command, payload });
      const value = command === 'loadSettings' ? null
        : command === 'loadDraft' ? JSON.stringify({ article: { ...fixture, title: 'Disk draft' }, modifiedAt: '2026-11-07T00:00:00.000Z' })
        : true;
      messages.dispatchEvent(new MessageEvent('message', { data: { id, ok: true, value } }));
    },
    addEventListener: messages.addEventListener.bind(messages),
    removeEventListener: messages.removeEventListener.bind(messages),
  } } });
  try {
    const { settings, draft, persistence } = await loadDesktopData();
    expect(draft.project).toMatchObject({ ...createEmptyArticle(), id: expect.any(String) });
    expect(reads).toEqual(['loadSettings']);
    expect(draft.project.schemaVersion).toBe(6);
    await persistence.save({ ...draft.project, styles: settings });
    expect(writes.map(write => write.command)).toEqual(['saveSettings']);
    expect(JSON.parse(writes[0].payload.text)).toEqual(defaults);
  } finally { vi.unstubAllGlobals(); }
});

it('rejects a v5 draft and preserves its original bytes in quarantine', () => {
  const raw = JSON.stringify({ article: { ...fixture, schemaVersion: 5 } });
  const store = new Map([['article-editor.draft.v6', raw]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  try {
    const restored = restoreDraft();
    expect(restored.project.schemaVersion).toBe(6);
    expect(restored.rejected).toBe(raw);
    expect(restored.notice).toContain('格式不受支持');
    expect(store.get('article-editor.rejected-draft')).toBe(raw);
    expect(store.get('article-editor.draft.v6')).toBe(raw);
  } finally { vi.unstubAllGlobals(); }
});

it('quarantines the previous v5 localStorage draft key without migrating it', () => {
  const raw = JSON.stringify({ project: { schemaVersion: 5, title: 'legacy draft' } });
  const store = new Map([['reading-editor.draft.v2', raw]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  try {
    const restored = restoreDraft();
    expect(restored.project.schemaVersion).toBe(6);
    expect(restored.project.title).toBe(fixture.title);
    expect(restored.rejected).toBe(raw);
    expect(restored.notice).toContain('旧版自动草稿（v5）');
    expect(store.get('article-editor.rejected-draft')).toBe(raw);
    expect(store.get('reading-editor.draft.v2')).toBe(raw);
  } finally { vi.unstubAllGlobals(); }
});
