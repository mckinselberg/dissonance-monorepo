export class InstructionsOverlay {
  private readonly el: HTMLElement;
  private visible = false;
  private readonly keyHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.el = this.build();
    document.body.appendChild(this.el);

    this.keyHandler = (e: KeyboardEvent): void => {
      if (e.code !== 'KeyI') return;
      e.preventDefault();
      this.toggle();
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private build(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'z-index:80',
      'pointer-events:none',
      'background:radial-gradient(ellipse at center, rgba(0,0,0,0.78), rgba(0,0,0,0.92))',
      'font-family:monospace',
      'color:rgba(205,215,220,0.88)',
    ].join(';');

    el.innerHTML = `
      <div style="
        width:min(520px, calc(100vw - 40px));
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(0,0,0,0.66);
        padding:22px 24px;
        box-sizing:border-box;
      ">
        <div style="font-size:0.62rem;letter-spacing:0.28em;color:rgba(160,170,170,0.55);margin-bottom:16px">
          FIELD NOTES
        </div>
        <div class="inst-row"><span>MOVE</span><b>W A S D</b></div>
        <div class="inst-row"><span>LOOK</span><b>MOUSE</b></div>
        <div class="inst-row"><span>RUN</span><b>SHIFT</b></div>
        <div class="inst-row"><span>CROUCH</span><b>CTRL</b></div>
        <div class="inst-row"><span>PHONE LIGHT</span><b>RIGHT CLICK</b></div>
        <div class="inst-row"><span>DEV HUD</span><b>\`</b></div>
        <div class="inst-rule"></div>
        <p style="margin:0;color:rgba(180,190,190,0.68);font-size:0.72rem;line-height:1.8">
          Find the car alarm. Stay out of sight. The flashlight helps you see,
          but it also tells the forest exactly where you are.
        </p>
        <p style="margin:18px 0 0;color:rgba(120,130,130,0.55);font-size:0.62rem;letter-spacing:0.16em">
          press I to close
        </p>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .inst-row {
        display:flex;
        justify-content:space-between;
        gap:18px;
        margin:8px 0;
        color:rgba(135,145,145,0.72);
        font-size:0.72rem;
        letter-spacing:0.14em;
      }
      .inst-row b {
        color:rgba(225,225,215,0.90);
        font-weight:normal;
        text-align:right;
        white-space:nowrap;
      }
      .inst-rule {
        height:1px;
        background:rgba(255,255,255,0.10);
        margin:18px 0;
      }
    `;
    el.appendChild(style);
    return el;
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'flex' : 'none';
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.el.remove();
  }
}
