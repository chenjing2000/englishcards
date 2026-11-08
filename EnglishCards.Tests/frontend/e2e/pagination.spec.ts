import { test, expect, chromium } from './fixtures';
import { mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { parseRenderProject, projectDocument } from '@frontend/models/project';

test('vocabulary item can continue across pages while preserving all sense text', async ({ page }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject({
    ...fixture,
    title: 'Boundary',
    content: { paragraphs: [{ id: 'p001', text: 'Filler sentence. '.repeat(70) }] },
    vocabulary: [{
      id: 'v001', word: 'target phrase', ipa: '',
      highlight: [],
      senses: [{ pos: '', meaning: '中文含义'.repeat(150), example: 'An example follows. '.repeat(100), exampleTranslation: '例句译文。'.repeat(100) }],
    }],
    translation: { paragraphs: [] },
  });
  await page.evaluate(input => window.renderProject(input), project);
  const entryLines = page.locator('[data-source="v001"]');
  const pages = await entryLines.evaluateAll(nodes => new Set(nodes.map(node => node.closest('.card')!.getAttribute('data-page'))).size);
  expect(pages).toBeGreaterThan(1);
  expect((await entryLines.allTextContents()).join('')).toContain('target phrase');
  expect((await entryLines.allTextContents()).join('')).toContain('An example follows.');
});

test('all Article v6 fields preserve exact text and visible graphemes fit', async ({ page }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const longText = 'A new line.\n\n👩🏽‍💻 é ' + 'X'.repeat(500) + ' hello ' + ' '.repeat(400) + 'world';
  const chinese = '中文段落（标点），混合English123。👨‍👩‍👧‍👦 é '.repeat(100);
  const project = parseRenderProject({
    ...fixture,
    title: 'Unicode test',
    content: { paragraphs: [{ id: 'p001', text: longText }] },
    vocabulary: [{
      id: 'v001', word: 'W'.repeat(100), ipa: '',
      highlight: [],
      senses: [{ pos: 'n.', meaning: '超长释义'.repeat(80), example: 'An example sentence. '.repeat(100), exampleTranslation: '很长的例句译文。'.repeat(80) }],
    }],
    translation: { paragraphs: [{ id: 'p001', text: chinese }] },
  });
  await page.evaluate(input => window.renderProject(input), project);
  const texts: Record<string, string> = {
    title: project.title,
    p001: longText,
  };
  const contentNodes = page.locator('.article[data-source="p001"]');
  expect((await contentNodes.allTextContents()).join('')).toBe(longText);
  expect((await page.locator('.translation[data-source="p001"]').allTextContents()).join('')).toBe(chinese);
  const errors = await page.evaluate(() => {
    const errors: string[] = [];
    for (const line of document.querySelectorAll<HTMLElement>('[data-source]')) {
      const body = line.closest('.page-body')!.getBoundingClientRect();
      const box = line.getBoundingClientRect();
      if (box.bottom > body.bottom + .5) errors.push(`line-bottom:${line.dataset.source}`);
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        for (const part of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(node.textContent!)) {
          if (!part.segment.trim()) continue;
          const range = document.createRange();
          range.setStart(node, part.index);
          range.setEnd(node, part.index + part.segment.length);
          const rect = range.getBoundingClientRect();
          if (rect.right > box.right + .75 || rect.bottom > body.bottom + .75) {
            errors.push(`glyph:${line.dataset.source}:${part.segment}`);
            break;
          }
        }
      }
    }
    return [...new Set(errors)];
  });
  expect(errors).toEqual([]);
});

test('missing fonts stop pagination with a recoverable message, without disabling JSON save', async ({ page }) => {
  await page.route(/\.(woff2?|ttf)(\?.*)?$/, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('本地字体加载失败');
  await expect(page.getByRole('button', { name: '导出全部 ZIP', exact: true })).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('article.json');
});

test('Article v6 draft survives a real Chromium process restart', async () => {
  const directory = await mkdtemp(resolve('.build/test-results/profile-'));
  let context = await chromium.launchPersistentContext(directory, { headless: true });
  try {
    let page = await context.newPage();
    await page.goto(test.info().project.use.baseURL!);
    await expect(page.locator('[data-ready="true"]')).toBeVisible();
    await page.getByLabel('英文段落 2', { exact: true }).fill('Preserved across a browser restart.');
    await expect(page.locator('[data-ready="true"]')).toBeVisible();
    await context.close();
    context = await chromium.launchPersistentContext(directory, { headless: true });
    page = await context.newPage();
    await page.goto(test.info().project.use.baseURL!);
    await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue('Preserved across a browser restart.');
    await expect(page.getByLabel('信息提示栏')).toHaveText('');
  } finally { await context.close(); }
});

test('local resources and failed draft storage are visible', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('自动草稿保存失败！请立即下载 JSON 备份。');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('自动草稿保存失败');
});

test('corrupt v6 drafts stay recoverable and repeated preview rendering remains stable', async ({ page }) => {
  const corrupt = '{"article":{"schemaVersion":6,"broken":true},bad-json';
  await page.addInitScript(value => localStorage.setItem('article-editor.draft.v6', value), corrupt);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('article-editor.rejected-draft'))).toBe(corrupt);
  const before = await page.locator('.footer>span:first-child').first().evaluate(node => getComputedStyle(node).fontSize);
  await page.setViewportSize({ width: 1800, height: 2000 });
  expect(await page.locator('.footer>span:first-child').first().evaluate(node => getComputedStyle(node).fontSize)).toBe(before);
});

test('content and translation may both use p001 without ID collision; vocabulary order is stable', async ({ page }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject({
    ...fixture,
    vocabulary: [{ ...fixture.vocabulary[0], id: 'v001', highlight: ['Article'] }],
    content: { paragraphs: [{ id: 'p001', text: 'Article in content.' }] },
    translation: { paragraphs: [{ id: 'p001', text: 'Article in translation.' }] },
  });
  await page.evaluate(input => window.renderProject(input), project);
  await expect(page.locator('.article[data-source="p001"]')).toContainText('Article in content.');
  await expect(page.locator('.translation[data-source="p001"]')).toContainText('Article in translation.');
  const firstSeen = await page.locator('.vocab[data-source]').evaluateAll(nodes => [...new Set(nodes.map(node => (node as HTMLElement).dataset.source))]);
  expect(firstSeen).toEqual(project.vocabulary.map(item => item.id));
});

test('independently numbered paragraphs paginate automatically', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const project = parseRenderProject({
    ...fixture,
    vocabulary: [],
    content: { paragraphs: [{ id: 'p001', text: 'A short article.' }] },
    translation: { paragraphs: [{ id: 'p001', text: '短译文。' }] },
  });
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'article.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(projectDocument(project))),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.card')).toHaveCount(1);
});
