import type { GameConfig, ExperienceMode, DepartureTime } from '@dissonance/shared-types';

export class MainMenu {
  private container: HTMLElement;
  private onStart: (config: GameConfig) => void;

  private selectedMode: ExperienceMode = 'ps1';
  private selectedDeparture: DepartureTime = 'afternoon';

  constructor(onStart: (config: GameConfig) => void) {
    this.onStart = onStart;
    this.container = this.build();
    document.body.appendChild(this.container);
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.id = 'menu';
    root.style.cssText = `
      position: fixed; inset: 0; background: #000;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: monospace; color: #666;
      z-index: 50; user-select: none;
    `;

    root.innerHTML = `
      <div id="menu-inner" style="max-width:340px;width:100%;padding:2rem 1rem;">
        <h1 style="
          font-size: clamp(1.1rem, 3vw, 1.6rem);
          letter-spacing: 0.25em;
          color: #bbb;
          margin: 0 0 3rem 0;
          font-weight: normal;
          text-align: left;
          line-height: 1.5;
        ">DON'T TURN AROUND</h1>

        <section style="margin-bottom:2.5rem;">
          <p style="font-size:0.65rem;letter-spacing:0.2em;color:#444;margin:0 0 0.8rem 0;">PERCEPTION</p>
          <div class="opts" id="mode-opts" style="display:flex;flex-direction:column;gap:0.5rem;">
            <button data-mode="radio" class="menu-btn">RADIO</button>
            <button data-mode="ps1" class="menu-btn">PS1</button>
          </div>
        </section>

        <section style="margin-bottom:3rem;">
          <p style="font-size:0.65rem;letter-spacing:0.2em;color:#444;margin:0 0 0.8rem 0;">WHEN DID YOU ENTER THE FOREST?</p>
          <div class="opts" id="time-opts" style="display:flex;flex-direction:column;gap:0.5rem;">
            <button data-time="afternoon" class="menu-btn">AFTERNOON</button>
            <button data-time="dusk" class="menu-btn">DUSK</button>
          </div>
        </section>

        <button id="begin-btn" style="
          background: none; border: 1px solid #555; color: #999;
          font-family: monospace; font-size: 0.75rem; letter-spacing: 0.3em;
          padding: 0.7rem 2rem; cursor: pointer; width: 100%;
          transition: color 0.2s, border-color 0.2s;
        ">BEGIN</button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .menu-btn {
        background: none; border: 1px solid #333; color: #555;
        font-family: monospace; font-size: 0.75rem; letter-spacing: 0.25em;
        padding: 0.5rem 1rem; cursor: pointer; text-align: left;
        transition: color 0.15s, border-color 0.15s;
      }
      .menu-btn:hover { color: #999; border-color: #666; }
      .menu-btn.active { color: #ddd; border-color: #aaa; }
      #begin-btn:hover { color: #fff; border-color: #aaa; }
    `;
    root.appendChild(style);

    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
      const m = btn.dataset.mode as ExperienceMode;
      if (m === this.selectedMode) btn.classList.add('active');

      btn.addEventListener('click', () => {
        this.selectedMode = m;
        root.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((btn) => {
      const t = btn.dataset.time as DepartureTime;
      if (t === this.selectedDeparture) btn.classList.add('active');

      btn.addEventListener('click', () => {
        this.selectedDeparture = t;
        root.querySelectorAll('[data-time]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    root.querySelector('#begin-btn')?.addEventListener('click', () => {
      const config = {
        experienceMode: this.selectedMode,
        departureTime: this.selectedDeparture,
      };
      this.dismiss(() => this.onStart(config));
    });

    return root;
  }

  private dismiss(cb: () => void): void {
    this.container.style.transition = 'opacity 1s ease-out';
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.remove();
      cb();
    }, 1000);
  }
}
