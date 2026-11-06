import { test, expect, type Page } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };

type Request = { id: number; command: string; payload: string | null };
type Response = { id: number; ok: boolean; value?: unknown; error?: string };

declare global {
  interface Window {
    fileRequests: Request[];
    respondToFileRequest: (response: Response) => void;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const messages = new EventTarget();
    window.fileRequests = [];
    window.respondToFileRequest = response => messages.dispatchEvent(new MessageEvent('message', { data: response }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage: (request: Request) => {
        if (['openProject', 'saveProject'].includes(request.command)) window.fileRequests.push(request);
        else queueMicrotask(() => window.respondToFileRequest({ id: request.id, ok: true, value: null }));
      },
      addEventListener: messages.addEventListener.bind(messages),
      removeEventListener: messages.removeEventListener.bind(messages),
    } });
    Reflect.set(window, 'chrome', chrome);
  });
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
});

const title = (page: Page) => page.getByLabel('英文标题', { exact: true });
const dirty = (page: Page) => page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })));

async function clickRequest(page: Page, command: 'openProject' | 'saveProject') {
  const count = await page.evaluate(() => window.fileRequests.length);
  await page.getByRole('button', { name: command === 'openProject' ? '打开 JSON' : '保存 JSON', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.fileRequests.length)).toBe(count + 1);
  const request = await page.evaluate(() => window.fileRequests.at(-1)!);
  expect(request.command).toBe(command);
  return request;
}

async function reply(page: Page, response: Response) {
  await page.evaluate(async response => {
    window.respondToFileRequest(response);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, response);
}

test('native cancellation and read or write errors preserve the project and dirty state', async ({ page }) => {
  await title(page).fill('Unsaved changes');
  expect(await dirty(page)).toBe(true);
  for (const command of ['openProject', 'saveProject'] as const) {
    const canceled = await clickRequest(page, command);
    await reply(page, { id: canceled.id, ok: true, value: null });
    await expect(title(page)).toHaveValue('Unsaved changes');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await dirty(page)).toBe(true);
    const failed = await clickRequest(page, command);
    await reply(page, { id: failed.id, ok: false, error: 'Access denied' });
    await expect(page.getByRole('alert')).toContainText('Access denied');
    await expect(title(page)).toHaveValue('Unsaved changes');
    expect(await dirty(page)).toBe(true);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
});

test('only schema 5 JSON is accepted and the saved snapshot can be opened again', async ({ page }) => {
  await title(page).fill('Save this snapshot');
  for (const text of ['{', JSON.stringify({ ...fixture, schemaVersion: 4 })]) {
    const { id } = await clickRequest(page, 'openProject');
    await reply(page, { id, ok: true, value: { name: 'broken.json', text } });
    await expect(page.getByRole('alert')).toContainText('无法打开项目');
    await expect(title(page)).toHaveValue('Save this snapshot');
    expect(await dirty(page)).toBe(true);
  }

  const save = await clickRequest(page, 'saveProject');
  const saved = JSON.parse(save.payload!);
  expect(saved).toEqual({ ...fixture, title: 'Save this snapshot' });
  await title(page).fill('Edited during save');
  await reply(page, { id: save.id, ok: true, value: true });
  expect(await dirty(page)).toBe(true);
  const open = await clickRequest(page, 'openProject');
  await reply(page, { id: open.id, ok: true, value: { name: 'saved.json', text: save.payload } });
  await expect(title(page)).toHaveValue('Save this snapshot');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await dirty(page)).toBe(false);
});

test('a delayed open result cannot replace a newer project', async ({ page }) => {
  const older = await clickRequest(page, 'openProject');
  const latest = await clickRequest(page, 'openProject');
  await reply(page, { id: latest.id, ok: true, value: { name: 'new.json', text: JSON.stringify({ ...fixture, title: 'Newest project' }) } });
  await reply(page, { id: older.id, ok: true, value: { name: 'old.json', text: JSON.stringify({ ...fixture, title: 'Old project' }) } });
  await expect(title(page)).toHaveValue('Newest project');
  expect(await dirty(page)).toBe(false);
});


test('opening a project locks edits and history until cancellation or failure, while allowing another open', async ({ page }) => {
  await title(page).fill('Protected working edit');
  const first = await clickRequest(page, 'openProject');
  await expect(page.locator('.fields')).toHaveAttribute('inert', '');
  await expect(page.locator('.history-toolbar')).toHaveAttribute('inert', '');
  await expect(title(page)).toHaveValue('Protected working edit');

  // Keep the Open action reachable, so a newer selection can supersede a slow one.
  const latest = await clickRequest(page, 'openProject');
  await reply(page, { id: latest.id, ok: true, value: null });
  await expect(page.locator('.fields')).not.toHaveAttribute('inert', '');
  await expect(page.locator('.history-toolbar')).not.toHaveAttribute('inert', '');
  await expect(title(page)).toHaveValue('Protected working edit');

  // A stale response must not change the working document or relock editing.
  await reply(page, { id: first.id, ok: true, value: { name: 'older.json', text: JSON.stringify(fixture) } });
  await expect(title(page)).toHaveValue('Protected working edit');
  await expect(page.locator('.fields')).not.toHaveAttribute('inert', '');

  const failed = await clickRequest(page, 'openProject');
  await expect(page.locator('.fields')).toHaveAttribute('inert', '');
  await reply(page, { id: failed.id, ok: false, error: 'Access denied' });
  await expect(page.locator('.fields')).not.toHaveAttribute('inert', '');
  await expect(title(page)).toHaveValue('Protected working edit');
  await expect(page.getByRole('alert')).toContainText('Access denied');
});
