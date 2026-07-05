export class InstructionsScreen {
  private el: HTMLElement;
  private _isOpen = false;

  constructor() {
    this.el = this.build();
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    // Escape closes the instructions (capture phase so it fires before other handlers)
    window.addEventListener('keydown', (e) => {
      if (!this._isOpen) return;
      if (e.code === 'Escape' || e.code === 'KeyI') {
        e.stopPropagation();
        this.close();
      }
    }, true);
  }

  toggle(): void {
    this._isOpen ? this.close() : this.open();
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  private open(): void {
    this._isOpen = true;
    this.el.style.display = 'flex';
  }

  private close(): void {
    this._isOpen = false;
    this.el.style.display = 'none';
  }

  dispose(): void {
    this.el.remove();
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:150',
      'background:rgba(0,0,0,0.93)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:monospace', 'color:#666',
      'overflow-y:auto',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      .ins-key {
        display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid #3a3a3a; color: #888; background: rgba(255,255,255,0.03);
        font-family: monospace; font-size: 0.6rem; letter-spacing: 0.08em;
        padding: 3px 7px; min-width: 22px; line-height: 1.4;
        white-space: nowrap;
      }
      .ins-row {
        display: flex; align-items: center; gap: 10px; margin: 6px 0;
      }
      .ins-desc {
        color: #555; font-size: 0.65rem; letter-spacing: 0.12em;
      }
      .ins-subdesc {
        color: #383838; font-size: 0.58rem; letter-spacing: 0.1em; margin-left: 4px;
      }
      .ins-divider {
        border: none; border-top: 1px solid #1e1e1e; margin: 14px 0;
      }
      .ins-section {
        font-size: 0.55rem; letter-spacing: 0.25em; color: #333;
        text-transform: uppercase; margin: 0 0 10px 0;
      }
      .ins-wasd {
        display: grid;
        grid-template-columns: repeat(3, 28px);
        grid-template-rows: repeat(2, 24px);
        gap: 3px;
        margin-right: 10px;
      }
      .ins-wasd .ins-key {
        min-width: unset; width: 28px; height: 24px;
        padding: 0; display: flex; align-items: center; justify-content: center;
      }
    `;
    root.appendChild(style);

    const panel = document.createElement('div');
    panel.style.cssText = 'max-width:380px;width:90%;padding:2.5rem 1.5rem;';

    panel.innerHTML = `
      <p style="font-size:0.55rem;letter-spacing:0.3em;color:#2a2a2a;margin:0 0 2rem 0;">DON'T TURN AROUND</p>

      <p class="ins-section">movement</p>

      <div class="ins-row" style="align-items:flex-end;">
        <div class="ins-wasd">
          <div></div>
          <span class="ins-key">W</span>
          <div></div>
          <span class="ins-key">A</span>
          <span class="ins-key">S</span>
          <span class="ins-key">D</span>
        </div>
        <span class="ins-desc">walk · jog</span>
      </div>

      <div class="ins-row" style="margin-top:10px;">
        <span class="ins-key">SHIFT</span>
        <span style="color:#2e2e2e;font-size:0.6rem;">+</span>
        <span class="ins-key">W A S D</span>
        <span class="ins-desc">sprint</span>
      </div>

      <div class="ins-row">
        <span class="ins-key">CTRL</span>
        <span style="color:#2e2e2e;font-size:0.6rem;">+</span>
        <span class="ins-key">W A S D</span>
        <span class="ins-desc">crouch</span>
        <span class="ins-subdesc">quieter</span>
      </div>

      <hr class="ins-divider">

      <p class="ins-section">items</p>

      <div class="ins-row">
        <span class="ins-key">RIGHT CLICK</span>
        <span class="ins-desc">phone · flashlight</span>
      </div>
      <div style="margin:2px 0 0 4px;">
        <span class="ins-subdesc">find it on the ground first</span>
      </div>

      <hr class="ins-divider">

      <div class="ins-row">
        <span class="ins-key">I</span>
        <span style="color:#2a2a2a;font-size:0.6rem;">or</span>
        <span class="ins-key">ESC</span>
        <span class="ins-desc">close this screen</span>
      </div>

      <hr class="ins-divider" style="margin-top:28px;">

      <div style="margin-top:20px;line-height:2.2;color:#2c2c2c;font-size:0.6rem;letter-spacing:0.18em;">
        something is in the forest with you.<br>
        reach the car park.<br>
        don't turn around.
      </div>
    `;

    root.appendChild(panel);
    return root;
  }
}
