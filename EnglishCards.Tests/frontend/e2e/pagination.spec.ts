import { test, expect, chromium } from './fixtures';
import { mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { parseRenderProject, projectDocument } from '@frontend/models/project';

test('phrase can finish a page while its meaning and example continue on next', async ({ page }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject(fixture);
  project.title = 'Boundary'; project.vocabulary = [];
  project.source.paragraphs = [{ id: 'filler', text: 'Filler sentence. '.repeat(70) }];
  project.expressions = [{ id: 'target', phrase: 'target phrase', senses: [{ pos: '', meaning: '中文含义', example: 'An example follows.', exampleTranslation: '例句译文。' }], highlight: [] }];
  await page.evaluate(input => window.renderProject(input), project);
  const space = await page.locator('[data-source="target:phrase"]').evaluate(node => {
    const body = node.closest('.page-body')!.getBoundingClientRect();
    return body.bottom - node.getBoundingClientRect().bottom;
  });
  project.styles.pageHeight -= Math.ceil(space - 10);
  expect(project.styles.pageHeight).toBeGreaterThanOrEqual(400);
  await page.evaluate(input => window.renderProject(input), project);
  const phrasePage = await page.locator('[data-source="target:phrase"]').evaluate(node => Number(node.closest('.card')!.getAttribute('data-page')));
  const meaningPage = await page.locator('[data-source="target:meaning"]').evaluate(node => Number(node.closest('.card')!.getAttribute('data-page')));
  expect(meaningPage).toBe(phrasePage + 1);
  await expect(page.locator('[data-source="target:example"] .line-content')).toHaveText('An example follows.');
});

test('all rendered fields preserve exact text and visible glyphs fit, including extreme styles and explicit newlines', async ({ page }) => {
  await page.goto('/render'); await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject(fixture);
  project.source.paragraphs[0].text += '\nA new line.\n\n👩🏽‍💻 é ' + 'X'.repeat(500) + ' hello ' + ' '.repeat(400) + 'world';
  project.vocabulary[0].word = 'W'.repeat(100);
  project.vocabulary[0].senses[0].meaning = '超长释义'.repeat(80);
  project.translation.paragraphs[1].text += '，。！？）》'.repeat(200);
  project.styles.marginX = 200; project.styles.bodySize = 60;
  project.styles.lineHeight = 1.2; project.styles.translationSize = 54;
  await page.evaluate(input => window.renderProject(input), project);
  const texts: Record<string, string> = { title: project.title, mainIdea: project.mainIdea };
  for (const item of [...project.source.paragraphs, ...project.translation.paragraphs]) texts[item.id] = item.text;
  for (const item of project.expressions) { texts[`${item.id}:phrase`] = item.phrase; for (const key of ['meaning', 'example', 'exampleTranslation'] as const) texts[`${item.id}:${key}`] = item.senses[0][key]; }
  for (const item of project.vocabulary) texts[item.id] = [item.word, ...(item.ipa ? [item.ipa] : []), item.senses[0].pos, item.senses[0].meaning].join(' ');
  for (const [id, original] of Object.entries(texts)) {
    const fragments = page.locator(`[data-source="${id}"]`);
    expect(await fragments.evaluateAll(nodes => nodes.map(node => node.querySelector('.line-content')?.textContent ?? node.textContent).join(''))).toBe(original);
    const offsets = await fragments.evaluateAll(nodes => nodes.flatMap(node => [Number((node as HTMLElement).dataset.start), Number((node as HTMLElement).dataset.end)]));
    const boundaries = new Set([0, ...Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(original), item => item.index + item.segment.length)]);
    expect(offsets.every(offset => boundaries.has(offset))).toBe(true);
  }
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
          const range = document.createRange(); range.setStart(node, part.index); range.setEnd(node, part.index + part.segment.length);
          const rect = range.getBoundingClientRect();
          if (rect.right > box.right + .75 || rect.bottom > body.bottom + .75) { errors.push(`glyph:${line.dataset.source}:${part.segment}:right=${rect.right - box.right}:bottom=${rect.bottom - body.bottom}:start=${line.dataset.start}`); break; }
        }
      }
    }
    for (const footer of document.querySelectorAll('.footer')) {
      const first = footer.firstElementChild!.getBoundingClientRect(), last = footer.lastElementChild!.getBoundingClientRect();
      if (first.right > last.left) errors.push('footer overlap');
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
  expect((await download).suggestedFilename()).toBe('reading-project.json');
});

test('draft survives a real Chromium process restart', async () => {
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

test('corrupt drafts stay recoverable and narrow preview footer matches export styling', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('reading-editor.draft.v2', '{"recoverable":"private article",bad-json'));
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('reading-editor.rejected-draft'))).toBe('{"recoverable":"private article",bad-json');
  const before = await page.locator('.footer>span:first-child').first().evaluate(node => getComputedStyle(node).fontSize);
  await page.setViewportSize({ width: 1800, height: 2000 });
  expect(await page.locator('.footer>span:first-child').first().evaluate(node => getComputedStyle(node).fontSize)).toBe(before);
});

test('business IDs cannot collide with internal title or expression keys; vocabulary retains array order', async ({ page }) => {
  await page.goto('/render'); await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject(fixture);
  project.vocabulary[0].highlight = ['Article'];
  project.source.paragraphs = [{ id: 'title', text: 'Article with title ID.' }, { id: 'x-1:example', text: 'Article with expression ID.' }];
  await page.evaluate(input => window.renderProject(input), project);
  await expect(page.locator('.article[data-source="title"]')).toHaveText('Article with title ID.');
  await expect(page.locator('.title .hot')).toHaveCount(0);
  const firstSeen = await page.locator('.vocab-row [data-source]').evaluateAll(nodes => [...new Set(nodes.map(node => (node as HTMLElement).dataset.source))]);
  expect(firstSeen).toEqual(project.vocabulary.map(item => item.id));
});

test('paragraphs with internal-looking IDs still paginate automatically', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const project = parseRenderProject(fixture);
  project.vocabulary = []; project.expressions = [];
  project.source.paragraphs = [{ id: 'mainIdea', text: 'A short article.' }];
  project.translation.paragraphs = []; project.mainIdea = 'Short summary.';
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(projectDocument(project))) });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(1);
});
