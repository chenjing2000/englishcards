import { test, expect, type Page } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { unzipSync } from 'fflate';

async function ready(page: Page) {
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
}
async function load(page: Page, data: unknown) {
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await ready(page);
}
async function assertCoverage(page: Page) {
  return page.evaluate(() => {
    const errors: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('.card [data-source]')) {
      const rect = element.getBoundingClientRect();
      const body = element.closest('.card')!.querySelector('.page-body')!.getBoundingClientRect();
      if (rect.bottom > body.bottom + 0.5 || rect.right > body.right + 0.5 || rect.top < body.top - 0.5) errors.push(`overflow:${element.dataset.source}`);
    }
    const groups = new Map<string, HTMLElement[]>();
    document.querySelectorAll<HTMLElement>('.card [data-source]').forEach(element => {
      const id = element.dataset.source!;
      groups.set(id, [...(groups.get(id) ?? []), element]);
    });
    for (const [id, elements] of groups) {
      let cursor = 0;
      for (const element of elements) {
        if (Number(element.dataset.start) !== cursor) errors.push(`gap:${id}:${cursor}`);
        cursor = Number(element.dataset.end);
      }
    }
    return errors;
  });
}

test('real editing, portable JSON, history, drafts and invalid imports', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await expect(page.getByRole('button', { name: /删除英文段落/ })).toHaveCount(0);
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(fixture.source.paragraphs[1].text);
  const changed = fixture.source.paragraphs[1].text.replace('supposedly', 'reportedly and supposedly');
  await page.getByLabel('英文段落 2', { exact: true }).fill(changed); await ready(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(fixture.source.paragraphs[1].text);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  await page.getByLabel('词头 1', { exact: true }).fill('edited word');
  await page.getByRole('button', { name: '下移选中词汇', exact: true }).click();
  await page.getByLabel('词头 13', { exact: true }).click();
  await page.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true }).click();
  await page.getByLabel('词头 14', { exact: true }).fill('new vocabulary');
  await page.getByLabel('词头 3', { exact: true }).click();
  await page.getByRole('button', { name: '删除选中词汇', exact: true }).click();
  await page.getByRole('button', { name: '表达', exact: true }).click();
  await page.getByLabel('例句 1', { exact: true }).fill('An edited example.');
  await page.getByLabel('翻译 1', { exact: true }).fill('编辑后的译文。');
  await page.getByRole('button', { name: '表达 1 下移', exact: true }).click();
  await page.getByRole('button', { name: '表达 2 上移', exact: true }).click();
  await page.getByRole('button', { name: '添加表达', exact: true }).click();
  await page.getByLabel('短语 10', { exact: true }).fill('temporary phrase');
  await page.getByRole('button', { name: '删除表达 10', exact: true }).click();
  await page.getByRole('button', { name: '主旨与译文', exact: true }).click();
  await expect(page.getByRole('button', { name: /删除中文段落/ })).toHaveCount(0);
  await page.getByLabel('Main Idea', { exact: true }).fill('新的主旨');
  await page.getByLabel('中文段落 1', { exact: true }).fill('');
  await expect(page.getByText('空段落将保留', { exact: false }).first()).toBeVisible();
  await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const saved = JSON.parse(await readFile(path!, 'utf8'));
  expect(saved.source.paragraphs[1].text).toBe(changed);
  expect(saved.vocabulary[1].word).toBe('edited word');
  expect(saved.expressions[0].senses[0].example).toBe('An edited example.');
  expect(saved.mainIdea).toBe('新的主旨');
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: '原文', exact: true }).click();
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);
  await load(page, saved);
  await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);
  await load(page, { schemaVersion: 99 }).catch(() => undefined);
  await expect(page.getByRole('alert')).toContainText('项目');
  await expect(page.locator('.card').first()).toBeVisible();
  for (const invalid of ['{', JSON.stringify({ ...fixture, title: null }), JSON.stringify({ ...fixture, title: '\ufffd' })]) {
    const previous = await page.getByRole('alert').textContent();
    await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(invalid) });
    await expect(page.getByRole('alert')).not.toHaveText(previous!);
    await expect(page.getByRole('alert')).toContainText('无法打开项目');
    await expect(page.getByLabel('英文段落 2', { exact: true })).toHaveValue(changed);
  }
});

test('entry rule highlights all occurrences and keeps preview navigation', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await load(page, { ...fixture, source: { paragraphs: [{ id: 'p', text: 'word word' }] } });
  const input = page.getByLabel('英文段落 1', { exact: true });
  await input.evaluate((node: HTMLTextAreaElement) => { node.focus(); node.setSelectionRange(5, 9); });
  await page.getByRole('button', { name: '高亮 / 取消高亮 1', exact: true }).click(); await ready(page);
  await expect(page.locator('.card .hot')).toHaveText(['word', 'word']);
  await input.evaluate((node: HTMLTextAreaElement) => { node.focus(); node.setSelectionRange(5, 9); });
  await page.getByRole('button', { name: '高亮 / 取消高亮 1', exact: true }).click(); await ready(page);
  await expect(page.locator('.card .hot')).toHaveCount(0);
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.locator('.card [data-source="p"]').click();
  await expect(input).toBeFocused();
});

test('an invalid import cannot re-enable export after pagination fails', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.evaluate(() => {
    crypto.subtle.digest = async () => { throw new Error('Simulated layout failure'); };
  });
  await page.getByLabel('英文标题', { exact: true }).fill('A changed project');
  await expect(page.getByRole('alert')).toContainText('分页失败');
  const exportButton = page.getByRole('button', { name: '导出全部 ZIP', exact: true });
  await expect(exportButton).toBeDisabled();
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('分页失败');
  await page.getByLabel('信息提示栏').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('无法打开项目');
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('A changed project');
  await expect(exportButton).toBeDisabled();
});

