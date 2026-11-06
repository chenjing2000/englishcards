import { test, expect } from './fixtures';

test('workspace has compact sense controls and edge-aligned floating actions', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '英语阅读卡片编辑器', exact: true })).toBeVisible();
  await expect(page.locator('.app-header,.status-bar,.preview-toolbar')).toHaveCount(0);
  await expect(page.getByLabel('预览缩放', { exact: true })).toHaveCount(0);
  for (const tab of ['原文', '词汇', '表达', '主旨与译文']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  }
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  const table = page.getByRole('table', { name: '词汇 1', exact: true });
  await expect(table.getByRole('rowheader')).toHaveText(['词汇', '音标', '含义', '例句', '翻译']);
  const add = page.getByRole('button', { name: '为词汇 1 添加义项', exact: true });
  await expect(add).toHaveCSS('width', '16px'); await expect(add).toHaveCSS('height', '16px');
  await expect(table.getByRole('row', { name: /^词汇 / }).getByRole('button')).toHaveText('+');
  await add.click();
  const remove = page.getByRole('button', { name: '删除词汇 1 义项 2', exact: true });
  await expect(remove).toHaveCSS('width', '16px'); await expect(remove).toHaveCSS('height', '16px');
  await remove.click();
  await expect(page.getByRole('button', { name: '删除词汇 1 义项 1', exact: true })).toBeDisabled();
  const actions = page.getByRole('group', { name: '词汇行操作' });
  await expect(actions.locator('button')).toHaveText(['↑', '↓', '+', '×', '↻']);
  await expect(actions).toHaveCSS('gap', '4px');
  for (const button of await actions.locator('button').all()) {
    await expect(button).toHaveCSS('width', '20px'); await expect(button).toHaveCSS('height', '20px');
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  await expect(actions.locator('button').nth(2)).toHaveAttribute('title', '添加新空白词汇');
  await expect(actions.locator('button').nth(4)).toHaveAttribute('title', '更新正文高亮内容');
  const panel = (await page.locator('#editor-panel').boundingBox())!, box = (await actions.boundingBox())!;
  expect(Math.abs(box.x + box.width - panel.x - panel.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height - panel.y - panel.height)).toBeLessThanOrEqual(1);
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  const notice = page.getByLabel('信息提示栏');
  await expect(notice.getByRole('alert')).toContainText('Error:');
  await expect.poll(() => notice.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(0);
  await expect.poll(async () => {
    const a = (await actions.boundingBox())!, b = (await notice.boundingBox())!;
    return Math.abs(a.y + a.height - b.y);
  }).toBeLessThanOrEqual(1);
  expect(await notice.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(120);
  await notice.getByRole('button', { name: '关闭', exact: true }).click();
  await expect.poll(() => notice.evaluate(node => node.getBoundingClientRect().height)).toBe(0);
  await page.getByRole('button', { name: '样式', exact: true }).click();
  for (const input of await page.locator('.settings-table input').all()) await expect(input).toHaveCSS('text-align', 'center');
});

test('preview scrolls normally and only Ctrl plus wheel zooms its activated content', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = page.locator('.preview-scroll');
  await preview.click({ position: { x: 12, y: 12 } });
  const initial = await page.locator('.card').first().evaluate(node => node.getBoundingClientRect().width);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => preview.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.card').first().evaluate(node => node.getBoundingClientRect().width)).toBe(initial);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control');
  await expect.poll(() => page.locator('.card').first().evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(initial);
  await expect(page.getByLabel('预览缩放比例')).toBeVisible();
  await expect(page.getByLabel('预览缩放比例')).not.toBeVisible({ timeout: 4000 });
  const actions = page.getByRole('group', { name: '项目文件操作' });
  await expect(actions.getByRole('button')).toHaveCount(3);
  await expect(actions.getByRole('button').nth(0)).toHaveAttribute('title', '打开 JSON');
  await expect(actions.getByRole('button').nth(1)).toHaveAttribute('title', '保存 JSON');
  await expect(actions.getByRole('button').nth(2)).toHaveAttribute('title', '导出全部 ZIP');
  expect(await page.locator('.card button').count()).toBe(0);
  await page.screenshot({ path: 'artifacts/test-results/new-workspace.png' });
});

test('Ctrl wheel keeps the pointed position stable on a middle card', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = page.locator('.preview-scroll');
  await preview.click({ position: { x: 12, y: 12 } });
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -1100); await page.keyboard.up('Control');
  const card = page.locator('.card').nth(1);
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(1200);
  await card.evaluate(node => {
    const scroll = node.closest('.preview-scroll')!, rect = node.getBoundingClientRect(), view = scroll.getBoundingClientRect();
    scroll.scrollTop += rect.top - view.top + rect.height / 2 - scroll.clientHeight / 2;
    scroll.scrollLeft = 200;
  });
  const before = (await card.boundingBox())!, view = (await preview.boundingBox())!;
  const point = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const relative = { x: (point.x - before.x) / before.width, y: (point.y - before.y) / before.height };
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
  await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(before.width);
  const after = (await card.boundingBox())!;
  expect(Math.abs(after.x + relative.x * after.width - point.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y + relative.y * after.height - point.y)).toBeLessThanOrEqual(1);
});


test('desktop target layout places preview on the left at 70%, editor on the right', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const preview = await page.locator('#preview-panel').boundingBox();
  const editor = await page.locator('#editor-panel').boundingBox();
  const workspace = await page.locator('.workspace').boundingBox();
  expect(preview && editor && workspace).toBeTruthy();
  expect(preview!.x + preview!.width).toBeLessThan(editor!.x);
  expect(Math.abs(preview!.width / (workspace!.width - 8) - 0.70)).toBeLessThan(0.02);
  await expect(page.getByRole('button', { name: '导出全部 ZIP' })).toHaveCount(1);
});


test('desktop style tables center values and place configuration actions below both tables', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '样式', exact: true }).click();
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
