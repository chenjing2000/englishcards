import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

type NativeMessage = { id: number; command: string; payload: unknown };
type NativeReply = { id: number; ok: true; value: unknown };

declare global {
  interface Window {
    phaseETest: {
      requests: NativeMessage[];
      pauseSaves: boolean;
      releaseSave: () => void;
    };
  }
}

test('Phase E rejects a card switch until A is saved and requires a second click', async ({ page }) => {
  await page.addInitScript(initial => {
    const messages = new EventTarget();
    const cards: Record<string, object> = {
      'C:/cards/A.json': { ...initial, title: 'Card A' },
      'C:/cards/B.json': { ...initial, title: 'Card B' },
    };
    let held: (() => void) | null = null;
    window.phaseETest = {
      requests: [],
      pauseSaves: true,
      releaseSave: () => { const release = held; held = null; release?.(); },
    };
    localStorage.setItem('englishcards.library.root', 'C:/cards');
    const respond = (reply: NativeReply) =>
      messages.dispatchEvent(new MessageEvent('message', { data: reply }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage(request: NativeMessage) {
        window.phaseETest.requests.push(request);
        const { id, command, payload } = request;
        let value: unknown = true;
        if (command === 'loadSettings') value = null;
        if (command === 'defaultCardLibrary' || command === 'lastCardLibrary') value = 'C:/cards';
        if (command === 'lastNewCardFolder') value = 'C:/cards';
        if (command === 'saveLastCardLibrary') value = true;
        if (command === 'listCardDirectory') value = {
          path: payload, folders: [], files: [
            { path: 'C:/cards/A.json', name: 'A.json' },
            { path: 'C:/cards/B.json', name: 'B.json' },
          ],
        };
        if (command === 'openCardFile') value = {
          path: payload, text: JSON.stringify(cards[payload as string]), fingerprint: 'FAKEHASH',
        };
        if (command === 'saveCardFile') {
          const item = payload as { path: string; text: string };
          cards[item.path] = JSON.parse(item.text) as object;
          if (window.phaseETest.pauseSaves) {
            held = () => respond({ id, ok: true, value });
            return;
          }
        }
        queueMicrotask(() => respond({ id, ok: true, value }));
      },
      addEventListener: messages.addEventListener.bind(messages),
      removeEventListener: messages.removeEventListener.bind(messages),
    } });
    Reflect.set(window, 'chrome', chrome);
  }, fixture);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'A.json' })).toBeVisible();
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'A.json' }).click();
  const title = page.getByLabel('英文标题', { exact: true });
  await expect(title).toHaveValue('Card A');

  await title.fill('Edited A');
  await expect.poll(() => page.evaluate(() =>
    window.phaseETest.requests.some(item => item.command === 'saveCardFile'))).toBe(true);

  await page.getByRole('button', { name: 'B.json' }).click();
  await expect(title).toHaveValue('Edited A');
  const warningNotice = page.locator('.phase-e-notices .phase-e-notice-normal')
    .filter({ hasText: '当前卡片正在保存，请保存完成后重新选择卡片。' });
  await expect(warningNotice).toBeVisible();
  await expect(warningNotice.getByRole('button', { name: '关闭消息' })).toBeVisible();
  // Hover pauses the five-second expiry. Moving away resumes the remaining time.
  await warningNotice.hover();
  await page.waitForTimeout(5200);
  await expect(warningNotice).toBeVisible();
  await page.mouse.move(8, 8);
  await expect(warningNotice).toHaveCount(0, { timeout: 6500 });

  await page.evaluate(() => window.phaseETest.releaseSave());
  await expect(page.getByRole('button', { name: '保存' })).toBeEnabled();
  expect(await page.evaluate(() => window.phaseETest.requests.filter(item =>
    item.command === 'activateCardFile').length)).toBe(1);
  await page.getByRole('button', { name: 'B.json' }).click();
  await expect(title).toHaveValue('Card B');
  expect(await page.evaluate(() => window.phaseETest.requests.filter(item =>
    item.command === 'activateCardFile').length)).toBe(2);
});


