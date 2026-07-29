import type { SurveilledInteriorCamera } from '../interiors/SurveilledInteriorCamera';

interface SurveillanceCameraControlsProps {
  controller: SurveilledInteriorCamera;
}

export function SurveillanceCameraControls({ controller }: SurveillanceCameraControlsProps) {
  return (
    <div class='surveillance-camera-controls'>
      <button
        type='button'
        disabled={controller.isAnimating.value}
        onClick={() => controller.rotate(-1)}
        aria-label='Rotate counter-clockwise'
      >
        ↶
      </button>
      <span>view {controller.orientation.value + 1}/4</span>
      <button
        type='button'
        disabled={controller.isAnimating.value}
        onClick={() => controller.rotate(1)}
        aria-label='Rotate clockwise'
      >
        ↷
      </button>
      <button
        type='button'
        disabled={controller.isAnimating.value}
        onClick={() => controller.changeZoom(-0.1)}
        aria-label='Zoom out'
      >
        −
      </button>
      <span>{Math.round(controller.zoom.value * 100)}%</span>
      <button
        type='button'
        disabled={controller.isAnimating.value}
        onClick={() => controller.changeZoom(0.1)}
        aria-label='Zoom in'
      >
        +
      </button>
    </div>
  );
}
