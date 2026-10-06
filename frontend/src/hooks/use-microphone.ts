"use client";

import { useEffect, useRef, useState } from "react";
import { advanceBlow, type BlowState } from "@/lib/blow";

type MicrophoneStatus =
  | "idle"
  | "requesting"
  | "calibrating"
  | "listening"
  | "denied"
  | "unsupported"
  | "timeout"
  | "error";

interface Resources {
  stream: MediaStream | null;
  context: AudioContext | null;
  frame: number;
  generation: number;
}

function release(resources: Resources) {
  resources.generation += 1;
  cancelAnimationFrame(resources.frame);
  resources.stream?.getTracks().forEach((track) => track.stop());
  resources.stream = null;
  if (resources.context && resources.context.state !== "closed") {
    void resources.context.close().catch(() => undefined);
  }
  resources.context = null;
}

export function useMicrophone(threshold: number, onBlow: () => void) {
  const [status, setStatus] = useState<MicrophoneStatus>("idle");
  const [level, setLevel] = useState(0);
  const resources = useRef<Resources>({
    stream: null,
    context: null,
    frame: 0,
    generation: 0,
  });

  useEffect(() => {
    const current = resources.current;
    function onVisibilityChange() {
      if (document.hidden && (current.stream || current.context)) {
        release(current);
        setStatus("idle");
        setLevel(0);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      release(current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  function stop() {
    release(resources.current);
    setStatus("idle");
    setLevel(0);
  }

  async function start() {
    const current = resources.current;
    release(current);
    const generation = current.generation;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.AudioContext ||
      !window.isSecureContext
    ) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const context = new AudioContext();
      current.context = context;
      await context.resume();
      if (generation !== current.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (generation !== current.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.25;
      source.connect(analyser);
      const waveform = new Uint8Array(analyser.fftSize);
      const frequencies = new Uint8Array(analyser.frequencyBinCount);
      const startedAt = performance.now();
      let lastFrame = startedAt;
      let lastMeter = startedAt;
      let ambientTotal = 0;
      let ambientSamples = 0;
      let listening = false;
      let state: BlowState = { sustainedMs: 0, detected: false };
      setStatus("calibrating");

      function analyze(now: number) {
        if (generation !== current.generation) return;
        const elapsedMs = now - lastFrame;
        lastFrame = now;
        if (now - startedAt > 14000) {
          release(current);
          setStatus("timeout");
          setLevel(0);
          return;
        }
        analyser.getByteTimeDomainData(waveform);
        analyser.getByteFrequencyData(frequencies);
        const rms = Math.sqrt(
          waveform.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
            waveform.length,
        );
        if (now - startedAt < 800) {
          ambientTotal += rms;
          ambientSamples += 1;
        } else {
          if (!listening) {
            listening = true;
            setStatus("listening");
          }
          const higherBin = Math.ceil(
            600 / (context.sampleRate / analyser.fftSize),
          );
          const totalEnergy = frequencies.reduce(
            (sum, value) => sum + value,
            0,
          );
          const higherEnergy = frequencies
            .slice(higherBin)
            .reduce((sum, value) => sum + value, 0);
          state = advanceBlow(
            state,
            {
              rms,
              broadbandRatio: totalEnergy ? higherEnergy / totalEnergy : 0,
              elapsedMs,
            },
            {
              threshold,
              ambientLevel: ambientSamples ? ambientTotal / ambientSamples : 0,
            },
          );
          if (state.detected) {
            release(current);
            setStatus("idle");
            setLevel(0);
            onBlow();
            return;
          }
        }
        if (now - lastMeter > 80) {
          lastMeter = now;
          setLevel(Math.min(1, rms / Math.max(threshold * 2, 0.01)));
        }
        current.frame = requestAnimationFrame(analyze);
      }
      current.frame = requestAnimationFrame(analyze);
    } catch (error) {
      if (generation !== current.generation) return;
      release(current);
      const name = error instanceof DOMException ? error.name : "";
      let nextStatus: MicrophoneStatus = "error";
      if (name === "NotAllowedError" || name === "SecurityError")
        nextStatus = "denied";
      if (name === "NotFoundError") nextStatus = "unsupported";
      setStatus(nextStatus);
    }
  }

  return { status, level, start, stop };
}
