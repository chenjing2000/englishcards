import { test, expect } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };

for (const staleFails of [false, true]) test(`the latest file wins when an older read ${staleFails ? 'fails' : 'finishes'} later`, async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate(staleFails => {
    const reads = new Map<string, () => void>();
    const read = File.prototype.text;
    Object.assign(window, { releaseRead: (name: string) => reads.get(name)!() });
    File.prototype.text = async function () {
      await new Promise<void>(resolve => reads.set(this.name, resolve));
      if (staleFails && this.name === 'older.json') throw new Error('older read failed');
      return read.call(this);
    };
  }, staleFails);
  const open = (name: string, title: string) => page.getByLabel('打开项目 JSON').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...fixture, title })) });
  await open('older.json', 'Older project');
  await open('latest.json', 'Latest project');
  await page.evaluate(() => (window as unknown as { releaseRead: (name: string) => void }).releaseRead('latest.json'));
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('Latest project');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const latestNotice = await page.getByLabel('信息提示栏').textContent();
  await page.evaluate(() => (window as unknown as { releaseRead: (name: string) => void }).releaseRead('older.json'));
  // File.text's continuation and React's state flush must finish before observing stale results.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('Latest project');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('信息提示栏')).toHaveText(latestNotice!);
});
