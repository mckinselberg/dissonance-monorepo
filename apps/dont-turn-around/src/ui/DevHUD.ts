import type { Game, GameControls } from '../game/Game';
import type { ExperienceMode } from '@dissonance/shared-types';

const STORAGE_KEY = 'dta_config';
const PERF_MODE_STORAGE_KEY = 'dta_perf_mode';

export class DevHUD {
  private panel: HTMLElement;
  private debugEl: HTMLElement;
  private controls: GameControls;
  private game: Game;
  private visible = false;
  private rafId = 0;

  constructor(game: Game) {
    this.game = game;
    this.controls = game.getControls();
    this.panel = this.build();
    document.body.appendChild(this.panel);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.toggle();

    });

    this.debugEl = this.panel.querySelector<HTMLElement>('#dev-debug')!;
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? 'flex' : 'none';
    if (this.visible) {
      this.scheduleUpdate();
    } else {
      cancelAnimationFrame(this.rafId);
    }
  }

  private scheduleUpdate(): void {
    this.rafId = requestAnimationFrame(() => {
      if (!this.visible) return;
      this.refreshDebug();
      this.scheduleUpdate();
    });
  }

  private refreshDebug(): void {
    const s = this.game.getDebugState();
    this.debugEl.innerHTML =
      row('fps', s.fps.toFixed(0)) +
      row('pursuer', `${s.pursuerState}  ${s.pursuerDistance.toFixed(1)}m  aggr ${s.pursuerAggression.toFixed(2)}  ${s.isHidden ? 'HIDDEN' : 'los'}`) +
      row('phone', `${s.hasPhone ? 'found' : 'not found'}  flashlight:${s.flashlightOn ? 'ON' : 'off'}  pursuer lit:${s.isIlluminated ? 'YES' : 'no'}`) +
      row('speed', `${s.playerSpeed.toFixed(1)} m/s  ${s.isCrouching ? 'crouch' : ''}`) +
      row('breath', bar(s.breathLoad)) +
      row('adrenaline', bar(s.adrenaline)) +
      row('dest', `${s.destDistance.toFixed(1)}m`) +
      row('light', bar(s.lightLevel)) +
      row('wind', bar(s.windIntensity));
  }

  private build(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'display:none', 'position:fixed', 'top:12px', 'right:12px',
      'width:290px', 'flex-direction:column', 'gap:10px',
      'background:rgba(0,0,0,0.85)', 'border:1px solid #333',
      'padding:14px', 'font-family:monospace', 'font-size:11px',
      'color:#aaa', 'z-index:999', 'user-select:none',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `
      .dh-section{color:#444;font-size:9px;letter-spacing:.15em;margin:6px 0 4px;text-transform:uppercase}
      .dh-row{display:flex;justify-content:space-between;align-items:center;margin:4px 0;gap:8px}
      .dh-label{color:#666;flex-shrink:0}
      .dh-val{color:#bbb;text-align:right;font-size:10px}
      .dh-slider{width:130px;accent-color:#777;cursor:pointer}
      .dh-toggle{background:none;border:1px solid #444;color:#666;
        font-family:monospace;font-size:10px;padding:2px 8px;cursor:pointer}
      .dh-toggle.on{border-color:#999;color:#ddd}
      .dh-mode{background:none;border:1px solid #333;color:#555;
        font-family:monospace;font-size:10px;padding:2px 9px;cursor:pointer}
      .dh-mode.active{border-color:#aaa;color:#eee}
      .dh-action{background:none;border:1px solid #333;color:#555;
        font-family:monospace;font-size:10px;padding:4px 10px;cursor:pointer;width:100%;margin-top:4px}
      .dh-action:hover{border-color:#777;color:#aaa}
    `;
    panel.appendChild(style);

    panel.appendChild(el('div', 'color:#444;font-size:9px;letter-spacing:.2em',
      'DEV  ` to toggle'));

    panel.appendChild(sectionLabel('audio'));

    panel.appendChild(sliderRow('alarm vol', 0, 2, 0.05, 1, (v) => {
      this.controls.setBellMultiplier(v);
    }));

    const windRow = document.createElement('div');
    windRow.className = 'dh-row';
    const windLabel = el('span', 'color:#666;flex-shrink:0', 'wind');
    const windSlider = document.createElement('input');
    windSlider.type = 'range';
    windSlider.className = 'dh-slider';
    windSlider.min = '-0.02';
    windSlider.max = '1';
    windSlider.step = '0.02';
    windSlider.value = '-0.02';
    const windVal = el('span', 'color:#555;font-size:10px;width:28px;text-align:right', 'auto');
    windSlider.addEventListener('input', () => {
      const raw = parseFloat(windSlider.value);
      if (raw < 0) {
        windVal.textContent = 'auto';
        this.controls.setWindOverride(null);
      } else {
        windVal.textContent = raw.toFixed(2);
        this.controls.setWindOverride(raw);
      }
    });
    windRow.appendChild(windLabel);
    windRow.appendChild(windSlider);
    windRow.appendChild(windVal);
    panel.appendChild(windRow);

    panel.appendChild(toggleRow('pursuer audio', true, (on) => {
      this.controls.setPursuerAudioMuted(!on);
    }));
    panel.appendChild(toggleRow('breath audio', true, (on) => {
      this.controls.setBreathAudioMuted(!on);
    }));

    panel.appendChild(toggleRow('pursuer body', true, (on) => {
      this.controls.setPursuerBodyVisible(on);
    }));
    panel.appendChild(sectionLabel('graphics'));

    const savedRaw = localStorage.getItem(STORAGE_KEY);
    const currentMode: ExperienceMode = savedRaw
      ? (JSON.parse(savedRaw) as { experienceMode: ExperienceMode }).experienceMode
      : 'ps1';

    const modeRow = document.createElement('div');
    modeRow.className = 'dh-row';
    modeRow.appendChild(el('span', 'color:#666;flex-shrink:0', 'mode'));
    const modeBtns = document.createElement('div');
    modeBtns.style.cssText = 'display:flex;gap:6px';
    const ps1Btn = modeBtn('PS1', currentMode === 'ps1', () => this.switchMode('ps1'));
    const ps2Btn = modeBtn('PS2', currentMode === 'ps2', () => this.switchMode('ps2'));
    const radioBtn = modeBtn('RADIO', currentMode === 'radio', () => this.switchMode('radio'));
    modeBtns.appendChild(ps1Btn);
    modeBtns.appendChild(ps2Btn);
    modeBtns.appendChild(radioBtn);
    modeRow.appendChild(modeBtns);
    panel.appendChild(modeRow);

    const currentLowSpec = localStorage.getItem(PERF_MODE_STORAGE_KEY) === 'low';
    const lowSpecRow = document.createElement('div');
    lowSpecRow.className = 'dh-row';
    lowSpecRow.appendChild(el('span', 'color:#666;flex-shrink:0', 'quality'));
    const lowSpecBtns = document.createElement('div');
    lowSpecBtns.style.cssText = 'display:flex;gap:6px';
    const normalBtn = modeBtn('NORMAL', !currentLowSpec, () => this.switchPerfMode(false));
    const lowSpecBtn = modeBtn('LOW-SPEC', currentLowSpec, () => this.switchPerfMode(true));
    lowSpecBtns.appendChild(normalBtn);
    lowSpecBtns.appendChild(lowSpecBtn);
    lowSpecRow.appendChild(lowSpecBtns);
    panel.appendChild(lowSpecRow);

    panel.appendChild(sectionLabel('perf (for bisecting fps)'));
    panel.appendChild(toggleRow('shadows', true, (on) => {
      this.controls.setShadowsEnabled(on);
    }));
    panel.appendChild(toggleRow('ssao', true, (on) => {
      this.controls.setSSAOEnabled(on);
    }));
    panel.appendChild(toggleRow('post-fx (bloom/grain/blur)', true, (on) => {
      this.controls.setPostFXEnabled(on);
    }));

    panel.appendChild(sectionLabel('debug'));
    const debugDiv = document.createElement('div');
    debugDiv.id = 'dev-debug';
    panel.appendChild(debugDiv);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'dh-action';
    resetBtn.textContent = 'reset session → menu';
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });
    panel.appendChild(resetBtn);

    return panel;
  }

  private switchMode(mode: ExperienceMode): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    const config = raw ? JSON.parse(raw) : {};
    config.experienceMode = mode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.location.reload();
  }

  private switchPerfMode(lowSpec: boolean): void {
    localStorage.setItem(PERF_MODE_STORAGE_KEY, lowSpec ? 'low' : 'normal');
    window.location.reload();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.panel.remove();
  }
}

