import { test, expect } from './fixtures';

async function dragSplitterToEdge(page: import('@playwright/test').Page, edge: 'min' | 'max') {
  const workspace = (await page.locator('.workspace').boundingBox())!;
  const separator = (await page.getByRole('separator', { name: '调整编辑与预览宽度' }).boundingBox())!;
  const minimum = Math.min(280, Math.floor((workspace.width - 8) / 2));
  const targetWidth = edge === 'min' ? minimum : workspace.width - 8 - minimum;
  const y = separator.y + separator.height / 2;
  await page.mouse.move(separator.x + separator.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(workspace.x + targetWidth + 4, y, { steps: 12 });
  await page.mouse.up();
}

test('splitter resizes both panes by mouse without changing pagination or responding to keyboard', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const separator = page.getByRole('separator', { name: '调整编辑与预览宽度' });
  await expect(separator).toBeVisible();
  const editor = page.locator('.editor-panel');
  const preview = page.locator('.preview-panel');
  const before = (await editor.boundingBox())!.width;
  const previewBefore = (await preview.boundingBox())!.width;
  const signature = await page.evaluate(() => window.editor.signature);
  const handle = (await separator.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + 100, { steps: 6 });
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before - 80, 0);
  await page.mouse.up();
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before - 80, 0);
  expect((await preview.boundingBox())!.width).toBeCloseTo(previewBefore + 80, 0);

  const afterDrag = (await editor.boundingBox())!.width;
  await separator.evaluate(node => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
  });
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(afterDrag, 0);

  await page.setViewportSize({ width: 1000, height: 900 });
  await dragSplitterToEdge(page, 'min');
  await expect.poll(async () => (await preview.boundingBox())!.width).toBeCloseTo(280, 0);
  await dragSplitterToEdge(page, 'max');
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(280, 0);
  expect(await page.evaluate(() => window.editor.signature)).toBe(signature);
  await page.screenshot({ path: '.build/test-results/resizable-layout.png' });
});

test('splitter remains draggable beside an active vocabulary editor field', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const word = page.getByLabel('词头 1', { exact: true });
  await word.focus();

  const editor = page.locator('.editor-panel');
  const separator = page.getByRole('separator', { name: '调整编辑与预览宽度' });
  const before = (await editor.boundingBox())!.width;
  const handle = (await separator.boundingBox())!;
  const startX = handle.x + handle.width + 4; // Exercise the expanded hit target on the editor side.
  const y = handle.y + handle.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 80, y, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => (await editor.boundingBox())!.width).toBeCloseTo(before - 80, 0);
  await expect(word).toHaveValue('study');
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
