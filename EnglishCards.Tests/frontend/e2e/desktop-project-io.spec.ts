import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

type Request = { id: number; command: string; payload: unknown };
declare global {
  interface Window {
    phaseEIO: {
      requests: Request[];
      failNextSave: boolean;
      corruptNextOpen: boolean;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(initial => {
    const events = new EventTarget();
    const cards: Record<string, unknown> = {
      'C:/cards/A.json': { ...initial, title: 'Card A' },
    };
    window.phaseEIO = { requests: [], failNextSave: false, corruptNextOpen: false };
    localStorage.setItem('englishcards.library.root', 'C:/cards');
    const respond = (id: number, value: unknown, error?: string) =>
      events.dispatchEvent(new MessageEvent('message', {
        data: error ? { id, ok: false, error } : { id, ok: true, value },
      }));
    const chrome = Reflect.get(window, 'chrome') ?? {};
    Object.assign(chrome, { webview: {
      postMessage({ id, command, payload }: Request) {
        window.phaseEIO.requests.push({ id, command, payload });
        let value: unknown = true;
        let error: string | undefined;
        if (command === 'loadSettings') value = null;
        if (command === 'listCardDirectory') value = {
          path: payload,
          folders: payload === 'C:/cards' ? [{ path: 'C:/cards/Subfolder', name: 'Subfolder' }] : [],
          files: payload === 'C:/cards'
            ? Object.keys(cards).map(path => ({ path, name: path.split('/').at(-1)! })) : [],
        };
        if (command === 'openCardFile') {
          value = { path: payload, text: window.phaseEIO.corruptNextOpen
            ? '{"schemaVersion":5}' : JSON.stringify(cards[payload as string]),
            fingerprint: 'FAKEHASH' };
          window.phaseEIO.corruptNextOpen = false;
        }
        if (command === 'saveCardFile') {
          if (window.phaseEIO.failNextSave) {
            window.phaseEIO.failNextSave = false;
            error = 'Disk locked';
          } else {
            const snapshot = payload as { path: string; text: string };
            cards[snapshot.path] = JSON.parse(snapshot.text);
          }
        }
        if (command === 'createCardFile') {
          const contents = (payload as { text: string }).text;
          const path = 'C:/cards/' + (payload as { fileName: string }).fileName;
          cards[path] = JSON.parse(contents);
          value = { path, text: contents };
        }
        queueMicrotask(() => respond(id, value, error));
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    } });
    Reflect.set(window, 'chrome', chrome);
  }, fixture);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'A.json' })).toBeVisible();
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '');
});

test('library uses ReadArticles-style expander, without heading or refresh', async ({ page }) => {
  await expect(page.getByRole('button', { name: '选择卡片馆' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '卡片馆', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '刷新卡片馆' })).toHaveCount(0);
  const folder = page.getByRole('button', { name: '目录 Subfolder' });
  await expect(folder).toBeVisible();
  await expect(folder.locator('img.library-expander')).toBeVisible();
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await folder.click();
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => window.phaseEIO.requests.some(item =>
    item.command === 'listCardDirectory' && item.payload === 'C:/cards/Subfolder'))).toBe(true);
});

test('right editor title and Transcript Studio-style circular icons share one row', async ({ page }) => {
  const heading = page.locator('.editor-panel .phase-c-heading');
  const title = heading.getByRole('heading', { name: '英语阅读卡片编辑器' });
  const buttons = heading.locator('.phase-e-actions button');
  await expect(title).toBeVisible();
  await expect(buttons).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveAttribute('aria-label', '设计');
  await expect(buttons.nth(1)).toHaveAttribute('aria-label', '新建卡片');
  await expect(buttons.nth(2)).toHaveAttribute('aria-label', '导出 ZIP');
  await expect(buttons.nth(0)).toHaveCSS('border-radius', '50%');
  await expect(buttons.nth(0)).toHaveCSS('background-color', 'rgb(162, 210, 226)');
  for (const button of await buttons.all()) {
    await expect(button.locator('svg')).toHaveAttribute('viewBox', '0 0 24 24');
    await expect(button.locator('svg')).toHaveAttribute('stroke-width', '1.8');
  }
  const titleBounds = await title.boundingBox();
  const firstBounds = await buttons.first().boundingBox();
  const lastBounds = await buttons.last().boundingBox();
  expect(titleBounds && firstBounds && lastBounds).toBeTruthy();
  expect(Math.abs((titleBounds!.y + titleBounds!.height / 2) -
    (firstBounds!.y + firstBounds!.height / 2))).toBeLessThan(3);
  expect(firstBounds!.x).toBeGreaterThan(titleBounds!.x);
  expect(lastBounds!.x).toBeGreaterThan(firstBounds!.x);
});

