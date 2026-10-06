import { expect, test } from "@playwright/test";
import { advanceBlow, type BlowState } from "../src/lib/blow";

const options = { threshold: 0.06, ambientLevel: 0.01 };
const empty: BlowState = { sustainedMs: 0, detected: false };

test("silence and a brief noise do not extinguish the candle", () => {
  const silence = advanceBlow(
    empty,
    { rms: 0, broadbandRatio: 0.5, elapsedMs: 50 },
    options,
  );
  expect(silence.detected).toBe(false);
  const click = advanceBlow(
    empty,
    { rms: 0.5, broadbandRatio: 0.5, elapsedMs: 50 },
    options,
  );
  expect(click.detected).toBe(false);
  expect(
    advanceBlow(
      click,
      { rms: 0.01, broadbandRatio: 0.5, elapsedMs: 50 },
      options,
    ).sustainedMs,
  ).toBe(0);
});

test("sustained broadband input above the noise floor is detected", () => {
  let state = empty;
  for (let index = 0; index < 9; index += 1) {
    state = advanceBlow(
      state,
      { rms: 0.12, broadbandRatio: 0.4, elapsedMs: 50 },
      options,
    );
  }
  expect(state.detected).toBe(true);
});

test("ambient noise and sensitivity settings change the threshold", () => {
  const sample = { rms: 0.12, broadbandRatio: 0.4, elapsedMs: 50 };
  expect(
    advanceBlow(empty, sample, { ...options, ambientLevel: 0.1 }).sustainedMs,
  ).toBe(0);
  expect(
    advanceBlow(empty, sample, { ...options, threshold: 0.15 }).sustainedMs,
  ).toBe(0);
  expect(advanceBlow(empty, sample, options).sustainedMs).toBe(50);
});

test("narrow-band tones, invalid samples, and delayed frames cannot instantly trigger", () => {
  expect(
    advanceBlow(
      empty,
      { rms: 0.8, broadbandRatio: 0.01, elapsedMs: 50 },
      options,
    ).sustainedMs,
  ).toBe(0);
  expect(
    advanceBlow(
      empty,
      { rms: NaN, broadbandRatio: 0.8, elapsedMs: 50 },
      options,
    ).detected,
  ).toBe(false);
  expect(
    advanceBlow(
      empty,
      { rms: 0.8, broadbandRatio: 0.8, elapsedMs: 5000 },
      options,
    ).detected,
  ).toBe(false);
});
