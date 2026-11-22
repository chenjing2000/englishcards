import { expect, test, type Page } from '@playwright/test';

type Reply = { files?: string[]; folders?: string[]; delay?: number; error?: string };
async function library(page: Page, directories: Record<string, Reply[]>, picks: (string | null)[] = [], scripts: Record<string, { delay?: number; notices?: string[] }> = {}, startupDelay = 0) {
  await page.addInitScript(({ directories, picks, scripts, startupDelay }) => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const state = { directories, picks, scripts, calls: [] as { command: string; payload: string }[] };
    (window as unknown as { libraryTest: typeof state }).libraryTest = state;
    Object.defineProperty(window, 'chrome', { value: { webview: {
      addEventListener: (_: string, cb: (event: MessageEvent) => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: (event: MessageEvent) => void) => listeners.delete(cb),
      postMessage: ({ id, command, payload }: { id: number; command: string; payload: string }) => {
        state.calls.push({ command, payload });
        let value: unknown; let error = ''; let delay = 0;
        if (command === 'lastCardLibrary') { value = 'C:/library'; delay = startupDelay; }
        else if (command === 'chooseCardLibrary') value = state.picks.shift() ?? null;
        else if (command === 'saveLastCardLibrary') value = true;
        else if (command === 'listCardDirectory') {
          const queue = state.directories[payload] ?? [{}];
          const reply = queue.length > 1 ? queue.shift()! : queue[0];
          delay = reply.delay ?? 0; error = reply.error ?? '';
          value = { path: payload, files: (reply.files ?? []).map(name => ({ name, path: `${payload}/${name}` })), folders: (reply.folders ?? []).map(name => ({ name, path: `${payload}/${name}` })) };
        } else if (command === 'openScriptFile') {
          const script = state.scripts[payload] ?? {};
          delay = script.delay ?? 0;
          value = { path: payload, text: JSON.stringify({ filetype: 'script', title: payload, paragraphs: [[{ text: 'Long reading sentence. '.repeat(300), timed_units: [] }]] }), notices: script.notices ?? [] };
        } else error = command;
        setTimeout(() => listeners.forEach(cb => cb({ data: error ? { id, ok: false, error } : { id, ok: true, value } } as MessageEvent)), delay);
      },
    } }, configurable: true });
  }, { directories, picks, scripts, startupDelay });
  await page.goto('/');
}
const file = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const folder = (page: Page, name: string) => page.getByRole('button', { name: `目录 ${name}`, exact: true });
async function count(page: Page, command: string) { return page.evaluate(command => (window as unknown as { libraryTest: { calls: { command: string }[] } }).libraryTest.calls.filter(call => call.command === command).length, command); }

test('A2 zero stays blank, one auto-opens, many wait for explicit click at the loaded level', async ({ page }) => {
  await library(page, { 'C:/library': [{ folders: ['Zero', 'One', 'Many'] }], 'C:/library/Zero': [{}], 'C:/library/One': [{ files: ['single.json'] }], 'C:/library/Many': [{ files: ['a.json', 'b.json'] }] });
  await expect(folder(page, 'Zero')).toBeVisible();
  // React StrictMode replays the initial root effect in the development server.
  expect(await count(page, 'listCardDirectory')).toBe(2);
  await folder(page, 'Zero').click(); await expect(page.locator('.library-muted')).toHaveCount(0);
  await expect(page.locator('.card')).toHaveCount(0);
  await folder(page, 'Many').click(); await expect(file(page, 'b.json')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
  await folder(page, 'One').click(); await expect(page.locator('.card')).toContainText('single.json');
  expect(await count(page, 'openScriptFile')).toBe(1);
});

test('A2 root one auto-opens and same Script click preserves page, layout and notices', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['one.json'] }] }, [], { 'C:/library/one.json': { notices: ['keep this notice'] } });
  await expect(page.locator('.card')).toContainText('one.json');
  await file(page, '下一页').click(); const pageNumber = await page.getByLabel('页码', { exact: true }).textContent();
  await file(page, 'one.json').click();
  await expect(page.getByLabel('页码', { exact: true })).toHaveText(pageNumber!);
  await expect(page.locator('.reader-message')).toContainText('keep this notice');
  expect(await count(page, 'openScriptFile')).toBe(1);
});

