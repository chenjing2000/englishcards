import { test, expect } from './fixtures';
import { selectPreviewText } from './preview-selection';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

async function expectRightClickBlocked(locator: import('@playwright/test').Locator) {
  const result = await locator.evaluate(element => {
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    const contextMenuAllowed = element.dispatchEvent(contextMenu);
    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 2 });
    const pointerDownAllowed = element.dispatchEvent(pointerDown);
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2 });
    const mouseDownAllowed = element.dispatchEvent(mouseDown);
    return {
      contextMenuPrevented: contextMenu.defaultPrevented,
      contextMenuAllowed,
      pointerDownPrevented: pointerDown.defaultPrevented,
      pointerDownAllowed,
      mouseDownPrevented: mouseDown.defaultPrevented,
      mouseDownAllowed,
    };
  });
  expect(result).toEqual({
    contextMenuPrevented: true,
    contextMenuAllowed: false,
    pointerDownPrevented: true,
    pointerDownAllowed: false,
    mouseDownPrevented: true,
    mouseDownAllowed: false,
  });
}

test('global input policy disables right-click menus and Undo/Redo while retaining clipboard shortcuts', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toHaveCount(0);

  const title = page.getByLabel('英文标题', { exact: true });
  await title.fill('');
  await title.pressSequentially('unchanged');
  await title.press('Control+Z');
  await expect(title).toHaveValue('unchanged');
  await title.press('Control+Y');
  await expect(title).toHaveValue('unchanged');
  await title.press('Control+Shift+Z');
  await expect(title).toHaveValue('unchanged');

  // Clipboard shortcuts remain native editing operations.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const identity = page.getByLabel('IdentityTag', { exact: true });
  await title.fill('clipboard sample');
  await title.focus();
  await title.press('Control+A');
  await title.press('Control+C');
  await identity.fill('');
  await identity.focus();
  await identity.press('Control+V');
  await expect(identity).toHaveValue('clipboard sample');

  await expectRightClickBlocked(page.locator('.preview-scroll'));
  await expectRightClickBlocked(title);
  await expectRightClickBlocked(page.getByLabel('英文正文', { exact: true }));

  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await expect(page.getByLabel('设置面板')).toBeVisible();
  await expectRightClickBlocked(page.locator('.style-settings'));

  await page.getByRole('button', { name: '返回文章编辑', exact: true }).click();
  const text = 'A selected word.';
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'right-click.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...fixture, content: { paragraphs: [{ id: 'p001', text }] }, vocabulary: [] })),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect(await selectPreviewText(page, 'p001', text, 'selected')).toBe(true);
  const add = page.getByRole('button', { name: '将选中文字加入词汇' });
  await expect(add).toBeVisible();
  await expectRightClickBlocked(add);
});
