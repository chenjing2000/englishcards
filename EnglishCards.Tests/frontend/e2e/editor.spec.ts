import { test, expect, type Page } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { unzipSync } from 'fflate';

async function ready(page: Page) { await expect(page.locator('[data-ready="true"]')).toBeVisible(); }
async function load(page: Page, data: unknown) {
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'article.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  });
  await ready(page);
}

test('Article v6 editing, portable JSON, history, draft recovery and strict imports', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const secondText = fixture.content.paragraphs[1].text;
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(secondText);
  const changed = secondText.replace('supposedly', 'reportedly and supposedly');
  await page.getByLabel('英文段落 2', { exact: true }).fill(changed); await ready(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(secondText);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);

  await page.getByRole('button', { name: '词汇', exact: true }).click();
  await page.getByLabel('词头 1', { exact: true }).fill('edited word');
  await page.getByLabel('词头 23', { exact: true }).click();
  await page.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true }).click();
  await page.getByLabel('词头 24', { exact: true }).fill('new vocabulary');
  await page.getByLabel('词头 3', { exact: true }).click();
  await page.getByRole('button', { name: '删除选中词汇', exact: true }).click();

  await page.getByRole('button', { name: '译文', exact: true }).click();
  // The single continuous Translation editor is part of the later UI consolidation.
  // Until that phase lands, retain coverage for the existing paragraph controls.
  await expect(page.getByRole('button', { name: /添加中文段落/ })).toHaveCount(1);
  await page.getByLabel('中文段落 1', { exact: true }).fill('');
  await expect(page.getByText('空段落将保留，不影响其他段落。', { exact: true })).toBeVisible();
  await ready(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const download = await downloadPromise;
  const { readFile } = await import('node:fs/promises');
  const saved = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(saved.schemaVersion).toBe(6);
  expect(saved.content.paragraphs[1].text).toBe(changed);
  expect(saved.vocabulary[0].word).toBe('edited word');
  expect(saved.vocabulary.map((entry: { id: string }) => entry.id)).toEqual(saved.vocabulary.map((_: unknown, i: number) => `v${String(i + 1).padStart(3, '0')}`));
  expect(saved).not.toHaveProperty('source');
  expect(saved).not.toHaveProperty('expressions');
  expect(saved).not.toHaveProperty('mainIdea');
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: '原文', exact: true }).click();
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);
  await load(page, saved);
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);

  const alert = page.getByRole('alert');
  for (const invalid of ['{', JSON.stringify({ ...fixture, schemaVersion: 5 }), JSON.stringify({ ...fixture, title: null }), JSON.stringify({ ...fixture, title: '\uFFFD' })]) {
    // Clear the previous notice so every rejected import must produce a fresh alert.
    if (await alert.count()) {
      await alert.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(alert).toHaveCount(0);
    }
    await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
      name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(invalid),
    });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('无法打开文章');
    await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);
  }
});

test('vocabulary highlight rules apply to all occurrences and preview navigation', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await load(page, { ...fixture, content: { paragraphs: [{ id: 'p001', text: 'word word' }] } });
  const input = page.getByLabel('英文段落 1', { exact: true });
  await input.evaluate((node: HTMLTextAreaElement) => { node.focus(); node.setSelectionRange(5, 9); });
  await page.getByRole('button', { name: '高亮 / 取消高亮 1', exact: true }).click(); await ready(page);
  await expect(page.locator('.card .hot')).toHaveText(['word', 'word']);
  await input.evaluate((node: HTMLTextAreaElement) => { node.focus(); node.setSelectionRange(5, 9); });
  await page.getByRole('button', { name: '高亮 / 取消高亮 1', exact: true }).click(); await ready(page);
  await expect(page.locator('.card .hot')).toHaveCount(0);
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  await expect(page.getByLabel('词头 1', { exact: true })).toHaveValue(fixture.vocabulary[0].word);
});

test('failed import cannot re-enable export after pagination fails', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.evaluate(() => { crypto.subtle.digest = async () => { throw new Error('Simulated layout failure'); }; });
  await page.getByLabel('英文标题', { exact: true }).fill('A changed article');
  await expect(page.getByRole('alert')).toContainText('分页失败');
  const exportButton = page.getByRole('button', { name: '导出全部 ZIP', exact: true });
  await expect(exportButton).toBeDisabled();
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('分页失败');
  await page.getByLabel('信息提示栏').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('无法打开文章');
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('A changed article');
  await expect(exportButton).toBeDisabled();
});

test('long content and translation paginate without gaps; vocabulary is a single column', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const longText = ('A complete line of English. '.repeat(200)) + 'W'.repeat(800);
  const chinese = '中文段落（标点），混合English123。👨‍👩‍👧‍👦 é '.repeat(170);
  const article = {
    ...fixture,
    content: { paragraphs: [{ id: 'p001', text: longText }] },
    vocabulary: [{ id: 'v001', word: 'long phrase', highlight: [], senses: [{
      pos: '', meaning: '含义'.repeat(80), example: 'Example sentence. '.repeat(150), exampleTranslation: '例句翻译。'.repeat(150),
    }] }],
    translation: { paragraphs: [{ id: 'p001', text: chinese }] },
  };
  await load(page, article);
  const pages = await page.locator('.card').count();
  expect(pages).toBeGreaterThan(3);
  const coverage = await page.evaluate(() => {
    const map = new Map<string, HTMLElement[]>();
    document.querySelectorAll<HTMLElement>('.card [data-source]').forEach(node => {
      const key = node.dataset.key ?? node.dataset.source!;
      map.set(key, [...(map.get(key) ?? []), node]);
    });
    const errors: string[] = [];
    for (const [key, nodes] of map) {
      let cursor = 0;
      for (const node of nodes) {
        if (Number(node.dataset.start) !== cursor) errors.push(`gap:${key}:${cursor}`);
        cursor = Number(node.dataset.end);
      }
    }
    return errors;
  });
  expect(coverage).toEqual([]);
  const vocabLines = page.locator('.vocab[data-source="v001"]');
  expect(await vocabLines.count()).toBeGreaterThan(1);
  const exportSnapshot = await page.evaluate(() => window.editor);
  const response = await page.request.post('/api/export', { data: exportSnapshot });
  expect(response.ok(), response.ok() ? '' : await response.text()).toBe(true);
  const files = unzipSync(new Uint8Array(await response.body()));
  expect(files['article.json']).toBeTruthy();
  expect(Object.keys(files).filter(name => name.endsWith('.png')).length).toBe(pages);
});
