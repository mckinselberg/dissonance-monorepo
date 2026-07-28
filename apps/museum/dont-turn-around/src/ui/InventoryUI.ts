// Minimal inventory display — a small pill in the lower-left corner showing
// the active item name. z-index 55: above breath (45) and proximity (50)
// vignettes, below the catch-fade overlay (100) and DevHUD (999).
export class InventoryUI {
  private el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:24px',
      'pointer-events:none',
      'z-index:55',
      'display:none',
      'padding:6px 14px',
      'background:rgba(0,0,0,0.60)',
      'border:1px solid rgba(255,255,255,0.08)',
      'border-radius:999px',
      'color:rgba(200,210,220,0.85)',
      'font-family:monospace',
      'font-size:0.7rem',
      'letter-spacing:0.12em',
    ].join(';');
    document.body.appendChild(this.el);
  }

  setItem(name: string | null): void {
    if (!name) {
      this.el.style.display = 'none';
    } else {
      this.el.style.display = 'block';
      this.el.textContent = name.toLowerCase();
    }
  }

  dispose(): void {
    this.el.remove();
  }
}
