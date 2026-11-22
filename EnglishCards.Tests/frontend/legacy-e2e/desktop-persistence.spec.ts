import { test, expect } from './fixtures';
import { defaults } from '@frontend/models/settings';

type Request = { id: number; command: string; payload: unknown };
type Host = Window & {
  phaseESettingsRequests: Request[];
  phaseESettingsReply: (id: number, value: unknown, error?: string) => void;
  phaseESettingsHold: boolean;
  prepareClose?: () => Promise<{ pending: boolean; errors: string[]; busy?: boolean }>;
};

async function start(page: import('@playwright/test').Page, initialSettings: string | null) {
  await page.addInitScript(settings => {
    const host = window as unknown as Host;
    const events = new EventTarget();
    host.phaseESettingsRequests = [];
    host.phaseESettingsHold = false;
    host.phaseESettingsReply = (id, value, error) =>
      events.dispatchEvent(new MessageEvent('message', {
        data: error ? { id, ok: false, error } : { id, ok: true, value },
      }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage(request: Request) {
        host.phaseESettingsRequests.push(request);
        if (request.command === 'saveSettings' && host.phaseESettingsHold) return;
        let value: unknown = request.command === 'loadSettings' ? settings : true;
        if (request.command === 'lastCardLibrary' || request.command === 'lastNewCardFolder')
          value = 'C:/EnglishCards/userdata';
        if (request.command === 'listCardDirectory')
          value = { path: request.payload, folders: [], files: [] };
        queueMicrotask(() => host.phaseESettingsReply(request.id, value));
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    } });
    Reflect.set(window, 'chrome', chrome);
  }, initialSettings);
  await page.goto('/');
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
}

const requests = (page: import('@playwright/test').Page, command: string) =>
  page.evaluate(command => (window as unknown as Host).phaseESettingsRequests
    .filter(item => item.command === command), command);

test('Phase E desktop boots without reading legacy article drafts', async ({ page }) => {
  await start(page, null);
  await expect(page.getByRole('button', { name: '设置', exact: true })).toBeVisible();
  await expect.poll(async () => (await requests(page, 'saveSettings')).length).toBe(1);
  // React StrictMode can replay mount effects in development; settings reads are idempotent.
  expect((await requests(page, 'loadSettings')).length).toBeGreaterThanOrEqual(1);
  expect(await requests(page, 'loadDraft')).toHaveLength(0);
  expect(await requests(page, 'saveDraft')).toHaveLength(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '设置' })).toBeVisible();
  await expect(page.getByRole('table', { name: '字号设置' })).toBeVisible();
  await expect(page.getByRole('button', { name: '默认配置' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导入配置' })).toHaveCount(0);
});

test('Phase E persists settings separately even when no article file is open', async ({ page }) => {
  await start(page, JSON.stringify(defaults));
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByLabel('英文正文字号', { exact: true })).toBeVisible();
  await page.getByLabel('英文正文字号', { exact: true }).fill('40');
  await expect.poll(async () => (await requests(page, 'saveSettings')).length).toBeGreaterThan(0);
  const writes = await requests(page, 'saveSettings');
  const recent = writes.at(-1)!.payload as { text: string };
  expect(JSON.parse(recent.text).bodySize).toBe(40);
  expect(await requests(page, 'saveDraft')).toHaveLength(0);
});
