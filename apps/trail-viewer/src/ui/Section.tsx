import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact';

const headingStyle: JSX.CSSProperties = {
  marginTop: '10px',
  paddingTop: '6px',
  borderTop: '1px solid rgba(255,255,255,0.15)',
  fontWeight: 'bold',
  fontSize: '11px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#9cf',
};

// Pure layout — a label plus consistent top spacing/divider so main.tsx's
// composition reads as grouped sections instead of one flat list. No
// collapse state, no persistence (deliberately, per the grouping-only scope
// this was built for) — just enough structure to make the panel legible.
export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div>
      <div style={headingStyle}>{title}</div>
      {children}
    </div>
  );
}
