import { test, expect } from './fixtures';
import { unzipSync, strFromU8 } from 'fflate';
import { readFile } from 'node:fs/promises';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { selectPreviewText } from './preview-selection';

const articleText = 'RUN runs runner. They took off and take off. run. They ran away.';
const article = {
  ...fixture,
  content: { paragraphs: [{ id: 'p001', text: articleText }] },
  vocabulary: [
    { id: 'v001', word: 'run', ipa: '/rʌn/', highlight: ['run', 'runs'], senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }] },
    { id: 'v002', word: 'take off', highlight: ['take off', 'took off'], senses: [{ pos: '', meaning: '起飞', example: 'They took off.', exampleTranslation: '他们起飞了。' }] },
  ],
};

async function loadArticle(page: import('@playwright/test').Page, value: unknown) {
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'selection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
}

async function choose(page: import('@playwright/test').Page, quote: string, occurrence = 0) {
  const selected = await selectPreviewText(page, 'p001', articleText, quote, occurrence);
  expect(selected, `could not select preview text: ${quote}`).toBe(true);
  await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toBeVisible();
}

test('left-preview selections add English words and phrases to Article v6 vocabulary', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await loadArticle(page, article);
  const marks = page.locator('.card .article .hot');
  await expect(marks).toHaveText(['RUN', 'runs', 'took off', 'take off', 'run']);

  // Existing words/variants are not duplicated.
  await choose(page, 'RUN');
  await page.getByRole('button', { name: '将选中文字加入词汇' }).click();
  await expect(page.getByRole('status')).toContainText('已经存在');
  expect(await page.evaluate(() => window.editor.project.vocabulary.length)).toBe(2);

  await choose(page, 'runner');
  await page.getByRole('button', { name: '将选中文字加入词汇' }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.card .article .hot')).toHaveText(['RUN', 'runs', 'runner', 'took off', 'take off', 'run']);

  await choose(page, 'ran away');
  await page.getByRole('button', { name: '将选中文字加入词汇' }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.card .article .hot')).toHaveText(['RUN', 'runs', 'runner', 'took off', 'take off', 'run', 'ran away']);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const saved = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
  expect(saved.vocabulary[2]).toMatchObject({ id: 'v003', word: 'runner', highlight: [] });
  expect(saved.vocabulary[3]).toMatchObject({ id: 'v004', word: 'ran away', highlight: [] });

  const snapshot = await page.evaluate(() => window.editor);
  const exported = await request.post('/api/render-page', { data: { ...snapshot, page: 1 } });
  expect(exported.ok(), exported.ok() ? '' : await exported.text()).toBe(true);
  const files = unzipSync(new Uint8Array(await exported.body()));
  const exportedProject = JSON.parse(strFromU8(files['article.json']));
  expect(exportedProject.vocabulary.slice(-2)).toEqual(saved.vocabulary.slice(-2));
  expect(Object.keys(files).filter(name => name.endsWith('.png')).length).toBeGreaterThan(0);
});


test('highlight editor updates independent rules live and preserves dictionary-word matching', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const text = 'Study studies studied. Only for today. Only that matters.';
  const input = {
    ...fixture,
    content: { paragraphs: [{ id: 'p001', text }] },
    vocabulary: [{
      id: 'v001', word: 'study', ipa: '', highlight: [],
      senses: [{ pos: 'n.', meaning: '学习', example: '', exampleTranslation: '' }],
    }],
  };
  await loadArticle(page, input);
  const marks = page.locator('.card .article .hot');
  await expect(marks).toHaveText(['Study']);

  const word = page.getByLabel('词头 1', { exact: true });
  await word.fill('stud');
  await expect(marks).toHaveCount(0);
  await word.fill('studies');
  await expect(marks).toHaveText(['studies']);
  await word.fill('study');
  await expect(marks).toHaveText(['Study']);

  const editor = page.getByLabel('高亮词汇 1', { exact: true });
  await editor.fill('studies; studied; only fo; only that; STUDIES;;');
  await expect(marks).toHaveText(['Study', 'studies', 'studied', 'Only that']);
  expect(await page.evaluate(() => window.editor.project.vocabulary[0].highlight))
    .toEqual(['studies', 'studied', 'only fo', 'only that']);

  await editor.fill('studies; studied; only for; only that');
  await expect(marks).toHaveText(['Study', 'studies', 'studied', 'Only for', 'Only that']);
  await editor.fill('studies; studied; only that');
  await expect(marks).toHaveText(['Study', 'studies', 'studied', 'Only that']);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const saved = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
  expect(saved.vocabulary[0]).toMatchObject({
    word: 'study',
    highlight: ['studies', 'studied', 'only that'],
  });
  await page.reload();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('高亮词汇 1', { exact: true })).toHaveValue('studies; studied; only that');
  await expect(marks).toHaveText(['Study', 'studies', 'studied', 'Only that']);
});

test('preview plus rejects partial words, Chinese text, and selections crossing paragraph or card boundaries', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const twoParagraphs = {
    ...fixture,
    content: { paragraphs: [
      { id: 'p001', text: 'English 中文 text.' },
      { id: 'p002', text: 'Second paragraph.' },
    ] },
    vocabulary: [],
  };
  await loadArticle(page, twoParagraphs);

  const partial = await selectPreviewText(page, 'p001', 'English 中文 text.', 'ngli');
  expect(partial).toBe(true);
  await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toHaveCount(0);

  const mixed = await selectPreviewText(page, 'p001', 'English 中文 text.', 'English 中文');
  expect(mixed).toBe(true);
  await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toHaveCount(0);

  const crossParagraph = await page.locator('.preview-scroll').evaluate(scroll => {
    const line = (id: string) => Array.from(scroll.querySelectorAll<HTMLElement>('.text-line.article'))
      .find(node => node.dataset.source === id)!;
    const point = (node: HTMLElement, offset: number) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode() as Text;
      return { node: text, offset };
    };
    const first = line('p001'), second = line('p002');
    const range = document.createRange();
    const firstPoint = point(first, 0), secondPoint = point(second, 6);
    range.setStart(firstPoint.node, firstPoint.offset);
    range.setEnd(secondPoint.node, secondPoint.offset);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    scroll.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  });
  expect(crossParagraph).toBe(true);
  await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toHaveCount(0);

  const longText = 'word '.repeat(1400);
  await loadArticle(page, { ...fixture, content: { paragraphs: [{ id: 'p001', text: longText }] }, vocabulary: [] });
  expect(await page.locator('.card').count()).toBeGreaterThan(1);
  const crossCard = await page.locator('.preview-scroll').evaluate(scroll => {
    const cards = Array.from(scroll.querySelectorAll<HTMLElement>('.card'));
    const first = cards[0].querySelector<HTMLElement>('.text-line.article[data-source="p001"]')!;
    const last = cards[1].querySelector<HTMLElement>('.text-line.article[data-source="p001"]')!;
    const firstText = first.firstChild as Text;
    const lastText = last.lastChild as Text;
    const range = document.createRange();
    range.setStart(firstText, 0); range.setEnd(lastText, lastText.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    scroll.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  });
  expect(crossCard).toBe(true);
  await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toHaveCount(0);

  // The same selection gesture in the right editor is never eligible.
  const body = page.getByLabel('英文正文');
  await body.evaluate(node => {
    const input = node as HTMLTextAreaElement;
    input.focus(); input.setSelectionRange(0, 4);
    input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toHaveCount(0);
});
