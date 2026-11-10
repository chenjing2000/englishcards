import { describe, expect, it, vi } from 'vitest';
import { CardSaveCoordinator } from '../../../EnglishCards/frontend/src/services/cardSaveCoordinator';

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Phase E card save coordinator', () => {
  it('allows switching only when saved, never queues blocked navigation', async () => {
    const gate = deferred();
    const write = vi.fn().mockReturnValue(gate.promise);
    const card = new CardSaveCoordinator('C:/cards/A.json', 'A0', write);
    expect(card.requestSwitch()).toBe(true);
    card.edit('A1');
    expect(card.status).toBe('dirty');
    expect(card.requestSwitch()).toBe(false);
    expect(card.status).toBe('saving');
    expect(card.requestSwitch()).toBe(false);
    expect(write).toHaveBeenCalledExactlyOnceWith('C:/cards/A.json', 'A1');
    gate.resolve();
    expect(await card.flush()).toBe(true);
    expect(card.status).toBe('clean');
    // No saved target B: user must click again once A is clean.
    expect(card.requestSwitch()).toBe(true);
  });

  it('writes newer edits after an in-flight snapshot without concurrent writes', async () => {
    const first = deferred();
    const writes: string[] = [];
    let active = 0;
    let maxActive = 0;
    const write = vi.fn(async (_path: string, snapshot: string) => {
      writes.push(snapshot);
      active++;
      maxActive = Math.max(maxActive, active);
      if (snapshot === 'A1') await first.promise;
      active--;
    });
    const card = new CardSaveCoordinator('A.json', 'A0', write);
    card.edit('A1');
    const saving = card.flush();
    card.edit('A2');
    expect(card.requestSwitch()).toBe(false);
    expect(card.status).toBe('saving');
    first.resolve();
    expect(await saving).toBe(true);
    expect(writes).toEqual(['A1', 'A2']);
    expect(maxActive).toBe(1);
    expect(card.currentRevision).toBe(card.lastSavedRevision);
    expect(card.status).toBe('clean');
  });

  it('preserves failed revisions and requires an explicit retry', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('read-only'))
      .mockResolvedValue(undefined);
    const card = new CardSaveCoordinator('A.json', 'A0', write);
    card.edit('A1');
    expect(await card.flush()).toBe(false);
    expect(card.status).toBe('error');
    expect(card.error).toBe('read-only');
    expect(card.requestSwitch()).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    expect(await card.flush()).toBe(false);
    expect(await card.retry()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(card.status).toBe('clean');
  });

  it('ignores identical snapshots and refuses a missing file identity', () => {
    expect(() => new CardSaveCoordinator('', '{}', async () => {})).toThrow();
    const card = new CardSaveCoordinator('A.json', '{}', async () => {});
    card.edit('{}');
    expect(card.status).toBe('clean');
    expect(card.currentRevision).toBe(0);
  });
});