function el(tag: string, style: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  e.textContent = text;
  return e;
}

function sectionLabel(text: string): HTMLElement {
  return el('div', 'color:#444;font-size:9px;letter-spacing:.15em;margin:6px 0 2px;text-transform:uppercase', text);
}

function row(label: string, value: string): string {
  return `<div class="dh-row"><span class="dh-label">${label}</span><span class="dh-val">${value}</span></div>`;
}

function bar(v: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, v)) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${(v * 100).toFixed(0)}%`;
}

function sliderRow(
  label: string,
  min: number, max: number, step: number, defaultVal: number,
  onChange: (v: number) => void,
): HTMLElement {
  const r = document.createElement('div');
  r.className = 'dh-row';
  r.appendChild(el('span', 'color:#666;flex-shrink:0', label));
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'dh-slider';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(defaultVal);
  const valEl = el('span', 'color:#555;font-size:10px;width:28px;text-align:right', String(defaultVal));
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    valEl.textContent = v.toFixed(2);
    onChange(v);
  });
  r.appendChild(slider);
  r.appendChild(valEl);
  return r;
}

function toggleRow(label: string, initialOn: boolean, onChange: (on: boolean) => void): HTMLElement {
  const r = document.createElement('div');
  r.className = 'dh-row';
  r.appendChild(el('span', 'color:#666;flex-shrink:0', label));
  const btn = document.createElement('button');
  btn.className = 'dh-toggle' + (initialOn ? ' on' : '');
  btn.textContent = initialOn ? 'ON' : 'OFF';
  btn.addEventListener('click', () => {
    const on = btn.classList.toggle('on');
    btn.textContent = on ? 'ON' : 'OFF';
    onChange(on);
  });
  r.appendChild(btn);
  return r;
}

function modeBtn(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'dh-mode' + (active ? ' active' : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
