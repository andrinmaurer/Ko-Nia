/** Five title artworks; each holds for fourteen seconds, then blends for six. */
export class TitleBackdrops {
  private readonly images: HTMLImageElement[];
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private elapsed = 0;
  index = 0;

  constructor(root: HTMLElement) {
    this.images = [...root.querySelectorAll<HTMLImageElement>(".start-backdrops img")];
  }

  update(dt: number, enabled: boolean): void {
    if (!enabled || this.reducedMotion.matches || document.hidden || this.images.length < 2) return;
    this.elapsed += Math.min(dt, 1);
    if (this.elapsed < 20) return;
    const next = (this.index + 1) % this.images.length;
    const image = this.images[next];
    // Never blend into an unloaded or failed image.
    if (!image.complete || image.naturalWidth === 0) return;
    this.images[this.index].classList.remove("is-active");
    image.classList.add("is-active");
    this.index = next;
    this.elapsed = 0;
  }
}
