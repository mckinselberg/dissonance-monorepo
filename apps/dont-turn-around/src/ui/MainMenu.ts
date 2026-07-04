import type { GameConfig, ExperienceMode, DepartureTime } from '@dissonance/shared-types';
import { DEFAULT_TRAIL_ID, TRAILS } from '../config/trails';

export class MainMenu {
  private container: HTMLElement;
  private onStart: (config: GameConfig) => void;

  private selectedMode: ExperienceMode = 'ps1';
  private selectedDeparture: DepartureTime = 'afternoon';
  private selectedTrailId = DEFAULT_TRAIL_ID;

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
      z-index: 50; user-select: none; overflow-y: auto;
    `;

    root.innerHTML = `
      <div id="menu-inner" style="max-width:380px;width:100%;padding:2rem 1rem;">
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
          <p style="font-size:0.65rem;letter-spacing:0.2em;color:#444;margin:0 0 0.8rem 0;">TRAIL</p>
          <div id="trail-map" aria-label="trail map">
            <div class="map-road map-road-a"></div>
            <div class="map-road map-road-b"></div>
            ${Object.values(TRAILS).map((trail) => `
              <button
                data-trail-map="${trail.id}"
                class="trail-node"
                style="left:${trail.mapPosition.x * 100}%;top:${trail.mapPosition.y * 100}%"
                aria-label="${trail.name}"
              ></button>
            `).join('')}
          </div>
          <div class="opts" id="trail-opts" style="display:flex;flex-direction:column;gap:0.5rem;">
            ${Object.values(TRAILS).map((trail) => `
              <button data-trail="${trail.id}" class="menu-btn">
                ${trail.name.toUpperCase()}
                <span class="trail-hint">${trail.menuSummary.toUpperCase()}</span>
              </button>
            `).join('')}
          </div>
        </section>

        <section style="margin-bottom:2.5rem;">
          <p style="font-size:0.65rem;letter-spacing:0.2em;color:#444;margin:0 0 0.8rem 0;">PERCEPTION</p>
          <div class="opts" id="mode-opts" style="display:flex;flex-direction:column;gap:0.5rem;">
            <button data-mode="radio" class="menu-btn">RADIO</button>
            <button data-mode="ps1" class="menu-btn">PS1</button>
            <button data-mode="ps2" class="menu-btn">PS2</button>
            <button data-mode="ps3" class="menu-btn">PS3</button>
          </div>
        </section>

        <section style="margin-bottom:3rem;">
          <p style="font-size:0.65rem;letter-spacing:0.2em;color:#444;margin:0 0 0.8rem 0;">WHEN DID YOU ENTER THE FOREST?</p>
          <div class="opts" id="time-opts" style="display:flex;flex-direction:column;gap:0.5rem;">
            <button data-time="afternoon" class="menu-btn">AFTERNOON</button>
            <button data-time="dusk" class="menu-btn">DUSK</button>
            <button data-time="night" class="menu-btn">NIGHT</button>
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
      .trail-hint {
        display:block; color:#333; font-size:0.52rem; letter-spacing:0.16em;
        margin-top:0.28rem;
      }
      .menu-btn.active .trail-hint { color:#777; }
      #trail-map {
        position:relative; height:104px; margin:0 0 0.75rem 0;
        border:1px solid #252525; background:#050505; overflow:hidden;
      }
      #trail-map::before {
        content:""; position:absolute; inset:10px 14px;
        border-left:1px solid #171717; border-bottom:1px solid #171717;
      }
      .map-road {
        position:absolute; height:1px; background:#202020;
        transform-origin:left center;
      }
      .map-road-a { left:31%; top:30%; width:34%; transform:rotate(22deg); }
      .map-road-b { left:44%; top:52%; width:24%; transform:rotate(-12deg); }
      .trail-node {
        position:absolute; width:16px; height:16px; margin:-8px 0 0 -8px;
        border:1px solid #555; background:#080808; cursor:pointer;
        transform:rotate(45deg); transition:border-color 0.15s, background 0.15s;
      }
      .trail-node:hover { border-color:#999; }
      .trail-node.active { border-color:#ddd; background:#161616; }
      #begin-btn:hover { color: #fff; border-color: #aaa; }
    `;
    root.appendChild(style);

    root.querySelectorAll<HTMLButtonElement>('[data-trail]').forEach((btn) => {
      const trailId = btn.dataset.trail ?? DEFAULT_TRAIL_ID;
      if (trailId === this.selectedTrailId) btn.classList.add('active');

      btn.addEventListener('click', () => {
        this.selectedTrailId = trailId;
        root.querySelectorAll('[data-trail]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        root.querySelectorAll('[data-trail-map]').forEach((b) => {
          b.classList.toggle('active', (b as HTMLButtonElement).dataset.trailMap === trailId);
        });
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-trail-map]').forEach((btn) => {
      const trailId = btn.dataset.trailMap ?? DEFAULT_TRAIL_ID;
      if (trailId === this.selectedTrailId) btn.classList.add('active');

      btn.addEventListener('click', () => {
        this.selectedTrailId = trailId;
        root.querySelectorAll('[data-trail]').forEach((b) => {
          b.classList.toggle('active', (b as HTMLButtonElement).dataset.trail === trailId);
        });
        root.querySelectorAll('[data-trail-map]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

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
        trailId: this.selectedTrailId,
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
