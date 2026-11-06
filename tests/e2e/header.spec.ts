import { test, expect } from './fixtures';

test('personalized headers repeat on every page, match typography and persist edits', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const input = page.getByRole('textbox', { name: '个性化页眉', exact: true });
  await expect(input).toHaveValue('SOME BIRDS ON TREE');
  const headers = page.locator('.preview .personalized-header');
  await expect(headers).toHaveCount(await page.locator('.preview .card').count());
  expect(await headers.count()).toBeGreaterThan(1);
  for (const header of await headers.all()) {
    await expect(header).toHaveText('SOME BIRDS ON TREE');
    await expect(header).toHaveCSS('color', 'rgb(178, 191, 195)');
    await expect(header).toHaveCSS('text-align', 'right');
  }
  expect(await page.locator('.preview .page-header').evaluateAll(nodes => nodes.every(node => {
    const [left, right] = Array.from(node.children) as HTMLElement[];
    const a = getComputedStyle(left), b = getComputedStyle(right);
    const x = left.getBoundingClientRect(), y = right.getBoundingClientRect(), parent = node.getBoundingClientRect();
    return a.fontFamily === b.fontFamily && a.fontSize === b.fontSize && a.fontWeight === b.fontWeight
      && Math.abs(x.top - y.top) < 1 && Math.abs(y.right - parent.right) < 1 && x.right < y.left;
  }))).toBe(true);
  await input.fill('My reading notes');
  await expect(headers.first()).toHaveText('My reading notes');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(input).toHaveValue('SOME BIRDS ON TREE');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(headers.first()).toHaveText('My reading notes');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.reload();
  await expect(input).toHaveValue('My reading notes');
  await expect(headers.first()).toHaveText('My reading notes');
  await page.screenshot({ path: 'artifacts/test-results/personalized-header.png' });
  await input.fill('');
  await expect(headers.first()).toBeEmpty();
});
