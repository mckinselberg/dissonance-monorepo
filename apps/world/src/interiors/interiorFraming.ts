export interface InteriorBounds {
  width: number;
  depth: number;
  height: number;
}

export interface OrthographicFraming {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function clampInteriorZoom(zoom: number, min = 0.75, max = 1.8): number {
  return Math.max(min, Math.min(max, zoom));
}

export function calculateOrthographicFraming(
  bounds: InteriorBounds,
  orientation: number,
  aspect: number,
  zoom: number,
  padding = 1.12,
  cameraBeta = Math.PI / 3,
): OrthographicFraming {
  const quarterTurn = ((orientation % 4) + 4) % 4;
  const width = quarterTurn % 2 === 0 ? bounds.width : bounds.depth;
  const viewDepth = quarterTurn % 2 === 0 ? bounds.depth : bounds.width;
  const projectedHeight =
    bounds.height * Math.sin(cameraBeta) + viewDepth * Math.cos(cameraBeta);
  const safeAspect = Math.max(0.1, aspect);
  const safeZoom = clampInteriorZoom(zoom);
  const halfHeight = Math.max(projectedHeight / 2, width / (2 * safeAspect))
    * padding / safeZoom;
  const halfWidth = halfHeight * safeAspect;
  return {
    left: -halfWidth,
    right: halfWidth,
    top: halfHeight,
    bottom: -halfHeight,
  };
}
