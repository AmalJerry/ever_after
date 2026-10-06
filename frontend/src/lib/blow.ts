export interface BlowSample {
  rms: number;
  broadbandRatio: number;
  elapsedMs: number;
}

export interface BlowState {
  sustainedMs: number;
  detected: boolean;
}

export interface BlowOptions {
  threshold: number;
  ambientLevel: number;
  durationMs?: number;
  ambientMultiplier?: number;
  minimumBroadbandRatio?: number;
}

export function advanceBlow(
  state: BlowState,
  sample: BlowSample,
  options: BlowOptions,
): BlowState {
  if (state.detected) return state;
  const threshold = Math.max(
    options.threshold,
    options.ambientLevel * (options.ambientMultiplier ?? 2.4),
  );
  const qualifies =
    Number.isFinite(sample.rms) &&
    sample.rms >= threshold &&
    sample.broadbandRatio >= (options.minimumBroadbandRatio ?? 0.12);
  const sustainedMs = qualifies
    ? state.sustainedMs + Math.max(0, Math.min(sample.elapsedMs, 100))
    : 0;
  return {
    sustainedMs,
    detected: sustainedMs >= (options.durationMs ?? 450),
  };
}
