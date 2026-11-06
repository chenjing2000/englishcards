import { test, expect } from './fixtures';

test('vocabulary cells are single-line editors with centered content', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '词汇', exact: true }).click();
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
  await page.screenshot({ path: 'artifacts/test-results/compact-vocabulary.png' });
});

test('expression editors fit initial content, editing, undo and changed column widths', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '表达', exact: true }).click();
  const table = page.getByRole('table', { name: '表达 1', exact: true });
  const phrase = page.getByLabel('短语 1', { exact: true });
  const oneLineHeight = await phrase.evaluate(node => {
    const s = getComputedStyle(node);
    return parseFloat(s.lineHeight) + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth);
  });
  await expect.poll(async () => (await phrase.boundingBox())!.height).toBeCloseTo(oneLineHeight, 0);
  const example = page.getByLabel('例句 1', { exact: true });
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
  const narrowHeight = (await example.boundingBox())!.height;
  const separator = page.getByRole('separator', { name: '调整编辑与预览宽度' });
  await separator.focus(); await separator.press('Home');
  await expect.poll(async () => (await example.boundingBox())!.height).toBeLessThan(narrowHeight - 20);
  expect(await table.locator('th,td').evaluateAll(cells => cells.every(cell => getComputedStyle(cell).verticalAlign === 'middle'))).toBe(true);
  await page.screenshot({ path: 'artifacts/test-results/auto-height-expressions.png' });
});
