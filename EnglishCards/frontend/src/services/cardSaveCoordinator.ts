/**
 * Phase E save gate for one file-backed Article v6 card.
 *
 * The caller supplies a serialized, already-validated immutable Article snapshot.
 * This class intentionally knows nothing about the filesystem, React or the next
 * card: rejected navigation is never queued for automatic replay.
 */
export type CardSaveStatus = 'clean' | 'dirty' | 'saving' | 'error';
export type CardWrite = (filePath: string, snapshot: string) => Promise<void>;

export class CardSaveCoordinator {
  private currentSnapshot: string;
  private revision = 0;
  private savedRevision = 0;
  private inFlight: Promise<boolean> | null = null;
  private failure: string | null = null;

  constructor(
    readonly filePath: string,
    initialSavedSnapshot: string,
    private readonly write: CardWrite,
  ) {
    if (!filePath) throw new Error('Card file path is required.');
    this.currentSnapshot = initialSavedSnapshot;
  }

  get status(): CardSaveStatus {
    if (this.failure) return 'error';
    if (this.inFlight) return 'saving';
    return this.revision === this.savedRevision ? 'clean' : 'dirty';
  }

  get error(): string | null { return this.failure; }
  get currentRevision(): number { return this.revision; }
  get lastSavedRevision(): number { return this.savedRevision; }

  /** Called only after the Article snapshot has passed strict schema validation. */
  edit(validatedSnapshot: string): void {
    if (validatedSnapshot === this.currentSnapshot) return;
    this.currentSnapshot = validatedSnapshot;
    this.revision += 1;
    // A new edit must not erase evidence of an unsuccessful prior write.
  }

  /**
   * Only an already clean card may switch. Dirty cards start an immediate
   * best-effort save, but the rejected navigation is never remembered.
   */
  requestSwitch(): boolean {
    if (this.status === 'clean') return true;
    if (this.status === 'dirty') void this.flush();
    return false;
  }

  /** Retry is an explicit action after a failed write. */
  retry(): Promise<boolean> {
    this.failure = null;
    return this.flush();
  }

  /** Serializes writes and continues until every accepted revision is persisted. */
  async flush(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    if (this.failure) return false;
    if (this.savedRevision === this.revision) return true;

    const run = async (): Promise<boolean> => {
      while (this.savedRevision !== this.revision) {
        const revision = this.revision;
        const snapshot = this.currentSnapshot;
        try {
          await this.write(this.filePath, snapshot);
          this.savedRevision = revision;
          this.failure = null;
        } catch (reason) {
          this.failure = reason instanceof Error ? reason.message : String(reason);
          return false;
        }
      }
      return true;
    };

    const pending = run();
    this.inFlight = pending;
    try { return await pending; }
    finally {
      if (this.inFlight === pending) this.inFlight = null;
    }
  }
}
