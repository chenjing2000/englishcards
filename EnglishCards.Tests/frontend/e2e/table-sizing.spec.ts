import { test, expect } from './fixtures';

test('vocabulary fields keep compact input sizing and centered table content', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  
  const table = page.getByRole('table', { name: '词汇 1', exact: true });
  await expect(table.locator('textarea')).toHaveCount(3);
  const word = page.getByLabel('词头 1', { exact: true });
  await expect(word).toHaveJSProperty('tagName', 'INPUT');
  await expect(word).toHaveCSS('resize', 'none');
  const height = (await word.boundingBox())!.height;
  await word.fill('A'.repeat(180));
  expect((await word.boundingBox())!.height).toBeCloseTo(height, 0);
  expect(await table.locator('th,td').evaluateAll(cells => cells.every(cell => getComputedStyle(cell).verticalAlign === 'middle'))).toBe(true);
  expect(await table.locator('td').evaluateAll(cells => cells.every(cell => {
    const editor = cell.querySelector('input,textarea,button')!, a = cell.getBoundingClientRect(), b = editor.getBoundingClientRect();
    return Math.abs((a.top + a.bottom - b.top - b.bottom) / 2) < 1;
  }))).toBe(true);
  await page.screenshot({ path: '.build/test-results/compact-vocabulary.png' });
});

test('multiword vocabulary example editors resize with content, undo and pane width', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  
  await page.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true }).click();
  const word = page.getByLabel('词头 2', { exact: true });
  await word.fill('take into account');
  await page.getByLabel('含义 2', { exact: true }).fill('考虑到；将……纳入考虑');
  const example = page.getByLabel('词汇例句 2 义项 1', { exact: true });
  const oneLineHeight = await example.evaluate(node => {
    const s = getComputedStyle(node);
    return parseFloat(s.lineHeight) + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)
      + parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth);
  });
  await expect.poll(async () => (await example.boundingBox())!.height).toBeCloseTo(oneLineHeight, 0);
  await example.fill('Short.');
  const shortHeight = (await example.boundingBox())!.height;
  await example.fill('One\nTwo\nThree\nFour\nFive\nSix');
  await expect.poll(async () => (await example.boundingBox())!.height).toBeGreaterThan(shortHeight + 80);
  expect(await example.evaluate(node => node.clientHeight >= node.scrollHeight - 1)).toBe(true);
  await example.fill('Short.');
  await expect.poll(async () => (await example.boundingBox())!.height).toBeCloseTo(shortHeight, 0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await example.boundingBox())!.height).toBeGreaterThan(shortHeight + 80);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await example.boundingBox())!.height).toBeCloseTo(shortHeight, 0);
  await example.fill('A wrapping example with several words. '.repeat(15));
  const wideHeight = (await example.boundingBox())!.height;
  const separator = page.getByRole('separator', { name: '调整编辑与预览宽度' });
  await separator.focus(); await separator.press('End');
  await expect.poll(async () => (await example.boundingBox())!.height).toBeGreaterThan(wideHeight);
  await page.screenshot({ path: '.build/test-results/auto-height-vocabulary.png' });
});
