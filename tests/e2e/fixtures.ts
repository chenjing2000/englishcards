import { test as base, expect, chromium } from '@playwright/test';
import { defaults } from '../../src/models/settings';

export { expect, chromium };
export type { Page } from '@playwright/test';
export const test = base.extend<{ settingsReset: void }>({
  settingsReset: [async ({ request }, use) => {
    const response = await request.put('/api/settings', { data: defaults });
    expect(response.ok()).toBe(true);
    await use();
  }, { auto: true }],
});
