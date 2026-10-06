const SAMPLE_RATE = 24000;
const BEAT_SECONDS = 60 / 96;
const MELODY: ReadonlyArray<readonly [number, number]> = [
  [67, 0.75],
  [67, 0.25],
  [69, 1],
  [67, 1],
  [72, 1],
  [71, 2],
  [67, 0.75],
  [67, 0.25],
  [69, 1],
  [67, 1],
  [74, 1],
  [72, 2],
  [67, 0.75],
  [67, 0.25],
  [79, 1],
  [76, 1],
  [72, 1],
  [71, 1],
  [69, 1],
  [77, 0.75],
  [77, 0.25],
  [76, 1],
  [72, 1],
  [74, 1],
  [72, 2],
];
const CHORDS = [
  [48, 52, 55],
  [48, 52, 55],
  [43, 47, 50],
  [43, 47, 50],
  [48, 52, 55],
  [48, 52, 55],
  [41, 45, 48],
  [43, 47, 50],
  [48, 52, 55],
  [48, 52, 55],
];

function addNote(
  samples: Float32Array,
  pitch: number,
  start: number,
  duration: number,
  level: number,
) {
  const frequency = 440 * 2 ** ((pitch - 69) / 12);
  const firstSample = Math.round(start * SAMPLE_RATE);
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  for (
    let index = 0;
    index < sampleCount && firstSample + index < samples.length;
    index += 1
  ) {
    const time = index / SAMPLE_RATE;
    const attack = Math.min(1, time / 0.008);
    const release = Math.min(1, (duration - time) / 0.15);
    const envelope = attack * release * Math.exp(-time * 2.3);
    const phase = 2 * Math.PI * frequency * time;
    const tone =
      Math.sin(phase) +
      0.28 * Math.sin(phase * 2) * Math.exp(-time * 3) +
      0.1 * Math.sin(phase * 3) * Math.exp(-time * 5);
    samples[firstSample + index] += tone * envelope * level;
  }
}

export function createBirthdayMusic(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil((30 * BEAT_SECONDS + 2) * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  const samples = buffer.getChannelData(0);
  let beat = 3;
  for (const [pitch, length] of MELODY) {
    addNote(
      samples,
      pitch + 12,
      beat * BEAT_SECONDS,
      Math.max(length * BEAT_SECONDS, 0.9),
      0.25,
    );
    beat += length;
  }
  CHORDS.forEach((chord, bar) => {
    chord.forEach((pitch, index) => {
      addNote(samples, pitch + 12, (bar * 3 + index) * BEAT_SECONDS, 1.9, 0.07);
    });
    addNote(samples, chord[0], bar * 3 * BEAT_SECONDS, 2.1, 0.07);
  });
  return buffer;
}