test('A2 collapse releases descendants, reopening scans only that level, stale results cannot auto-open', async ({ page }) => {
  await library(page, { 'C:/library': [{ folders: ['Parent'] }], 'C:/library/Parent': [{ files: ['stale.json'], delay: 400 }, { folders: ['Child'], files: ['a.json', 'b.json'] }], 'C:/library/Parent/Child': [{ files: ['fresh.json'] }] });
  await folder(page, 'Parent').click(); await folder(page, 'Parent').click(); await folder(page, 'Parent').click();
  await expect(file(page, 'b.json')).toBeVisible(); await page.waitForTimeout(500);
  await expect(file(page, 'stale.json')).toHaveCount(0); expect(await count(page, 'openScriptFile')).toBe(0);
  await folder(page, 'Child').click(); await expect(page.locator('.card')).toContainText('fresh.json');
  await folder(page, 'Parent').click(); await expect(folder(page, 'Child')).toHaveCount(0);
  await folder(page, 'Parent').click(); await expect(folder(page, 'Child')).toHaveAttribute('aria-expanded', 'false');
  expect(await count(page, 'listCardDirectory')).toBe(6);
});

test('A2 tree operations and same-root refresh preserve current page/messages and child expansions', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['one.json'], folders: ['Other'] }, { files: ['one.json'], folders: ['Other'] }, { files: ['new.json'], folders: ['Other'] }], 'C:/library/Other': [{ files: ['other.json'] }] }, ['C:/library'], { 'C:/library/one.json': { notices: ['keep'] } });
  await expect(page.locator('.card')).toContainText('one.json'); await file(page, '下一页').click();
  const number = await page.getByLabel('页码', { exact: true }).textContent();
  await folder(page, 'Other').click(); await expect(file(page, 'other.json')).toBeVisible();
  await file(page, '选择卡片馆').click(); await expect(file(page, 'new.json')).toBeVisible();
  await expect(folder(page, 'Other')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.card')).not.toContainText('other.json'); await expect(page.getByLabel('页码', { exact: true })).toHaveText(number!);
  await expect(page.locator('.reader-message')).toContainText('keep'); expect(await count(page, 'openScriptFile')).toBe(1);
});

test('A2 canceled and failed picker retain old session, successful different root clears it', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['one.json'] }], 'D:/bad': [{ error: 'Denied' }], 'D:/empty': [{}] }, [null, 'D:/bad', 'D:/empty']);
  await expect(page.locator('.card')).toContainText('one.json'); await file(page, '下一页').click();
  const number = await page.getByLabel('页码', { exact: true }).textContent();
  await file(page, '选择卡片馆').click(); await expect(page.getByLabel('页码', { exact: true })).toHaveText(number!);
  await file(page, '选择卡片馆').click(); await expect(page.locator('.reader-message')).toContainText('Denied'); await expect(page.getByLabel('页码', { exact: true })).toHaveText(number!);
  await file(page, '选择卡片馆').click(); await expect(page.locator('.card')).toHaveCount(0); await expect(page.locator('.reader-message')).toHaveCount(0);
});

test('A2 accepted root invalidates pending open, old directory scan and old notices', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['slow.json', 'fast.json'], folders: ['Slow'] }], 'C:/library/Slow': [{ files: ['late.json'], delay: 400 }], 'D:/new': [{ files: ['new.json'] }] }, ['D:/new'], { 'C:/library/slow.json': { delay: 400, notices: ['old notice'] } });
  await folder(page, 'Slow').click(); await file(page, 'slow.json').click(); await file(page, '选择卡片馆').click();
  await expect(page.locator('.card')).toContainText('new.json'); await page.waitForTimeout(500);
  await expect(page.locator('.card')).toContainText('new.json'); await expect(page.locator('.reader-message')).toHaveCount(0);
  expect(await count(page, 'openScriptFile')).toBe(2);
});

