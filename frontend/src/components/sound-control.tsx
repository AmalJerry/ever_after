"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { createBirthdayMusic } from "@/lib/birthday-music";

export interface SoundControlHandle {
  prepare: () => void;
  start: () => void;
  stop: () => void;
}

interface SoundSession {
  context: AudioContext;
  master: GainNode;
  source: AudioBufferSourceNode | null;
  media: HTMLAudioElement | null;
  mediaSource: MediaElementAudioSourceNode | null;
  priming: Promise<void> | null;
}

export function SoundControl({
  audioUrl,
  visible = true,
  initialVolume = 0.8,
  ref,
}: Readonly<{
  audioUrl: string;
  visible?: boolean;
  initialVolume?: number;
  ref?: Ref<SoundControlHandle>;
}>) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const session = useRef<SoundSession | null>(null);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
      const current = session.current;
      current?.media?.pause();
      current?.source?.stop();
      current?.source?.disconnect();
      current?.mediaSource?.disconnect();
      current?.master.disconnect();
      if (current && current.context.state !== "closed")
        void current.context.close().catch(() => undefined);
      session.current = null;
    },
    [audioUrl],
  );

  useEffect(() => {
    const current = session.current;
    if (current)
      current.master.gain.setTargetAtTime(
        playing && !muted ? volume : 0,
        current.context.currentTime,
        0.04,
      );
  }, [volume, muted, playing]);

  function ensureSession() {
    if (session.current) return session.current;
    if (!window.AudioContext) throw new Error("Audio is unavailable.");
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const media = audioUrl ? audio.current : null;
    const mediaSource = media ? context.createMediaElementSource(media) : null;
    mediaSource?.connect(master);
    session.current = {
      context,
      master,
      source: null,
      media,
      mediaSource,
      priming: null,
    };
    return session.current;
  }

  async function prepare() {
    const current = ensureSession();
    if (current.priming) return current.priming;
    const version = generation.current;
    const resumed = current.context.resume();
    const prepared = current.media ? current.media.play() : Promise.resolve();
    current.priming = Promise.all([resumed, prepared])
      .then(() => {
        if (version !== generation.current) return;
        if (current.media) {
          current.media.pause();
          current.media.currentTime = 0;
        }
      })
      .catch((failure: unknown) => {
        current.media?.pause();
        current.priming = null;
        throw failure;
      });
    return current.priming;
  }

  async function start() {
    const version = generation.current;
    setError("");
    try {
      const current = ensureSession();
      if (current.priming) await current.priming;
      if (version !== generation.current) return;
      await current.context.resume();
      if (version !== generation.current) return;
      if (current.media) {
        await current.media.play();
        if (version !== generation.current) {
          current.media.pause();
          return;
        }
      } else if (!current.source) {
        const source = current.context.createBufferSource();
        source.buffer = createBirthdayMusic(current.context);
        source.loop = true;
        source.connect(current.master);
        source.start();
        current.source = source;
      }
      current.master.gain.setTargetAtTime(
        muted ? 0 : volume,
        current.context.currentTime,
        0.04,
      );
      setPlaying(true);
    } catch {
      if (version !== generation.current) return;
      setPlaying(false);
      setError("Tap play to start the birthday music.");
    }
  }

  function stop() {
    generation.current += 1;
    const current = session.current;
    if (current) {
      current.master.gain.cancelScheduledValues(current.context.currentTime);
      current.master.gain.value = 0;
      current.media?.pause();
      if (current.media) current.media.currentTime = 0;
      current.source?.stop();
      current.source?.disconnect();
      current.source = null;
      current.priming = null;
      void current.context.suspend().catch(() => undefined);
    }
    setPlaying(false);
    setError("");
  }

  useImperativeHandle(ref, () => ({
    prepare: () => {
      void prepare().catch(() => undefined);
    },
    start: () => {
      void start();
    },
    stop,
  }));

  async function toggle() {
    if (!playing) {
      void start();
      return;
    }
    generation.current += 1;
    try {
      const current = session.current;
      if (current) {
        current.media?.pause();
        await current.context.suspend();
      }
      setPlaying(false);
    } catch {
      stop();
      setError("Sound is unavailable. The celebration is still all yours.");
    }
  }

  return (
    <div className="sound-control" hidden={!visible}>
      {audioUrl && (
        <audio
          ref={audio}
          src={audioUrl}
          loop
          preload="none"
          onError={() => {
            stop();
            setError("This audio could not be played.");
          }}
        />
      )}
      <button
        className={`sound-toggle ${playing ? "is-playing" : ""}`}
        onClick={toggle}
        aria-label={playing ? "Pause music" : "Play music"}
        title={playing ? "Pause music" : "Play music"}
        aria-pressed={playing}
      >
        {playing ? (
          <span className="equalizer" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <Music2 size={16} />
        )}
        <span>Sound {playing ? "on" : "off"}</span>
        {playing ? <Pause size={12} /> : <Play size={12} />}
      </button>
      {playing && (
        <details className="sound-volume-menu">
          <summary
            className="icon-button"
            aria-label="Volume controls"
            title="Volume controls"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </summary>
          <div className="volume-controls">
            <button
              className="icon-button"
              aria-label={muted ? "Unmute music" : "Mute music"}
              title={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted(!muted)}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              aria-label="Music volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </div>
        </details>
      )}
      {error && <output className="sound-error">{error}</output>}
    </div>
  );
}
