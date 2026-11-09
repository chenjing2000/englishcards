import { test, expect, type Page } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { unzipSync } from 'fflate';
import { selectPreviewText } from './preview-selection';

async function ready(page: Page) { await expect(page.locator('[data-ready="true"]')).toBeVisible(); }
async function load(page: Page, data: unknown) {
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'article.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  });
  await ready(page);
}

test('Article v6 continuous editing, portable JSON, draft recovery and strict imports', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const text = fixture.content.paragraphs.map(paragraph => paragraph.text).join('\n\n');
  const changed = text.replace('supposedly', 'reportedly and supposedly');
  const body = page.getByLabel('英文正文', { exact: true });
  await expect(body).toHaveValue(text);
  await body.fill(changed); await ready(page);

  await page.getByLabel('词头 1', { exact: true }).fill('edited word');
  await page.getByLabel('词头 23', { exact: true }).click();
  await page.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true }).click();
  await page.getByLabel('词头 24', { exact: true }).fill('new vocabulary');
  await page.getByLabel('词头 3', { exact: true }).click();
  await page.getByRole('button', { name: '删除选中词汇', exact: true }).click();

  const translation = page.getByLabel('中文译文', { exact: true });
  await translation.fill('');
  await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const download = await downloadPromise;
  const { readFile } = await import('node:fs/promises');
  const saved = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(saved.schemaVersion).toBe(6);
  expect(saved.content.paragraphs[1].text).toBe(fixture.content.paragraphs[1].text.replace('supposedly', 'reportedly and supposedly'));
  expect(saved.vocabulary[0].word).toBe('edited word');
  expect(saved.translation.paragraphs).toEqual([]);
  expect(saved.vocabulary.map((entry: { id: string }) => entry.id))
    .toEqual(saved.vocabulary.map((_: unknown, i: number) => `v${String(i + 1).padStart(3, '0')}`));
  expect(saved).not.toHaveProperty('source');
  expect(saved).not.toHaveProperty('expressions');
  expect(saved).not.toHaveProperty('mainIdea');
  await page.reload(); await ready(page);
  await expect(page.getByLabel('英文正文')).toHaveValue(changed);
  await load(page, saved);
  await expect(page.getByLabel('英文正文')).toHaveValue(changed);

  const alert = page.getByRole('alert');
  for (const invalid of ['{', JSON.stringify({ ...fixture, schemaVersion: 5 }), JSON.stringify({ ...fixture, title: null }), JSON.stringify({ ...fixture, title: '\uFFFD' })]) {
    if (await alert.count()) {
      await alert.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(alert).toHaveCount(0);
    }
    await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
      name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(invalid),
    });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('无法打开文章');
    await expect(page.getByLabel('英文正文')).toHaveValue(changed);
  }
});

test('preview selection plus adds vocabulary while ordinary preview clicks never focus editors', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const text = 'A runner crossed the field.';
  await load(page, { ...fixture, content: { paragraphs: [{ id: 'p001', text }] }, vocabulary: [] });
  expect(await selectPreviewText(page, 'p001', text, 'runner')).toBe(true);
  const add = page.getByRole('button', { name: '将选中文字加入词汇' });
  await expect(add).toBeVisible();
  await add.click(); await ready(page);
  expect(await page.evaluate(() => window.editor.project.vocabulary[0])).toMatchObject({
    id: 'v001', word: 'runner', highlight: ['runner'],
  });

  const title = page.getByLabel('英文标题', { exact: true });
  const body = page.getByLabel('英文正文', { exact: true });
  const translation = page.getByLabel('中文译文', { exact: true });
  await page.locator('.card [data-kind="title"]').first().click();
  await expect(title).not.toBeFocused();
  await page.locator('.card [data-kind="article"]').first().click();
  await expect(body).not.toBeFocused();
  await page.locator('.card [data-kind="translation"]').first().click();
  await expect(translation).not.toBeFocused();
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