test('Phase E invalid Article JSON never replaces the active card', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  const title = page.getByLabel('英文标题', { exact: true });
  await expect(title).toHaveValue('Card A');
  await page.evaluate(() => { window.phaseEIO.corruptNextOpen = true; });
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect(page.getByRole('alert')).toContainText('卡片打开失败');
  await expect(title).toHaveValue('Card A');
});

test('Phase E new card creates JSON before activating the editor', async ({ page }) => {
  await page.getByRole('button', { name: '新建卡片' }).click();
  await expect(page.getByRole('dialog', { name: '新建卡片' })).toBeVisible();
  await page.getByLabel('英文标题', { exact: true }).fill('My New Card');
  await expect(page.getByText('默认文件名：My New Card.json')).toBeVisible();
  await page.getByRole('button', { name: '创建卡片' }).click();
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('My New Card');
  const requests = await page.evaluate(() => window.phaseEIO.requests);
  const create = requests.find(item => item.command === 'createCardFile');
  expect(create).toBeDefined();
  const payload = create!.payload as { directory: string; text: string };
  expect(payload.directory).toBe('C:/cards');
  const document = JSON.parse(payload.text);
  expect(document.schemaVersion).toBe(6);
  expect(document.title).toBe('My New Card');
  expect(payload).toHaveProperty('fileName', 'My New Card.json');
  await expect(page.getByRole('button', { name: 'My New Card.json' })).toBeVisible();
});

test('opened desktop card is editable with pointer input and mouse-wheel scrolling', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  const fields = page.locator('.fields');
  await expect(fields).not.toHaveAttribute('inert', '');
  const title = page.getByLabel('英文标题', { exact: true });
  await expect(title).toBeEditable();
  await title.click();
  await title.fill('A editable with a mouse');
  await expect(title).toHaveValue('A editable with a mouse');
  const content = page.getByLabel('英文正文', { exact: true });
  await expect(content).toBeEditable();
  await content.fill(Array.from({ length: 90 }, (_, index) => `Paragraph ${index + 1} with reading text.`).join('\n\n'));
  await expect.poll(() => page.evaluate(() =>
    window.phaseEIO.requests.some(item => item.command === 'saveCardFile'))).toBe(true);
  const before = await fields.evaluate(element => element.scrollTop);
  await page.mouse.move(1000, 600);
  await page.mouse.wheel(0, 550);
  await expect.poll(() => fields.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
});

test('Phase E save failure retains A and allows explicit retry', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  const title = page.getByLabel('英文标题', { exact: true });
  await page.evaluate(() => { window.phaseEIO.failNextSave = true; });
  await title.fill('A cannot save');
  await expect(page.getByRole('button', { name: '重试保存当前卡片' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Disk locked');
  await page.getByRole('button', { name: '重试保存当前卡片' }).click();
  await expect(page.getByRole('button', { name: '重试保存当前卡片' })).toHaveCount(0);
  const saves = await page.evaluate(() => window.phaseEIO.requests.filter(item => item.command === 'saveCardFile'));
  expect(saves).toHaveLength(2);
  expect(JSON.parse((saves[1].payload as { text: string }).text).title).toBe('A cannot save');
});
