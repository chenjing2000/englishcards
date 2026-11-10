import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '@fixtures/projects/brainco/project.json';
import { createCardSaveCoordinator, listCardDirectory, openCardFile, serializedCard } from '@frontend/services/cardFileIO';
import { parseProject } from '@frontend/models/project';

function fakeBridge(respond: (command: string, payload: unknown) => unknown) {
  const messages = new EventTarget();
  const requests: { command: string; payload: unknown }[] = [];
  vi.stubGlobal('window', {
    chrome: { webview: {
      postMessage({ id, command, payload }: { id: number; command: string; payload: unknown }) {
        requests.push({ command, payload });
        queueMicrotask(() => {
          try {
            const value = respond(command, payload);
            messages.dispatchEvent(new MessageEvent('message', { data: { id, ok: true, value } }));
          } catch (error) {
            messages.dispatchEvent(new MessageEvent('message', {
              data: { id, ok: false, error: String(error) },
            }));
          }
        });
      },
      addEventListener: messages.addEventListener.bind(messages),
      removeEventListener: messages.removeEventListener.bind(messages),
    } },
  });
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe('Phase E file-backed desktop bridge client', () => {
  it('lazily requests only the selected directory', async () => {
    const requests = fakeBridge((_command, payload) => ({
      path: payload, folders: [{ path: 'C:/cards/sub', name: 'sub' }], files: [],
    }));
    const contents = await listCardDirectory('C:/cards');
    expect(contents.folders).toHaveLength(1);
    expect(requests).toEqual([{ command: 'listCardDirectory', payload: 'C:/cards' }]);
  });

  it('opens and validates an Article v6 from a specific path', async () => {
    const requests = fakeBridge(() => ({ path: 'C:/cards/A.json', text: JSON.stringify(fixture) }));
    const result = await openCardFile('C:/cards/A.json');
    expect(result.article).toEqual(parseProject(fixture));
    expect(requests[0]).toEqual({ command: 'openCardFile', payload: 'C:/cards/A.json' });
  });

  it('saves to the captured card path rather than a newer global selection', async () => {
    const requests = fakeBridge(() => true);
    const article = parseProject(fixture);
    const card = createCardSaveCoordinator('C:/cards/A.json', article);
    card.edit(serializedCard({ ...article, title: 'Updated A' }));
    expect(await card.flush()).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].command).toBe('saveCardFile');
    const payload = requests[0].payload as { path: string; text: string };
    expect(payload.path).toBe('C:/cards/A.json');
    expect(JSON.parse(payload.text).title).toBe('Updated A');
  });

  it('rejects malformed JSON rather than using a legacy import fallback', async () => {
    fakeBridge(() => ({ path: 'C:/cards/broken.json', text: '{"schemaVersion":5}' }));
    await expect(openCardFile('C:/cards/broken.json')).rejects.toThrow();
  });
});
