import { test, expect } from './fixtures';

async function dragSplitterToEdge(page: import('@playwright/test').Page, edge: 'min' | 'max') {
  const workspace = (await page.locator('.workspace').boundingBox())!;
  const separator = (await page.getByRole('separator', { name: '调整编辑与预览宽度' }).boundingBox())!;
  const minimum = Math.min(280, Math.floor((workspace.width - 8) / 2));
  const available = workspace.width - 8;
  const targetWidth = edge === 'min' ? minimum : available - minimum;
  const y = separator.y + separator.height / 2;
  await page.mouse.move(separator.x + separator.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(workspace.x + targetWidth + 4, y, { steps: 12 });
  await page.mouse.up();
}

test('workspace has compact sense controls and edge-aligned floating actions', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '英语阅读卡片编辑器', exact: true })).toBeVisible();
  await expect(page.locator('.app-header,.status-bar,.preview-toolbar')).toHaveCount(0);
  await expect(page.locator('.zoom-toolbar')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const table = page.getByRole('table', { name: '词汇 1', exact: true });
  await expect(table.getByRole('rowheader')).toHaveText(['词汇', '音标', '高亮词汇', '含义', '例句', '翻译']);
  const add = page.getByRole('button', { name: '为词汇 1 添加义项', exact: true });
  await expect(add).toHaveCSS('width', '16px'); await expect(add).toHaveCSS('height', '16px');
  await expect(table.getByRole('row', { name: /^词汇 / }).getByRole('button')).toHaveText('+');
  await add.click();
  const remove = page.getByRole('button', { name: '删除词汇 1 义项 2', exact: true });
  await expect(remove).toHaveCSS('width', '16px'); await expect(remove).toHaveCSS('height', '16px');
  await remove.click();
  await expect(page.getByRole('button', { name: '删除词汇 1 义项 1', exact: true })).toBeDisabled();
  const actions = page.getByRole('group', { name: '词汇行操作' });
  await expect(actions.locator('button')).toHaveCount(4);
  await expect(actions).toHaveCSS('gap', '4px');
  for (const button of await actions.locator('button').all()) {
    await expect(button).toHaveCSS('width', '21px');
    await expect(button).toHaveCSS('height', '21px');
    await expect(button).toHaveCSS('border-radius', '7px');
    await expect(button.locator('svg')).toBeVisible();
    await expect(button.locator('svg')).toHaveCSS('width', '15px');
    await expect(button.locator('svg')).toHaveCSS('height', '15px');
    await expect(button).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  await expect(actions.locator('button').nth(0)).toHaveAttribute('aria-label', '上移选中词汇');
  await expect(actions.locator('button').nth(1)).toHaveAttribute('aria-label', '下移选中词汇');
  await expect(actions.locator('button').nth(2)).toHaveAttribute('title', '添加新空白词汇');
  await expect(actions.locator('button').nth(3)).toHaveAttribute('aria-label', '删除选中词汇');
  await expect(page.getByRole('button', { name: '刷新词汇高亮', exact: true })).toHaveCount(0);
  const panel = (await page.locator('#editor-panel').boundingBox())!, box = (await actions.boundingBox())!;
  expect(Math.abs(box.x + box.width - panel.x - panel.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height - panel.y - panel.height)).toBeLessThanOrEqual(1);
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  const notice = page.getByLabel('信息提示栏');
  await expect(notice.getByRole('alert')).toContainText('JSON 语法错误');
  await expect.poll(() => notice.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(0);
  await expect.poll(async () => {
    const a = (await actions.boundingBox())!, b = (await notice.boundingBox())!;
    return Math.abs(a.y + a.height - b.y);
  }).toBeLessThanOrEqual(1);
  expect(await notice.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(120);
  await notice.getByRole('button', { name: '关闭', exact: true }).click();
  await expect.poll(() => notice.evaluate(node => node.getBoundingClientRect().height)).toBe(0);
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  for (const input of await page.locator('.settings-table input').all()) await expect(input).toHaveCSS('text-align', 'center');
});


test('splitter does not respond to keyboard arrow or Home/End keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const editor = page.locator('#editor-panel');
  const before = (await editor.boundingBox())!.width;
  const separator = page.getByRole('separator', { name: '调整编辑与预览宽度' });
  await separator.evaluate(node => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
  });
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before, 0);
});

test('preview scrolls normally and Ctrl plus wheel alone changes the stored zoom', async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1000 });
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = page.locator('.preview-scroll');
  const card = page.locator('.card').first();
  await preview.click({ position: { x: 12, y: 12 } });
  const initial = await card.evaluate(node => node.getBoundingClientRect().width);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => preview.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await card.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(initial, 0);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 500); await page.keyboard.up('Control');
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeLessThan(initial);
  const reduced = await card.evaluate(node => node.getBoundingClientRect().width);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -500); await page.keyboard.up('Control');
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(reduced);
  await expect(page.locator('.zoom-toolbar')).toHaveCount(0);
  await expect(preview).toHaveCSS('overflow-x', 'hidden');
  const actions = page.getByRole('group', { name: '项目文件操作' });
  await expect(actions.getByRole('button')).toHaveCount(2);
  await expect(actions.getByRole('button').nth(0)).toHaveAttribute('title', '打开文章');
  await expect(actions.getByRole('button').nth(1)).toHaveAttribute('title', '保存 JSON');
  expect(await page.locator('.card button').count()).toBe(0);
});

