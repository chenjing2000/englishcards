import { test, expect, chromium } from './fixtures';

test('export diagnoses project and line differences without misleading installation hints', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const snapshot = await page.evaluate(() => window.editor);
  const changed = await request.post('/api/export', { data: { ...snapshot, project: { ...snapshot.project, title: 'Changed title' } } });
  expect(changed.status()).toBe(400);
  expect(await changed.text()).toContain('项目数据不同');
  const row = structuredClone(snapshot); row.signature = 'stale'; row.diagnostics.records[0][5] += 1;
  const mismatch = await request.post('/api/export', { data: row });
  expect(mismatch.status()).toBe(400);
  const detail = await mismatch.text();
  expect(detail).toContain('第 1 条'); expect(detail).toContain('行高');
  expect(detail).not.toContain('安装');
  const old = await request.post('/api/export', { data: { project: snapshot.project, signature: 'stale' } });
  expect(await old.text()).toContain('旧版');
  // Desktop ZIP exports are tested by WPF integration tests; the browser has no desktop bridge.
  await page.getByRole('button', { name: '导出全部 ZIP', exact: true }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('ZIP 导出仅在 Windows 桌面版中可用');
  await expect(alert).not.toContainText('请确认 Chromium 已安装');
  await expect(alert).not.toContainText('Error: Error:');
});

for (const scale of [1, 1.25, 1.5, 2]) test(`installed Chrome at ${scale * 100}% device scale exports through bundled Chromium`, async ({ baseURL }) => {
  const browser = await chromium.launch({ channel: 'chrome', args: [`--force-device-scale-factor=${scale}`] });
  try {
    const page = await browser.newPage({ viewport: null });
    await page.goto(baseURL!); await expect(page.locator('[data-ready="true"]')).toBeVisible();
    expect(await page.evaluate(() => devicePixelRatio)).toBeCloseTo(scale, 2);
    expect(await page.locator('.preview [data-source]').evaluateAll(lines => lines.every(line => {
      const body = line.closest('.page-body')!.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(line);
      const text = range.getBoundingClientRect();
      return text.bottom <= body.bottom + .75 && text.top >= body.top - .75;
    }))).toBe(true);
    const snapshot = await page.evaluate(() => window.editor);
    const response = await page.request.post(`${baseURL}/api/export`, { data: { ...snapshot, page: 1 } });
    expect(response.ok(), response.ok() ? '' : await response.text()).toBe(true);
    const image = await response.body();
    expect(image.readUInt32BE(16)).toBe(1200); expect(image.readUInt32BE(20)).toBe(1600);
  } finally { await browser.close(); }
});
