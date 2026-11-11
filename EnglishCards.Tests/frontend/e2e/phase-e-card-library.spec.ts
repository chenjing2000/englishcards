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
  await expect(page.getByRole('button', { name: '导出 ZIP' })).toBeEnabled();
  expect(await page.evaluate(() => window.phaseETest.requests.filter(item =>
    item.command === 'activateCardFile').length)).toBe(1);
  await page.getByRole('button', { name: 'B.json' }).click();
  await expect(title).toHaveValue('Card B');
  expect(await page.evaluate(() => window.phaseETest.requests.filter(item =>
    item.command === 'activateCardFile').length)).toBe(2);
});


test('Settings uses a two-column 560 DIP dialog and New Card uses the compact two-row layout', async ({ page }) => {
  await page.addInitScript(initial => {
    const messages = new EventTarget();
    const requests: NativeMessage[] = [];
    let rememberedNewCardFolder = 'C:/EnglishCards/userdata';
    const respond = (reply: NativeReply) => messages.dispatchEvent(new MessageEvent('message', { data: reply }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage(request: NativeMessage) {
        requests.push(request);
        const { id, command, payload } = request;
        let value: unknown = true;
        if (command === 'loadSettings') value = null;
        if (command === 'defaultCardLibrary' || command === 'lastCardLibrary')
          value = 'C:/EnglishCards/userdata';
        if (command === 'lastNewCardFolder') value = rememberedNewCardFolder;
        if (command === 'saveLastCardLibrary') value = true;
        if (command === 'listCardDirectory') value = { path: payload, folders: [], files: [] };
        if (command === 'chooseCardFolder') value = 'D:/My Cards';
        if (command === 'createCardFile') {
          rememberedNewCardFolder = (payload as { directory: string }).directory;
          value = {
            path: 'D:/My Cards/Custom Card.json',
            text: JSON.stringify({ ...initial, title: 'Custom Card' }),
            folderPreferenceSaved: true,
          };
        }
        queueMicrotask(() => respond({ id, ok: true, value }));
      },
      addEventListener: messages.addEventListener.bind(messages),
      removeEventListener: messages.removeEventListener.bind(messages),
    } });
    Reflect.set(window, 'chrome', chrome);
    Object.defineProperty(window, 'phaseENewCardRequests', { value: requests });
  }, fixture);

  await page.goto('/');
  const newCardButton = page.getByRole('button', { name: '新建卡片' });
  await expect(newCardButton).toBeEnabled();
  await page.getByRole('button', { name: '设置' }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  await expect(settings).toBeVisible();
  await expect.poll(() => settings.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(560);
  await expect(settings.locator('.settings-columns')).toHaveCSS('grid-template-columns', /\d+px \d+px/);
  await expect(settings.locator('.settings-columns')).toHaveCSS('column-gap', '20px');
  await expect(settings.locator('.settings-column').nth(1)).toHaveCSS('border-left-style', 'none');
  await expect(settings.getByRole('heading', { name: '字号设置' })).toHaveCSS('text-align', 'center');
  await expect(settings.getByRole('heading', { name: '其余设置' })).toHaveCSS('text-align', 'center');
  await settings.getByRole('button', { name: '关闭设置' }).click();

  await page.getByRole('button', { name: '新建卡片' }).click();
  const dialog = page.getByRole('dialog', { name: '新建卡片' });
  await expect(dialog).toHaveCSS('width', '560px');
  await expect(dialog).toHaveCSS('min-width', '400px');
  await expect(dialog).toHaveCSS('max-width', '600px');
  await expect(dialog).toHaveCSS('resize', 'none');
  const rows = dialog.locator('.phase-e-create-row');
  await expect(rows).toHaveCount(2);
  await expect(dialog.locator('.phase-e-create-form')).toHaveCSS('row-gap', '20px');
  const folder = dialog.getByLabel('文件夹', { exact: true });
  await expect(folder).toHaveValue('C:/EnglishCards/userdata');
  await expect(folder).toHaveAttribute('type', 'text');
  await expect(folder).toHaveAttribute('autocomplete', 'off');
  await expect(dialog.getByLabel('卡片名', { exact: true })).toHaveAttribute('type', 'text');
  await expect(dialog.getByLabel('卡片名', { exact: true })).toHaveAttribute('autocomplete', 'off');
  await expect(dialog.locator('textarea')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '取消' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '创建' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '关闭新建卡片' })).toBeVisible();
  await folder.fill('E:/Uncommitted Folder');
  await dialog.getByRole('button', { name: '关闭新建卡片' }).click();
  await page.getByRole('button', { name: '新建卡片' }).click();
  await expect(folder).toHaveValue('C:/EnglishCards/userdata');
  await dialog.getByRole('button', { name: '选择文件夹' }).click();
  await expect(folder).toHaveValue('D:/My Cards');
  await dialog.getByLabel('卡片名', { exact: true }).fill('Custom Card');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const createRequest = await page.evaluate(() => (window as any).phaseENewCardRequests.find((item: NativeMessage) => item.command === 'createCardFile'));
  expect(createRequest.payload).toMatchObject({ directory: 'D:/My Cards', fileName: 'Custom Card.json' });

  await page.getByRole('button', { name: '新建卡片' }).click();
  const reopened = page.getByRole('dialog', { name: '新建卡片' });
  await expect(reopened.getByLabel('文件夹', { exact: true })).toHaveValue('D:/My Cards');
  await reopened.getByRole('button', { name: '关闭新建卡片' }).click();
  await expect(reopened).toHaveCount(0);
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