test('Ctrl wheel preserves the pointed reading position and cards remain centered', async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1000 });
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = page.locator('.preview-scroll');
  const card = page.locator('.card').nth(1);
  await card.evaluate(node => {
    const scroll = node.closest('.preview-scroll')!, rect = node.getBoundingClientRect(), view = scroll.getBoundingClientRect();
    scroll.scrollTop += rect.top - view.top + rect.height / 2 - scroll.clientHeight / 2;
  });
  const before = (await card.boundingBox())!, view = (await preview.boundingBox())!;
  const point = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const relativeY = (point.y - before.y) / before.height;
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 300); await page.keyboard.up('Control');
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeLessThan(before.width);
  const after = (await card.boundingBox())!;
  const contentCenter = await preview.evaluate(node => {
    const style = getComputedStyle(node);
    return node.getBoundingClientRect().left + node.clientLeft + node.clientWidth / 2;
  });
  expect(Math.abs(after.x + after.width / 2 - contentCenter)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y + relativeY * after.height - point.y)).toBeLessThanOrEqual(2);
});

test('card width is constrained by the preview pane and a narrower pane permanently reduces zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = page.locator('.preview-scroll');
  const card = page.locator('.card').first();
  await dragSplitterToEdge(page, 'min');
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(
    await preview.evaluate(node => { const style = getComputedStyle(node); return node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight); }) + 1
  );
  const narrowWidth = (await card.boundingBox())!.width;
  const narrowScale = Number.parseFloat(await page.locator('.preview').evaluate(node => getComputedStyle(node).getPropertyValue('--zoom')));
  expect(narrowScale).toBeGreaterThanOrEqual(0.2);
  expect(narrowScale).toBeLessThan(0.3);
  await dragSplitterToEdge(page, 'max');
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(narrowWidth, 0);
  const widenedScale = Number.parseFloat(await page.locator('.preview').evaluate(node => getComputedStyle(node).getPropertyValue('--zoom')));
  expect(widenedScale).toBeCloseTo(narrowScale, 3);
  await expect(preview).toHaveCSS('overflow-x', 'hidden');
  const cardBox = (await card.boundingBox())!;
  const previewBox = (await preview.boundingBox())!;
  expect(cardBox.x).toBeGreaterThanOrEqual(previewBox.x);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(previewBox.x + previewBox.width);
});

test('manual zoom clamps to 20%–100% and does not impose a preview-height limit', async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1000 });
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = page.locator('.preview-scroll');
  const card = page.locator('.card').first();
  // Give the preview enough horizontal room for the card's true 100% width.
  await dragSplitterToEdge(page, 'max');
  await preview.click({ position: { x: 20, y: 20 } });
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 5000); await page.keyboard.up('Control');
  await expect.poll(() => page.locator('.preview').evaluate(node => getComputedStyle(node).getPropertyValue('--zoom').trim())).toBe('0.2');
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -5000); await page.keyboard.up('Control');
  await expect.poll(() => page.locator('.preview').evaluate(node => getComputedStyle(node).getPropertyValue('--zoom').trim())).toBe('1');
  expect((await card.boundingBox())!.width).toBeCloseTo(1200, 0);
  expect((await card.boundingBox())!.height).toBeCloseTo(1600, 0);
  expect(await preview.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
});

test('desktop target layout places preview on the left at 55%, editor on the right', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = await page.locator('#preview-panel').boundingBox();
  const editor = await page.locator('#editor-panel').boundingBox();
  const workspace = await page.locator('.workspace').boundingBox();
  expect(preview && editor && workspace).toBeTruthy();
  expect(preview!.x + preview!.width).toBeLessThan(editor!.x);
  expect(Math.abs(preview!.width / (workspace!.width - 8) - 0.55)).toBeLessThan(0.02);
  await expect(page.getByRole('button', { name: '导出全部 ZIP' })).toHaveCount(0);
});


test('desktop style tables center values and place configuration actions below both tables', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  const tables = page.locator('.style-settings .settings-table');
  await expect(tables).toHaveCount(2);
  expect(await tables.evaluateAll(nodes => nodes.every(table => Array.from(table.querySelectorAll('tr')).every(row => {
    const cell = row.children[1] as HTMLElement;
    if (!cell || getComputedStyle(cell).textAlign !== 'center') return false;
    const input = cell.querySelector('input');
    return !input || getComputedStyle(input).textAlign === 'center';
  })))).toBe(true);
  const second = (await tables.nth(1).boundingBox())!;
  const hint = (await page.locator('.style-settings-hint').boundingBox())!;
  expect(hint.y - (second.y + second.height)).toBeCloseTo(20, 0);
  await expect(page.getByRole('button', { name: '默认配置', exact: true })).toBeVisible();
  // Browser test does not show the WPF-only import action.
  await expect(page.getByRole('button', { name: '导入配置', exact: true })).toHaveCount(0);
});
