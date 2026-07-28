const app = document.getElementById('app');

if (!app) throw new Error('Missing #app container');

app.innerHTML = `
  <style>
    :root {
      color-scheme: dark;
      font-family: Georgia, "Times New Roman", serif;
      background: #090806;
      color: #f3eee2;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background:
      radial-gradient(circle at 60% 0%, rgba(181, 155, 91, 0.16), transparent 38%),
      linear-gradient(#17130e, #070605 72%); }
    a { color: inherit; text-decoration: none; }
    main { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 64px 0; }
    .eyebrow { color: #b8a989; letter-spacing: .24em; text-transform: uppercase; font: 12px monospace; }
    h1 { margin: 12px 0; font-size: clamp(3rem, 9vw, 6rem); letter-spacing: -.05em; }
    .intro { max-width: 580px; color: #bdb4a5; line-height: 1.7; }
    .exhibits { display: grid; gap: 16px; margin-top: 42px; }
    .exhibit { display: block; padding: 24px; border: 1px solid rgba(235, 220, 185, .2);
      border-radius: 18px; background: rgba(13, 11, 9, .72); }
    .exhibit:hover, .exhibit:focus-visible { border-color: rgba(235, 220, 185, .5);
      transform: translateY(-2px); }
    .exhibit h2 { margin: 0 0 10px; font-size: 2rem; }
    .exhibit p { margin: 0; color: #bdb4a5; line-height: 1.6; }
    .path { display: block; margin-top: 18px; color: #d8caab; font: 12px monospace; }
    .back { display: inline-block; margin-top: 32px; color: #b8a989; font: 13px monospace; }
  </style>
  <main>
    <p class="eyebrow">Playable Archive</p>
    <h1>Museum</h1>
    <p class="intro">
      Preserved builds remain playable here as records of the project’s path.
      Each exhibit keeps its original mechanics and assumptions intact.
    </p>
    <section class="exhibits" aria-label="Museum exhibits">
      <a class="exhibit" href="/museum/dont-turn-around/">
        <h2>Don’t Turn Around</h2>
        <p>The original first-person forest pursuit build, preserved as a complete exhibit.</p>
        <span class="path">/museum/dont-turn-around/</span>
      </a>
    </section>
    <a class="back" href="/">← Back to layers</a>
  </main>
`;