test('A2 different explicit Script replaces notices and same current click cancels a pending switch', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['a.json', 'b.json', 'slow.json'] }] }, [], { 'C:/library/a.json': { notices: ['old'] }, 'C:/library/b.json': { notices: ['new'] }, 'C:/library/slow.json': { delay: 400 } });
  await file(page, 'a.json').click(); await expect(page.locator('.reader-message')).toContainText('old');
  await file(page, 'b.json').click(); await expect(page.locator('.reader-message')).toHaveText('new关闭');
  await file(page, 'slow.json').click(); await file(page, 'b.json').click(); await page.waitForTimeout(500);
  await expect(page.locator('.card')).toContainText('b.json'); expect(await count(page, 'openScriptFile')).toBe(3);
});

test('A2 same-root read failure and cancel preserve session; refresh during opening does not start another open', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['one.json', 'slow.json'] }, { files: ['one.json', 'slow.json'] }, { error: 'Root denied' }, { files: ['slow.json'] }] }, ['C:/library', null, 'C:/library'], { 'C:/library/slow.json': { delay: 400 } });
  await file(page, 'one.json').click(); await expect(page.locator('.card')).toContainText('one.json');
  await file(page, '选择卡片馆').click(); await expect(page.locator('.reader-message')).toContainText('Root denied');
  await file(page, '选择卡片馆').click(); await expect(page.locator('.card')).toContainText('one.json');
  await file(page, 'slow.json').click(); await file(page, '选择卡片馆').click();
  await expect(file(page, 'one.json')).toHaveCount(0); await expect(page.locator('.reader-message')).toContainText('Root denied');
  await expect(page.locator('.card')).toContainText('slow.json'); expect(await count(page, 'openScriptFile')).toBe(2);
});

test('A2 explicit root choice wins over delayed startup library preference', async ({ page }) => {
  await library(page, { 'D:/chosen': [{ files: ['chosen.json'] }], 'C:/library': [{ files: ['old.json'] }] }, ['D:/chosen'], {}, 400);
  await file(page, '选择卡片馆').click(); await expect(page.locator('.card')).toContainText('chosen.json');
  await page.waitForTimeout(500); await expect(file(page, 'old.json')).toHaveCount(0);
  await expect(page.locator('.card')).toContainText('chosen.json'); expect(await count(page, 'openScriptFile')).toBe(1);
});

test('A2 Windows path casing preserves the same library and current Script identity', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['one.json'] }], 'c:/LIBRARY': [{ files: ['ONE.JSON'] }] }, ['c:/LIBRARY'], { 'C:/library/one.json': { notices: ['keep'] } });
  await expect(page.locator('.card')).toContainText('one.json'); await file(page, '下一页').click();
  const number = await page.getByLabel('页码', { exact: true }).textContent();
  await file(page, '选择卡片馆').click(); await expect(file(page, 'ONE.JSON')).toBeVisible(); await file(page, 'ONE.JSON').click();
  await expect(page.getByLabel('页码', { exact: true })).toHaveText(number!); await expect(page.locator('.reader-message')).toContainText('keep');
  expect(await count(page, 'openScriptFile')).toBe(1);
});

test('A2 latest root choice wins over an older delayed selection listing', async ({ page }) => {
  await library(page, { 'C:/library': [{ files: ['one.json'] }], 'D:/slow': [{ files: ['late.json'], delay: 400 }], 'E:/current': [{ files: ['current.json'] }] }, ['D:/slow', 'E:/current']);
  await expect(page.locator('.card')).toContainText('one.json');
  await file(page, '选择卡片馆').click(); await file(page, '选择卡片馆').click();
  await expect(page.locator('.card')).toContainText('current.json'); await page.waitForTimeout(500);
  await expect(page.locator('.card')).toContainText('current.json'); await expect(file(page, 'late.json')).toHaveCount(0);
  expect(await count(page, 'saveLastCardLibrary')).toBe(1);
});
