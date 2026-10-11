/** Occasional wind gusts. The Choir Moss whistles while one is blowing. */
export class Wind {
  gusting = false;
  /** 0–1, eases in and out during a gust. */
  strength = 0;
  private timer = 25;
  private readonly listeners: ((gusting: boolean) => void)[] = [];

  onGust(fn: (gusting: boolean) => void): void {
    this.listeners.push(fn);
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.gusting = !this.gusting;
      // Gusts last 8 s and come every 60–120 s.
      this.timer = this.gusting ? 8 : 60 + Math.random() * 60;
      for (const fn of this.listeners) fn(this.gusting);
    }
    const target = this.gusting ? 1 : 0;
    this.strength += (target - this.strength) * Math.min(1, dt * 1.5);
  }
}
