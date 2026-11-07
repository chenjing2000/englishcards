import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { parseProject } from '@frontend/models/project';

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

test('expressions use four rows and two columns and keep preview navigation', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '表达', exact: true }).click();
  const table = page.getByRole('table', { name: '表达 1', exact: true });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('rowheader')).toHaveText(['短语', '含义', '例句', '翻译']);
  await expect(table.getByRole('cell')).toHaveCount(4);
  await page.getByLabel('含义 1', { exact: true }).fill('表格中修改的含义');
  await page.getByLabel('翻译 1', { exact: true }).fill('表格中修改的翻译');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.meaning[data-source="x-1:meaning"]').first()).toContainText('含义：表格中修改的含义');
  await page.locator('.exampleTranslation[data-source="x-1:exampleTranslation"]').first().click();
  await expect(page.getByLabel('翻译 1', { exact: true })).toBeFocused();
  await page.screenshot({ path: '.build/test-results/expression-tables.png' });
});

test('colored expression labels appear once and participate in real line measurement', async ({ page }) => {
  await page.goto('/render'); await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseProject(fixture);
  project.source.paragraphs = []; project.vocabulary = [];
  project.expressions = [
    { id: 'long', phrase: 'A phrase', senses: [{ pos: '', meaning: '很长的含义。'.repeat(300), example: 'An example sentence. '.repeat(200), exampleTranslation: '很长的例句译文。'.repeat(200) }], highlight: [] },
    { id: 'empty', phrase: '', senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }], highlight: [] },
  ];
  await page.evaluate(input => window.renderProject(input), project);
  for (const [field, label] of [['meaning', '含义：'], ['example', '例句：'], ['exampleTranslation', '翻译：']] as const) {
    const lines = page.locator(`[data-source="long:${field}"]`);
    await expect(lines.locator('.expression-label')).toHaveText([label]);
    await expect(lines.locator('.expression-label')).toHaveCSS('color', 'rgb(0, 109, 135)');
    expect((await lines.locator('.line-content').allTextContents()).join('')).toBe(project.expressions[0].senses[0][field]);
    const pages = await lines.evaluateAll(nodes => new Set(nodes.map(node => node.closest('.card')!.getAttribute('data-page'))).size);
    expect(pages).toBeGreaterThan(1);
    await expect(page.locator(`[data-source="empty:${field}"] .expression-label`)).toHaveText(label);
  }
  expect(await page.locator('[data-source]').evaluateAll(nodes => nodes.every(node => {
    const line = node.getBoundingClientRect(), body = node.closest('.page-body')!.getBoundingClientRect();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) {
      for (const part of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text.textContent!)) {
        if (!part.segment.trim()) continue;
        const range = document.createRange(); range.setStart(text, part.index); range.setEnd(text, part.index + part.segment.length);
        const glyph = range.getBoundingClientRect();
        if (glyph.right > line.right + .75 || glyph.bottom > body.bottom + .75) return false;
      }
    }
    return line.bottom <= body.bottom + .75;
  }))).toBe(true);
});
