const app = document.getElementById('app');

if (!app) {
  throw new Error('Missing #app container');
}

app.innerHTML = `
  <style>
    :root {
      color-scheme: dark;
      --bg-top: #0f1720;
      --bg-bottom: #030608;
      --card: rgba(10, 14, 18, 0.78);
      --line: rgba(198, 226, 255, 0.16);
      --text: #edf4ff;
      --muted: #9cb0c7;
      --accent-game: #d9f06b;
      --accent-trails: #7cd3ff;
      --shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      min-height: 100%;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top, rgba(130, 166, 201, 0.18), transparent 42%),
        linear-gradient(180deg, var(--bg-top), var(--bg-bottom) 72%);
      color: var(--text);
    }

    body {
      min-height: 100vh;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .shell {
      min-height: 100vh;
      padding: 32px 20px 48px;
      display: grid;
      place-items: center;
    }

    .frame {
      width: min(1080px, 100%);
      display: grid;
      gap: 24px;
    }

    .hero {
      padding: 20px 4px 6px;
    }

    .eyebrow {
      margin: 0 0 10px;
      font-size: 0.72rem;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--muted);
    }

    h1 {
      margin: 0;
      font-size: clamp(2.6rem, 8vw, 5.6rem);
      line-height: 0.92;
      letter-spacing: -0.05em;
      max-width: 9ch;
    }

    .summary {
      margin: 18px 0 0;
      max-width: 34rem;
      font-size: 1.02rem;
      line-height: 1.7;
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .card {
      position: relative;
      overflow: hidden;
      min-height: 300px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--card);
      box-shadow: var(--shadow);
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
      backdrop-filter: blur(10px);
    }

    .card::before {
      content: "";
      position: absolute;
      inset: auto -15% -30% auto;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      opacity: 0.22;
      filter: blur(10px);
      pointer-events: none;
    }

    .card:hover,
    .card:focus-visible {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.28);
      background: rgba(16, 20, 26, 0.88);
    }

    .card:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.35);
      outline-offset: 2px;
    }

    .card--game::before {
      background: radial-gradient(circle, var(--accent-game), transparent 68%);
    }

    .card--trails::before {
      background: radial-gradient(circle, var(--accent-trails), transparent 68%);
    }

    .label {
      margin: 0 0 12px;
      font-size: 0.7rem;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .title {
      margin: 0;
      font-size: clamp(1.9rem, 5vw, 3.3rem);
      line-height: 0.94;
      letter-spacing: -0.04em;
    }

    .desc {
      margin: 14px 0 0;
      max-width: 26rem;
      color: var(--muted);
      font-size: 0.98rem;
      line-height: 1.65;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 12px;
      margin-top: 24px;
      color: var(--text);
      font-size: 0.92rem;
      letter-spacing: 0.04em;
    }

    .path {
      color: var(--muted);
      font-family: "Courier New", monospace;
      font-size: 0.8rem;
    }

    @media (max-width: 760px) {
      .shell {
        padding-inline: 16px;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      .card {
        min-height: 260px;
      }
    }
  </style>

  <main class="shell">
    <div class="frame">
      <section class="hero">
        <p class="eyebrow">Dissonance Monorepo</p>
        <h1>Choose where to enter the forest.</h1>
        <p class="summary">
          The root of this deployment is now a shared launch point. Pick the horror game or the
          terrain sandbox, and each one stays on its own clean route.
        </p>
      </section>

      <section class="grid" aria-label="App chooser">
        <a class="card card--game" href="/dont-turn-around/">
          <div>
            <p class="label">Playable Experience</p>
            <h2 class="title">Don&apos;t Turn Around</h2>
            <p class="desc">
              Drop straight into the atmospheric game build, with the main menu and saved-session
              flow intact.
            </p>
          </div>
          <div class="meta">
            <span>Open app</span>
            <span class="path">/dont-turn-around/</span>
          </div>
        </a>

        <a class="card card--trails" href="/trail-viewer/">
          <div>
            <p class="label">World And Data Tools</p>
            <h2 class="title">Trail Viewer</h2>
            <p class="desc">
              Explore the terrain viewer, route overlays, HUD controls, and calibration tools on a
              dedicated path.
            </p>
          </div>
          <div class="meta">
            <span>Open app</span>
            <span class="path">/trail-viewer/</span>
          </div>
        </a>
      </section>
    </div>
  </main>
`;
