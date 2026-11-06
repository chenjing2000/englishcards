import { test, expect, type Page } from './fixtures';
import { defaults } from '../../src/models/settings';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };

type Write = { text: string; preserveOriginal: boolean };
type Request = { id: number; command: string; payload: Write | null };
type TestPage = Window & {
  requests: Request[];
  holdWrite: boolean;
  reply: (id: number, value: unknown, error?: string) => void;
  prepareClose?: () => Promise<{ pending: boolean; errors: string[] }>;
};

async function start(page: Page, files: { settings: string | null; draft: string | null }, holdLoads = false) {
  await page.addInitScript(({ files, holdLoads }) => {
    const testWindow = window as unknown as TestPage;
    const messages = new EventTarget();
    testWindow.requests = [];
    testWindow.reply = (id, value, error) => messages.dispatchEvent(new MessageEvent('message', {
      data: error ? { id, ok: false, error } : { id, ok: true, value },
    }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage(request: Request) {
        testWindow.requests.push(request);
        queueMicrotask(() => {
          if (request.command === 'loadSettings' && !holdLoads) testWindow.reply(request.id, files.settings);
          else if (request.command === 'loadDraft' && !holdLoads) testWindow.reply(request.id, files.draft);
          else if (request.command.startsWith('save') && !testWindow.holdWrite) testWindow.reply(request.id, true);
        });
      },
      addEventListener: messages.addEventListener.bind(messages),
      removeEventListener: messages.removeEventListener.bind(messages),
    } });
    Reflect.set(window, 'chrome', chrome);
  }, { files, holdLoads });
  await page.goto('/');
}

const requests = (page: Page, command: string) => page.evaluate(command =>
  (window as unknown as TestPage).requests.filter(request => request.command === command), command);
const close = (page: Page) => page.evaluate(() => (window as unknown as TestPage).prepareClose!());
const title = (page: Page) => page.getByLabel('英文标题', { exact: true });
const ready = (page: Page) => expect(page.locator('[data-ready="true"]')).toBeVisible({ timeout: 15000 });

test('desktop waits for both files before enabling editing and initializes missing settings', async ({ page }) => {
  await start(page, { settings: null, draft: null }, true);
  await expect.poll(async () => (await requests(page, 'loadDraft')).length, { timeout: 2000 }).toBeGreaterThan(0);
  await expect(page.locator('.fields')).toHaveAttribute('inert', '');
  await page.evaluate(text => {
    const host = window as unknown as TestPage;
    for (const { id, command } of host.requests) {
      if (command === 'loadSettings') host.reply(id, null);
      if (command === 'loadDraft') host.reply(id, text);
    }
  }, JSON.stringify({ project: { ...fixture, title: 'Restored from desktop disk' } }));
  await ready(page);
  await expect(title(page)).toHaveValue('Restored from desktop disk');
  await expect.poll(async () => (await requests(page, 'saveSettings')).length).toBe(1);
  expect(JSON.parse((await requests(page, 'saveSettings'))[0].payload!.text)).toEqual(defaults);
  expect(await requests(page, 'saveDraft')).toHaveLength(0);
});

test('damaged files are reported and preserved when a validated import and new draft replace them', async ({ page }) => {
  await start(page, { settings: '{bad settings', draft: '{bad draft' });
  await ready(page);
  await expect(page.getByText(/配置无法读取/)).toBeVisible();
  await page.getByRole('button', { name: '下载原始草稿' }).click();
  expect(await requests(page, 'saveRejectedDraft')).toHaveLength(1);
  expect(await requests(page, 'saveSettings')).toHaveLength(0);
  expect(await requests(page, 'saveDraft')).toHaveLength(0);
  await page.getByRole('button', { name: '样式', exact: true }).click();
  const input = page.getByLabel('导入设置 JSON');
  await input.setInputFiles({ name: 'old-settings.json', mimeType: 'application/json', buffer: Buffer.from('{"bodySize":0}') });
  await expect(page.getByRole('alert')).toContainText('配置导入失败');
  expect(await requests(page, 'saveSettings')).toHaveLength(0);
  await input.setInputFiles({ name: 'old-settings.json', mimeType: 'application/json', buffer: Buffer.from('{"bodySize":40}') });
  await expect(page.getByLabel('英文正文字号')).toHaveValue('40');
  await page.getByRole('button', { name: '原文', exact: true }).click();
  await title(page).fill('New desktop draft');
  expect((await close(page)).errors).toEqual([]);
  expect((await requests(page, 'saveSettings')).at(-1)?.payload).toMatchObject({ preserveOriginal: true });
  expect((await requests(page, 'saveDraft')).at(-1)?.payload).toMatchObject({ preserveOriginal: true });
});

test('close waits for in-flight writes and saves both final snapshots after undo', async ({ page }) => {
  await start(page, { settings: JSON.stringify(defaults), draft: null });
  await ready(page);
  await page.getByRole('button', { name: '样式', exact: true }).click();
  const bodySize = page.getByLabel('英文正文字号');
  await page.evaluate(() => { (window as unknown as TestPage).holdWrite = true; });
  await bodySize.fill('40');
  await expect.poll(async () => (await requests(page, 'saveSettings')).length).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(bodySize).toHaveValue('34');
  await page.getByRole('button', { name: '原文', exact: true }).click();
  await title(page).fill('Last draft before closing');
  const result = close(page);
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  expect(await requests(page, 'saveSettings')).toHaveLength(1);
  await page.evaluate(() => {
    const host = window as unknown as TestPage;
    host.holdWrite = false;
    host.reply(host.requests.find(request => request.command === 'saveSettings')!.id, true);
  });
  expect(await result).toMatchObject({ pending: true, errors: [] });
  expect((await requests(page, 'saveSettings')).map(request => JSON.parse(request.payload!.text).bodySize)).toEqual([40, 34]);
  expect(JSON.parse((await requests(page, 'saveDraft')).at(-1)!.payload!.text).project.title).toBe('Last draft before closing');
});

test('failed close keeps the current edit available for retry', async ({ page }) => {
  await start(page, { settings: JSON.stringify(defaults), draft: null });
  await ready(page);
  await page.evaluate(() => { (window as unknown as TestPage).holdWrite = true; });
  await title(page).fill('Recoverable edit');
  const result = close(page);
  await expect.poll(async () => (await requests(page, 'saveDraft')).length).toBe(1);
  await page.evaluate(() => {
    const host = window as unknown as TestPage;
    host.reply(host.requests.find(request => request.command === 'saveDraft')!.id, null, 'Disk locked');
  });
  expect(await result).toMatchObject({ pending: true, errors: [expect.stringContaining('Disk locked')] });
  await expect(page.getByRole('alert')).toContainText('Disk locked');
  await expect(title(page)).toHaveValue('Recoverable edit');
  await page.evaluate(() => { (window as unknown as TestPage).holdWrite = false; });
  expect(await close(page)).toMatchObject({ pending: true, errors: [] });
  expect(JSON.parse((await requests(page, 'saveDraft')).at(-1)!.payload!.text).project.title).toBe('Recoverable edit');
});
