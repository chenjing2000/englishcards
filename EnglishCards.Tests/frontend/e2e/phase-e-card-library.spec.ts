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
