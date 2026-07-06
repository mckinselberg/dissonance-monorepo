import type { ArtifactIconKind } from '../config/trails';

// Small line-art SVGs, code-only (no image assets) — matches how the rest
// of this game avoids a texture/asset pipeline. Each shape is a loose visual
// match for the artifact's fictional description, not a literal render of
// its in-world mesh (all three currently share the same placeholder
// post+tag geometry in ArtifactProp).
const ICONS: Record<ArtifactIconKind, string> = {
  tag: `
    <path d="M4 10 L13 4 L21 12 L12 20 Z" />
    <circle cx="8.6" cy="9.6" r="1.3" fill="currentColor" stroke="none" />
  `,
  stone: `
    <path d="M4 15 Q3 9 9 7 Q16 4 20 10 Q22 15 17 18 Q9 21 4 15 Z" />
    <path d="M9 11 L13 9 L12 14" stroke-width="1.1" />
  `,
  charm: `
    <circle cx="12" cy="6.4" r="3.1" />
    <path d="M12 9.5 L12 12.8" />
    <path d="M8 12.8 Q12 20 16 12.8 Q12 16.2 8 12.8 Z" />
  `,
};

export function artifactIconSvg(kind: ArtifactIconKind): string {
  return `
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor"
      stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
      ${ICONS[kind]}
    </svg>
  `;
}
