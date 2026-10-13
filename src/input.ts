/** Fired on `document` whenever `Input.locked` changes. */
export const LOCK_CHANGE = "konia:lockchange";

/** Cursor offset from the centre (0..1) below which free-mouse look stays still. */
const DEAD_ZONE = 0.3;
/** Free-mouse turn speed at the screen edge, in mouse "pixels" per second. */
const EDGE_SPEED = 1100;

/**
 * Keyboard + mouse state. Mouse look uses pointer lock, so movement deltas are
 * accumulated here and consumed once per frame.
 *
 * Where pointer lock is refused (some embedded frames), the game falls back to
 * free-mouse look: the view turns while the cursor is near the screen edge.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  /** Pointer lock was refused; using free-mouse look instead. */
  freeMouse = false;
  private engaged = false;
  private everLocked = false;
  private cursorX = 0;
  private cursorY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      // Native title/settings controls keep keyboard activation and focus navigation.
      if (!this.locked && e.target instanceof Element && e.target.closest("button, input, select, summary, textarea") && e.code !== "Escape") return;
      // Keep Tab, Space and the arrow keys from moving focus or scrolling.
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === "Escape" && this.engaged) this.setEngaged(false);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
    // Mouse buttons are reported as "Mouse0" (left) and "Mouse2" (right).
    // pointerdown, not mousedown: Babylon cancels the canvas pointerdown, which suppresses mousedown.
    document.addEventListener("pointerdown", (e) => {
      if (this.locked) this.pressed.add(`Mouse${e.button}`);
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mousemove", (e) => {
      this.cursorX = (e.clientX / window.innerWidth) * 2 - 1;
      this.cursorY = (e.clientY / window.innerHeight) * 2 - 1;
      if (document.pointerLockElement !== this.canvas) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) this.everLocked = true;
      document.dispatchEvent(new Event(LOCK_CHANGE));
    });
    document.addEventListener("pointerlockerror", () => this.fallBack());
  }

  /** True while the game has the mouse (pointer lock or free-mouse mode). */
  get locked(): boolean {
    return document.pointerLockElement === this.canvas || this.engaged;
  }

  requestLock(): void {
    if (this.freeMouse) {
      this.setEngaged(true);
      return;
    }
    try {
      const result = this.canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => this.fallBack());
    } catch {
      this.fallBack();
    }
  }

  releaseLock(): void {
    if (this.engaged) this.setEngaged(false);
    else if (document.pointerLockElement) document.exitPointerLock();
  }

  private fallBack(): void {
    // Once lock has worked, a refusal is temporary (e.g. re-locking right after Escape).
    if (this.freeMouse || this.everLocked) return;
    this.freeMouse = true;
    this.canvas.style.cursor = "crosshair";
    this.setEngaged(true);
  }

  private setEngaged(on: boolean): void {
    this.engaged = on;
    document.dispatchEvent(new Event(LOCK_CHANGE));
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the first frame a key goes down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  consumeLook(dt: number): { x: number; y: number } {
    if (this.engaged) {
      // Free-mouse look: turn towards the side the cursor is on.
      const steer = (v: number) => Math.sign(v) * Math.max(0, (Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE));
      this.lookX += steer(this.cursorX) * EDGE_SPEED * dt;
      this.lookY += steer(this.cursorY) * EDGE_SPEED * 0.6 * dt;
    }
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  /** Call at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
  }
}
