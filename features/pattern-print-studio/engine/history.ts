/** Snapshot-based undo/redo. Snapshots are compact JSON strings (rasters are
 * asset references, never pixel data). Keeps the last `limit` steps. Each
 * state also carries `meta` (e.g. the node selection), which is restored
 * with it but never counts as a change on its own. */
export class History<M = unknown> {
  private stack: string[] = [];
  private metas: (M | null)[] = [];
  private index = -1;

  constructor(private limit = 100) {}

  reset(snapshot: string) {
    this.stack = [snapshot];
    this.metas = [null];
    this.index = 0;
  }

  /** Records a new state after an action. No-op if nothing changed. */
  push(snapshot: string, meta: M | null = null): boolean {
    if (this.stack[this.index] === snapshot) {
      this.metas[this.index] = meta;
      return false;
    }
    this.stack = this.stack.slice(0, this.index + 1);
    this.metas = this.metas.slice(0, this.index + 1);
    this.stack.push(snapshot);
    this.metas.push(meta);
    // limit undo STEPS: keep limit + 1 states
    if (this.stack.length > this.limit + 1) {
      this.stack.shift();
      this.metas.shift();
    }
    this.index = this.stack.length - 1;
    return true;
  }

  /** Updates the current state's meta (selection changed, document didn't). */
  setMeta(meta: M | null) {
    if (this.index >= 0) this.metas[this.index] = meta;
  }

  /** Meta of the state we are on now (after undo/redo: the state arrived at). */
  get meta(): M | null {
    return this.metas[this.index] ?? null;
  }

  undo(): string | null {
    if (this.index <= 0) return null;
    return this.stack[--this.index];
  }

  redo(): string | null {
    if (this.index >= this.stack.length - 1) return null;
    return this.stack[++this.index];
  }

  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.stack.length - 1;
  }
}
