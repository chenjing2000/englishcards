import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

test('content, vocabulary and translation editors fit content and remain editable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const content = page.getByLabel('英文段落 1', { exact: true });
  const initialHeight = (await content.boundingBox())!.height;
  await content.fill('Short.');
  const shortHeight = (await content.boundingBox())!.height;
  await expect.poll(async () => (await content.boundingBox())!.height).toBeLessThan(initialHeight);
  await content.fill('A long paragraph that wraps several times. '.repeat(30));
  await expect.poll(async () => (await content.boundingBox())!.height).toBeGreaterThan(shortHeight + 80);

  await page.getByRole('button', { name: '词汇', exact: true }).click();
  const firstMeaning = page.getByLabel('含义 1', { exact: true });
  // The current compact editor combines POS and meaning in one field.
  await expect(firstMeaning).toHaveValue(
    `${fixture.vocabulary[0].senses[0].pos} ${fixture.vocabulary[0].senses[0].meaning}`,
  );
  await firstMeaning.fill('修改后的含义');
  await page.getByRole('button', { name: '译文', exact: true }).click();
  const translation = page.getByLabel('中文段落 1', { exact: true });
  await translation.fill('这是一段较长的中文译文。'.repeat(30));
  await expect.poll(async () => (await translation.boundingBox())!.height).toBeGreaterThan(60);
});
