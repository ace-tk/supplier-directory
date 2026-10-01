/** Snapshot-based undo/redo. Snapshots are compact JSON strings (rasters are
 * asset references, never pixel data). Keeps the last `limit` steps. */
export class History {
  private stack: string[] = [];
  private index = -1;

  constructor(private limit = 100) {}

  reset(snapshot: string) {
    this.stack = [snapshot];
    this.index = 0;
  }

  /** Records a new state after an action. No-op if nothing changed. */
  push(snapshot: string): boolean {
    if (this.stack[this.index] === snapshot) return false;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(snapshot);
    // limit undo STEPS: keep limit + 1 states
    if (this.stack.length > this.limit + 1) this.stack.shift();
    this.index = this.stack.length - 1;
    return true;
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
