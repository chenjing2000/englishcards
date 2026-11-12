import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

type Request = { id: number; command: string; payload: unknown };
declare global {
  interface Window {
    phaseEIO: {
      requests: Request[];
      failNextSave: boolean;
      corruptNextOpen: boolean;
      failDirectoryRead: boolean;
      failNextPair: boolean;
      existingPairFiles: string[];
      previewAudit?: { cleared: number; replaced: number; initialCard: Element | null };
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(initial => {
    const events = new EventTarget();
    const cards: Record<string, unknown> = {
      'C:/cards/A.json': { ...initial, title: 'Card A' },
    };
    window.phaseEIO = { requests: [], failNextSave: false, corruptNextOpen: false, failDirectoryRead: false, failNextPair: false, existingPairFiles: [] };
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
        if (command === 'defaultCardLibrary' || command === 'lastCardLibrary' || command === 'lastNewCardFolder')
          value = 'C:/cards';
        if (command === 'saveLastCardLibrary') value = true;
        if (command === 'listCardDirectory') value = {
          path: payload,
          folders: payload === 'C:/cards' ? [{ path: 'C:/cards/Subfolder', name: 'Subfolder' }] : [],
          files: Object.keys(cards).filter(path => path.startsWith(String(payload) + '/'))
            .map(path => ({ path, name: path.split('/').at(-1)! })),
        };
        if (command === 'listCardDirectory' && window.phaseEIO.failDirectoryRead && payload === 'C:/cards/Subfolder') {
          error = 'Access denied';
        }
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
        if (command === 'chooseArticlePairTarget') {
          value = { path: 'D:/Saved Cards/' + String(payload), folder: 'D:/Saved Cards', existingFiles: window.phaseEIO.existingPairFiles };
        }
        if (command === 'saveArticlePair') {
          if (window.phaseEIO.failNextPair) {
            window.phaseEIO.failNextPair = false;
            error = 'Pair save failed';
          } else {
            const request = payload as { fileName: string; document: object };
            const path = 'D:/Saved Cards/' + request.fileName;
            cards[path] = request.document;
            value = {
              path, folder: 'D:/Saved Cards',
              text: JSON.stringify(request.document), folderPreferenceSaved: true,
            };
          }
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

test('card-library directory errors use the shared preview notice rather than inline alerts', async ({ page }) => {
  await page.evaluate(() => { window.phaseEIO.failDirectoryRead = true; });
  await page.getByRole('button', { name: '目录 Subfolder' }).click();
  const error = page.locator('.phase-e-notices .phase-e-notice-error');
  await expect(error).toHaveCount(1);
  await expect(error).toContainText('Access denied');
  await expect(page.locator('.card-library [role="alert"]')).toHaveCount(0);
  await error.getByRole('button', { name: '关闭消息' }).click();
  await expect(error).toHaveCount(0);
});

test('right editor title and Transcript Studio-style circular icons share one row', async ({ page }) => {
  const heading = page.locator('.editor-panel .phase-c-heading');
  const title = heading.getByRole('heading', { name: '英语阅读卡片编辑器' });
  const buttons = heading.locator('.phase-e-actions button');
  await expect(title).toBeVisible();
  await expect(buttons).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveAttribute('aria-label', '设置');
  await expect(buttons.nth(1)).toHaveAttribute('aria-label', '清空');
  await expect(buttons.nth(2)).toHaveAttribute('aria-label', '保存');
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

test('independent desktop errors stack upwards and each close clears only its source', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  await page.evaluate(() => { window.phaseEIO.corruptNextOpen = true; });
  await page.getByRole('button', { name: 'A.json' }).click();
  const notices = page.locator('.phase-e-notices .phase-e-notice-error');
  await expect(notices).toHaveCount(1);
  await expect(notices.first()).toContainText('卡片打开失败');

  await page.evaluate(() => { window.phaseEIO.failNextSave = true; });
  await page.getByLabel('英文标题', { exact: true }).fill('Cannot save after failed open');
  await expect(notices).toHaveCount(2);
  const openError = notices.filter({ hasText: '卡片打开失败' });
  const saveError = notices.filter({ hasText: 'Disk locked' });
  await expect(openError).toBeVisible();
  await expect(saveError).toBeVisible();
  const top = await openError.boundingBox();
  const bottom = await saveError.boundingBox();
  expect(top && bottom).toBeTruthy();
  expect(bottom!.y).toBeLessThan(top!.y);

  await openError.getByRole('button', { name: '关闭消息' }).click();
  await expect(openError).toHaveCount(0);
  await expect(saveError).toBeVisible();
  await saveError.getByRole('button', { name: '关闭消息' }).click();
  await expect(notices).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试保存当前卡片' })).toBeVisible();
});

test('reopening the unchanged current card retains the exact preview DOM', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect.poll(() => page.locator('.preview[data-ready="true"] .card').count()).toBeGreaterThan(0);
  await page.locator('.preview .card').first().evaluate(node => {
    (window as Window & { firstPreviewCard?: Element }).firstPreviewCard = node;
  });
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect(page.locator('.preview')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() =>
    document.querySelector('.preview .card') === (window as Window & { firstPreviewCard?: Element }).firstPreviewCard)).toBe(true);
});

test('clean card requires confirmation and cancel keeps the same preview DOM', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect.poll(() => page.locator('.preview[data-ready="true"] .card').count()).toBeGreaterThan(0);
  const before = await page.locator('.preview .card').first().evaluate(node => {
    (window as Window & { firstPreviewCard?: Element }).firstPreviewCard = node;
    return node.isConnected;
  });
  expect(before).toBe(true);
  const save = page.getByRole('button', { name: '保存', exact: true });
  await expect(save).toHaveAttribute('data-unpaired', 'false');
  await page.getByRole('button', { name: '清空' }).click();
  const dialog = page.getByRole('dialog', { name: '清空当前文章' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('清空将关闭当前文章');
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() =>
    document.querySelector('.preview .card') === (window as Window & { firstPreviewCard?: Element }).firstPreviewCard)).toBe(true);
  await expect(save).toHaveAttribute('data-unpaired', 'false');
});

test('Clear offers Save, Discard, Cancel without deleting the source card', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  const title = page.getByLabel('英文标题', { exact: true });
  await expect(title).toHaveValue('Card A');
  await title.fill('Unsaved revision');
  await page.getByRole('button', { name: '清空' }).click();
  const dialog = page.getByRole('dialog', { name: '清空当前文章' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(title).toHaveValue('Unsaved revision');
  await page.getByRole('button', { name: '清空' }).click();
  await dialog.getByRole('button', { name: '放弃' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(title).toHaveValue('');
  await expect(page.locator('.preview .card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'A.json' })).not.toHaveAttribute('aria-current', 'page');
  const pairWrites = await page.evaluate(() => window.phaseEIO.requests.filter(item => item.command === 'saveArticlePair'));
  expect(pairWrites).toHaveLength(0);
});

test('Paired save failure retains the article and successful retry switches the card library', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  const title = page.getByLabel('英文标题', { exact: true });
  await expect(title).toHaveValue('Card A');
  await page.evaluate(() => { window.phaseEIO.failNextPair = true; });
  await expect(page.getByRole('button', { name: '保存' })).toBeEnabled();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('.phase-e-notices .phase-e-notice-error')).toContainText('Pair save failed');
  await expect(title).toHaveValue('Card A');
  await expect(page.getByRole('button', { name: 'A.json' })).toHaveAttribute('aria-current', 'page');

  await expect(page.getByRole('button', { name: '保存' })).toBeEnabled();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: 'Card A.json' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Card A.json' })).toHaveAttribute('aria-current', 'page');
  const request = await page.evaluate(() => window.phaseEIO.requests.find(item => item.command === 'saveArticlePair'));
  expect((request!.payload as { fileName: string }).fileName).toBe('Card A.json');
});


test('editor preview never empties during edits, JSON autosave, settings dialogs or paired save', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect.poll(() => page.locator('.preview[data-ready="true"] .card').count()).toBeGreaterThan(0);
  const saveButton = page.getByRole('button', { name: '保存', exact: true });
  await expect(saveButton).toHaveAttribute('data-unpaired', 'false');

  await page.evaluate(() => {
    const container = document.querySelector('.preview')!;
    window.phaseEIO.previewAudit = { cleared: 0, replaced: 0, initialCard: container.querySelector('.card') };
    new MutationObserver(() => {
      if (!container.querySelector('.card')) window.phaseEIO.previewAudit!.cleared += 1;
      window.phaseEIO.previewAudit!.replaced += 1;
    }).observe(container, { childList: true });
  });

  await page.getByLabel('英文标题', { exact: true }).fill('Card A revised');
  await expect(saveButton).toHaveAttribute('data-unpaired', 'true');
  await expect.poll(() => page.evaluate(() =>
    window.phaseEIO.requests.some(item => item.command === 'saveCardFile'))).toBe(true);
  // JSON autosave is not a matching ZIP export.
  await expect(saveButton).toHaveAttribute('data-unpaired', 'true');
  await expect(page.locator('.preview')).toHaveAttribute('data-ready', 'true');

  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: '关闭设置' }).click();
  await expect(settings).toHaveCount(0);

  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton).toHaveAttribute('data-unpaired', 'false');
  await expect(page.locator('.preview')).toHaveAttribute('data-ready', 'true');
  const audit = await page.evaluate(() => ({
    cleared: window.phaseEIO.previewAudit!.cleared,
    cardStillRendered: !!document.querySelector('.preview .card'),
  }));
  expect(audit.cleared).toBe(0);
  expect(audit.cardStillRendered).toBe(true);
});

test('overwrite dialogs and cancellation keep the exact preview page mounted and retain the save star', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect.poll(() => page.locator('.preview[data-ready="true"] .card').count()).toBeGreaterThan(0);
  await page.getByLabel('英文标题', { exact: true }).fill('Card A revised');
  const saveButton = page.getByRole('button', { name: '保存', exact: true });
  await expect(saveButton).toHaveAttribute('data-unpaired', 'true');
  await expect(page.locator('.preview')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => {
    window.phaseEIO.existingPairFiles = ['Card A revised.json', 'Card A revised.zip'];
    const container = document.querySelector('.preview')!;
    window.phaseEIO.previewAudit = { cleared: 0, replaced: 0, initialCard: container.querySelector('.card') };
    new MutationObserver(() => {
      if (!container.querySelector('.card')) window.phaseEIO.previewAudit!.cleared += 1;
      window.phaseEIO.previewAudit!.replaced += 1;
    }).observe(container, { childList: true });
  });

  await saveButton.click();
  const dialog = page.getByRole('dialog', { name: '确认覆盖' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(saveButton).toHaveAttribute('data-unpaired', 'true');
  expect(await page.evaluate(() => ({
    cleared: window.phaseEIO.previewAudit!.cleared,
    replaced: window.phaseEIO.previewAudit!.replaced,
    sameCard: document.querySelector('.preview .card') === window.phaseEIO.previewAudit!.initialCard,
  }))).toEqual({ cleared: 0, replaced: 0, sameCard: true });

  await saveButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '覆盖' }).click();
  await expect(saveButton).toHaveAttribute('data-unpaired', 'false');
  expect(await page.evaluate(() => ({
    cleared: window.phaseEIO.previewAudit!.cleared,
    replaced: window.phaseEIO.previewAudit!.replaced,
    sameCard: document.querySelector('.preview .card') === window.phaseEIO.previewAudit!.initialCard,
  }))).toEqual({ cleared: 0, replaced: 0, sameCard: true });
});

test('changing render settings marks the ZIP stale without clearing the visible preview', async ({ page }) => {
  await page.getByRole('button', { name: 'A.json' }).click();
  await expect.poll(() => page.locator('.preview[data-ready="true"] .card').count()).toBeGreaterThan(0);
  const save = page.getByRole('button', { name: '保存', exact: true });
  await expect(save).toHaveAttribute('data-unpaired', 'false');
  await page.evaluate(() => {
    const container = document.querySelector('.preview')!;
    window.phaseEIO.previewAudit = { cleared: 0, replaced: 0, initialCard: container.querySelector('.card') };
    new MutationObserver(() => {
      if (!container.querySelector('.card')) window.phaseEIO.previewAudit!.cleared += 1;
      window.phaseEIO.previewAudit!.replaced += 1;
    }).observe(container, { childList: true });
  });

  await page.getByRole('button', { name: '设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  const font = settings.getByLabel('标题字号');
  const original = Number(await font.inputValue());
  await font.fill(String(original + 1));
  await font.blur();
  await expect(save).toHaveAttribute('data-unpaired', 'true');
  await expect(page.locator('.preview')).toHaveAttribute('data-ready', 'true');
  await settings.getByRole('button', { name: '关闭设置' }).click();
  expect(await page.evaluate(() => window.phaseEIO.previewAudit!.cleared)).toBe(0);
  await expect.poll(() => page.locator('.preview .card').count()).toBeGreaterThan(0);
});

test('settings modal has 560 DIP two-column layout without a divider', async ({ page }) => {
  await page.getByRole('button', { name: '设置' }).click();
  const dialog = page.getByRole('dialog', { name: '设置' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('width', '560px');
  await expect(dialog).toHaveCSS('max-width', '560px');
  await expect(dialog.locator('.settings-columns > .settings-column')).toHaveCount(2);
  await expect(dialog.locator('.settings-columns')).toHaveCSS('column-gap', '20px');
  await expect(dialog.locator('.settings-column').nth(1)).toHaveCSS('border-left-style', 'none');
  await expect(dialog.getByRole('heading', { name: '字号设置' })).toHaveCSS('text-align', 'center');
  await expect(dialog.getByRole('heading', { name: '其余设置' })).toHaveCSS('text-align', 'center');
  await expect(dialog.locator('.settings-table').first().locator('input').first()).toBeVisible();
  await dialog.getByRole('button', { name: '关闭设置' }).click();
  await expect(dialog).toHaveCount(0);
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
  await expect(page.locator('.phase-e-notices .phase-e-notice-error')).toContainText('Disk locked');
  await expect(page.locator('.phase-e-notices .phase-e-notice-error').getByRole('button', { name: '关闭消息' })).toBeVisible();
  await page.getByRole('button', { name: '重试保存当前卡片' }).click();
  await expect(page.getByRole('button', { name: '重试保存当前卡片' })).toHaveCount(0);
  const saves = await page.evaluate(() => window.phaseEIO.requests.filter(item => item.command === 'saveCardFile'));
  expect(saves).toHaveLength(2);
  expect(JSON.parse((saves[1].payload as { text: string }).text).title).toBe('A cannot save');
});
