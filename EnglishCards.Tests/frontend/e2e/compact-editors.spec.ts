import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

test('continuous content and translation editors fit text and vocabulary remains editable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const content = page.getByLabel('英文正文', { exact: true });
  const initialHeight = (await content.boundingBox())!.height;
  await content.fill('Short.');
  await expect.poll(async () => (await content.boundingBox())!.height).toBeLessThan(initialHeight);
  const shortHeight = (await content.boundingBox())!.height;
  await content.fill('A long paragraph that wraps several times. '.repeat(30));
  await expect.poll(async () => (await content.boundingBox())!.height).toBeGreaterThan(shortHeight + 80);

  const firstMeaning = page.getByLabel('含义 1', { exact: true });
  await expect(firstMeaning).toHaveValue(
    `${fixture.vocabulary[0].senses[0].pos} ${fixture.vocabulary[0].senses[0].meaning}`,
  );
  await firstMeaning.fill('修改后的含义');
  const translation = page.getByLabel('中文译文', { exact: true });
  await translation.fill('这是一段较长的中文译文。'.repeat(30));
  await expect.poll(async () => (await translation.boundingBox())!.height).toBeGreaterThan(120);
});