test('Settings keep 560 DIP layout and Clear / Save replace new-card creation', async ({ page }) => {
  await page.addInitScript(initial => {
    const messages = new EventTarget();
    const requests: NativeMessage[] = [];
    const respond = (reply: NativeReply) => messages.dispatchEvent(new MessageEvent('message', { data: reply }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage(request: NativeMessage) {
        requests.push(request);
        const { id, command, payload } = request;
        let value: unknown = true;
        if (command === 'loadSettings') value = null;
        if (command === 'defaultCardLibrary' || command === 'lastCardLibrary') value = 'C:/cards';
        if (command === 'listCardDirectory') value = {
          path: payload, folders: [], files: payload === 'D:/Saved Cards'
            ? [{ path: 'D:/Saved Cards/New Article.json', name: 'New Article.json' }] : [],
        };
        if (command === 'saveArticlePair') value = {
          path: 'D:/Saved Cards/New Article.json',
          folder: 'D:/Saved Cards',
          text: JSON.stringify((payload as { document: object }).document),
          folderPreferenceSaved: true,
        };
        queueMicrotask(() => respond({ id, ok: true, value }));
      },
      addEventListener: messages.addEventListener.bind(messages),
      removeEventListener: messages.removeEventListener.bind(messages),
    } });
    Reflect.set(window, 'chrome', chrome);
    Object.defineProperty(window, 'phaseEWorkflowRequests', { value: requests });
  }, fixture);

  await page.goto('/');
  await expect(page.getByRole('button', { name: '新建卡片' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '清空' })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  await expect(settings).toHaveCSS('width', '560px');
  await expect(settings.locator('.settings-columns')).toHaveCSS('column-gap', '20px');
  await expect(settings.locator('.settings-column').nth(1)).toHaveCSS('border-left-style', 'none');
  await settings.getByRole('button', { name: '关闭设置' }).click();

  // An untouched new editor clears directly; an edited article requires a decision.
  await page.getByRole('button', { name: '清空' }).click();
  const dialog = page.getByRole('dialog', { name: '清空当前文章' });
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('英文标题', { exact: true }).fill('Unsaved Draft');
  await page.getByRole('button', { name: '清空' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('Unsaved Draft');
  await page.getByRole('button', { name: '清空' }).click();
  await dialog.getByRole('button', { name: '放弃' }).click();
  await expect(dialog).toHaveCount(0);
  const title = page.getByLabel('英文标题', { exact: true });
  await expect(title).toHaveValue('');
  await expect(page.locator('.preview .card')).toHaveCount(0);

  await title.fill('New Article');
  await expect(page.getByRole('button', { name: '保存' })).toBeEnabled();
  await page.getByRole('button', { name: '保存' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).phaseEWorkflowRequests.some(
    (item: NativeMessage) => item.command === 'saveArticlePair'))).toBe(true);
  await expect(page.getByRole('button', { name: 'New Article.json' })).toBeVisible();
  const saved = await page.evaluate(() => (window as any).phaseEWorkflowRequests.find(
    (item: NativeMessage) => item.command === 'saveArticlePair'));
  expect(saved.payload.fileName).toBe('New Article.json');
  expect(saved.payload.document.title).toBe('New Article');
});

test('card library remembers a directory only after its listing succeeds', async ({ page }) => {
  await page.addInitScript(() => {
    const events = new EventTarget();
    const requests: NativeMessage[] = [];
    const respond = (id: number, value: unknown) =>
      events.dispatchEvent(new MessageEvent('message', { data: { id, ok: true, value } }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage({ id, command, payload }: NativeMessage) {
        requests.push({ id, command, payload });
        let value: unknown = true;
        if (command === 'loadSettings') value = null;
        if (command === 'lastCardLibrary') value = localStorage.getItem('test.lastLibrary') ?? 'C:/cards';
        if (command === 'lastNewCardFolder') value = 'C:/cards';
        if (command === 'defaultCardLibrary') value = 'C:/cards';
        if (command === 'chooseCardLibrary') value = 'D:/Reading Library';
        if (command === 'listCardDirectory') value = { path: payload, folders: [], files: [] };
        if (command === 'saveLastCardLibrary') localStorage.setItem('test.lastLibrary', String(payload));
        queueMicrotask(() => respond(id, value));
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    } });
    Reflect.set(window, 'chrome', chrome);
    Object.defineProperty(window, 'phaseELibraryRequests', { value: requests });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: '选择卡片馆' })).toBeVisible();
  await page.getByRole('button', { name: '选择卡片馆' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).phaseELibraryRequests.some(
    (item: NativeMessage) => item.command === 'saveLastCardLibrary'))).toBe(true);
  const libraryRequests = await page.evaluate(() => (window as any).phaseELibraryRequests
    .filter((item: NativeMessage) => ['listCardDirectory', 'saveLastCardLibrary'].includes(item.command)));
  const selectedListingIndex = libraryRequests.findIndex((item: NativeMessage) =>
    item.command === 'listCardDirectory' && item.payload === 'D:/Reading Library');
  const savePreferenceIndex = libraryRequests.findIndex((item: NativeMessage) =>
    item.command === 'saveLastCardLibrary');
  expect(selectedListingIndex).toBeGreaterThanOrEqual(0);
  expect(savePreferenceIndex).toBeGreaterThan(selectedListingIndex);

  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as any).phaseELibraryRequests.some(
    (item: NativeMessage) => item.command === 'listCardDirectory' && item.payload === 'D:/Reading Library'))).toBe(true);
});
