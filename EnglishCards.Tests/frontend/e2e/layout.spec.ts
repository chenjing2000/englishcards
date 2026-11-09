import { test, expect } from './fixtures';

test('splitter resizes both panes by dragging and keyboard without changing pagination', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const separator = page.getByRole('separator', { name: '调整编辑与预览宽度' });
  await expect(separator).toBeVisible();
  const editor = page.locator('.editor-panel');
  const before = (await editor.boundingBox())!.width;
  const previewBefore = (await page.locator('.preview-panel').boundingBox())!.width;
  const signature = await page.evaluate(() => window.editor.signature);
  const handle = (await separator.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + 100, { steps: 6 });
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before - 80, 0);
  await page.mouse.up();
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before - 80, 0);
  expect((await page.locator('.preview-panel').boundingBox())!.width).toBeCloseTo(previewBefore + 80, 0);
  await separator.focus(); await separator.press('ArrowLeft');
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before - 56, 0);
  await page.setViewportSize({ width: 1000, height: 900 });
  await separator.press('Home');
  await expect.poll(async () => (await page.locator('.preview-panel').boundingBox())!.width).toBeCloseTo(280, 0);
  await separator.press('End');
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(280, 0);
  expect(await page.evaluate(() => window.editor.signature)).toBe(signature);
  await page.screenshot({ path: '.build/test-results/resizable-layout.png' });
});

test('vocabulary preview is rendered as one full-width vertical list', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const blocks = page.locator('.card .vocab[data-source]');
  const geometry = await blocks.evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, width: rect.width, y: rect.y };
  }));
  expect(new Set(await blocks.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.source))).size).toBe(23);
  expect(geometry.every(item => Math.abs(item.width - geometry[0].width) < 1)).toBe(true);
  expect(geometry.every((item, index) => index === 0 || item.y >= geometry[index - 1].y)).toBe(true);
});
