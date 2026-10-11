/**
 * Keyboard + mouse state. Mouse look uses pointer lock, so movement deltas are
 * accumulated here and consumed once per frame.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private lookX = 0;
  private lookY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      // Keep Tab, Space and the arrow keys from moving focus or scrolling.
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
    // Mouse buttons are reported as "Mouse0" (left) and "Mouse2" (right).
    document.addEventListener("mousedown", (e) => {
      if (this.locked) this.pressed.add(`Mouse${e.button}`);
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    void this.canvas.requestPointerLock();
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the first frame a key goes down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  consumeLook(): { x: number; y: number } {
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
