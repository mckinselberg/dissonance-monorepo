export const STRIKE_CONSTANTS = {
  strikeRainThreshold: 0.42,
  strikeWindupMinSeconds: 5,
  strikeWindupMaxSeconds: 11,
  rainEstablishTimeoutSeconds: 75,
  losRange: 28,
  strikeAnchorCaptureRange: 5.5,
  flashIntensity: 0.28,
  flashDurationSeconds: 0.16,
  clapDelayFromFlashSeconds: 0.12,
  recoveryProximityRange: 2.1,
  droneInertSettleSeconds: 1.25,
} as const;