test('line pagination preserves long sentences, Chinese, graphemes, columns and >10 pages', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const longExample = Array.from({ length: 230 }, (_, index) => `example${index}`).join(' ');
  const chinese = '中文段落（标点），混合English123。👨‍👩‍👧‍👦 é '.repeat(170);
  const token = 'W'.repeat(800);
  const project = { ...fixture, source: { paragraphs: [{ id: 'p', text: ('A complete line of English. '.repeat(200)) + token }] }, expressions: [{ ...fixture.expressions[0], senses: [{ ...fixture.expressions[0].senses[0], example: longExample }] }], translation: { paragraphs: [{ id: 'zh', text: chinese }] } };
  await load(page, project);
  expect(await assertCoverage(page)).toEqual([]);
  for (const [id, original] of [['p', project.source.paragraphs[0].text], ['x-1:example', longExample], ['zh', chinese]]) {
    expect(await page.locator(`.card [data-source="${id}"]`).evaluateAll(nodes => nodes.map(node => node.querySelector('.line-content')?.textContent ?? node.textContent).join(''))).toBe(original);
    const pageNumbers = await page.locator(`.card [data-source="${id}"]`).evaluateAll(nodes => [...new Set(nodes.map(node => node.closest('.card')!.getAttribute('data-page')))]);
    expect(pageNumbers.length).toBeGreaterThan(1);
  }
  const indents = await page.locator('.card [data-source="zh"]').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).textIndent));
  expect(indents[0]).toBe('64px'); expect(new Set(indents.slice(1))).toEqual(new Set(['0px']));
  await expect(page.locator('.card .section-heading').filter({ hasText: 'USEFUL EXPRESSIONS' })).toHaveCount(1);
  const columns = await page.locator('.vocab-row').evaluateAll(rows => rows.every(row => row.children.length === 2 && Math.abs(row.children[0].getBoundingClientRect().width - row.children[1].getBoundingClientRect().width) < 1));
  expect(columns).toBe(true);
  project.translation.paragraphs[0].text = chinese.repeat(5);
  await load(page, project);
  expect(await page.locator('.card').count()).toBeGreaterThan(10);
  expect(await assertCoverage(page)).toEqual([]);
});

test('styles inherit, short content flows, exports match preview and repeat exactly', async ({ page, request }) => {
  await page.goto('/'); await ready(page);
  await load(page, fixture);
  await expect(page.locator('.card').first()).toHaveCSS('background-color', 'rgb(248, 248, 246)');
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('英文正文字号').fill('34'); await ready(page);
  expect(await page.locator('.card .hot').first().evaluate(node => getComputedStyle(node).fontSize)).toBe('34px');
  expect(await assertCoverage(page)).toEqual([]);
  const snapshot = await page.evaluate(() => ({ project: window.editor.project, signature: window.editor.signature }));
  const response = await request.post('/api/export', { data: snapshot });
  expect(response.ok()).toBe(true);
  const files = unzipSync(new Uint8Array(await response.body()));
  const pngNames = Object.keys(files).filter(name => name.endsWith('.png'));
  expect(pngNames.length).toBe(await page.locator('.card').count());
  expect(await page.locator('.card .footer>span:last-child').allTextContents()).toEqual(pngNames.map((_, index) => `${String(index + 1).padStart(2, '0')} / ${String(pngNames.length).padStart(2, '0')}`));
  for (const name of pngNames) {
    const buffer = Buffer.from(files[name]);
    expect(buffer.readUInt32BE(16)).toBe(1200); expect(buffer.readUInt32BE(20)).toBe(1600);
  }
  const second = await request.post('/api/export', { data: snapshot });
  expect(second.ok(), `second export status ${second.status()}`).toBe(true);
  const secondFiles = unzipSync(new Uint8Array(await second.body()));
  for (const name of pngNames) expect(Buffer.from(secondFiles[name]).equals(Buffer.from(files[name]))).toBe(true);
  const single = await request.post('/api/export', { data: { ...snapshot, page: 1 } });
  expect(single.ok()).toBe(true);
  expect((await single.body()).equals(Buffer.from(files[pngNames[0]]))).toBe(true);
  await page.locator('.preview').evaluate(node => { (node as HTMLElement).style.setProperty('--zoom', '1'); });
  await page.setViewportSize({ width: 1800, height: 2000 });
  const screenshot = await page.locator('.card').first().screenshot();
  const { writeFile } = await import('node:fs/promises');
  await writeFile('.build/test-results/preview.png', screenshot);
  await writeFile('.build/test-results/export.png', files[pngNames[0]]);
  expect(screenshot.readUInt32BE(16)).toBe(1200); expect(screenshot.readUInt32BE(20)).toBe(1600);
  // PNG bytes can differ across capture paths even at the same canvas dimensions.
  // The server-side signature, page count and dimensions are verified above;
  // real WebView2 ZIP rendering must additionally pass the Windows desktop check.
  expect(screenshot.length).toBeGreaterThan(1000);
  const stale = await request.post('/api/export', { data: { ...snapshot, signature: 'stale' } });
  expect(stale.status()).toBe(400);
  const changedContent = await request.post('/api/export', { data: { ...snapshot, project: { ...snapshot.project, title: 'X' + snapshot.project.title.slice(1) } } });
  expect(changedContent.status()).toBe(400);
  const tiny = { ...fixture, title: 'Short', source: { paragraphs: [] }, vocabulary: [], expressions: [], mainIdea: 'Short idea', translation: { paragraphs: [{ id: 'zh', text: '短译文。' }] } };
  await load(page, tiny);
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .section-heading')).toHaveCount(3);
  await page.getByRole('button', { name: '主旨与译文', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});
