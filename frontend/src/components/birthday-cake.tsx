"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Heart, RotateCcw, Sparkles, Wind, X } from "lucide-react";
import { useMicrophone } from "@/hooks/use-microphone";
import type { ExperienceContent } from "@/lib/types";
import { getPresentation } from "@/lib/presentation";
import { formatDate } from "@/lib/demo";
import { LoveScene } from "./love-scene";

export function BirthdayCake({
  experience,
  onExtinguished,
  onListenStart,
  onCandlesOut,
  calmMotion = false,
}: Readonly<{
  experience: ExperienceContent;
  onExtinguished?: () => void;
  onListenStart?: () => void;
  onCandlesOut?: () => void;
  calmMotion?: boolean;
}>) {
  const [extinguished, setExtinguished] = useState(false);
  const presentation = getPresentation(experience);
  const copy = presentation.copy;
  const motionPreference = useReducedMotion();
  const reducedMotion = calmMotion || motionPreference;

  useEffect(() => {
    if (!extinguished || !onExtinguished) return;
    const timer = window.setTimeout(onExtinguished, reducedMotion ? 400 : 1500);
    return () => window.clearTimeout(timer);
  }, [extinguished, onExtinguished, reducedMotion]);

  function celebrate() {
    setExtinguished(true);
    onCandlesOut?.();
    if (!reducedMotion) {
      void import("canvas-confetti")
        .then(({ default: confetti }) => {
          void confetti({
            particleCount: 90,
            spread: 85,
            origin: { y: 0.7 },
            colors: [presentation.accentColor, "#efc0d5", "#e6c86e", "#fffaf4"],
            disableForReducedMotion: true,
          });
        })
        .catch(() => undefined);
    }
  }

  const microphone = useMicrophone(experience.microphoneSensitivity, celebrate);
  const active = ["requesting", "calibrating", "listening"].includes(
    microphone.status,
  );
  const needsFallback = ["denied", "unsupported", "timeout", "error"].includes(
    microphone.status,
  );
  const messages: Record<string, string> = {
    requesting: "Waiting for microphone permission...",
    calibrating: "One quiet moment while we listen to the room...",
    listening: "Make your wish, then gently blow toward your microphone.",
    denied: "Microphone access is off. A little tap works just as beautifully.",
    unsupported:
      "Your microphone isn't available here. Your wish is one tap away.",
    timeout:
      "We couldn't quite catch that. Try again, or make your wish with a tap.",
    error:
      "We couldn't connect to the microphone. Try again or use the tap below.",
  };

  function manualBlow() {
    microphone.stop();
    onListenStart?.();
    celebrate();
  }

  return (
    <section
      className="journey-page wish-opening"
      id="make-a-wish"
      aria-labelledby="wish-title"
    >
      <div className="journey-heading">
        <span className="journey-eyebrow">
          <Sparkles size={13} /> {copy.wishEyebrow}
        </span>
        <h1
          id="wish-title"
          tabIndex={-1}
          className={
            experience.recipientName.length > 22 ? "journey-long-name" : ""
          }
        >
          {copy.wishHeading}
          <br />
          <em>{experience.recipientName || "my love"}.</em>
        </h1>
        {presentation.showBirthday && (
          <span className="birthday-date">
            {formatDate(experience.birthday, false)}
          </span>
        )}
        {experience.subtitle && <p>{experience.subtitle}</p>}
      </div>
      <div
        className={`birthday-stage ${extinguished ? "is-extinguished" : ""}`}
        role="img"
        aria-label={`${experience.cakeColor} birthday cake with ${experience.candleCount} ${extinguished ? "extinguished" : "lit"} candles`}
      >
        <LoveScene
          variant="cake"
          cakeColor={experience.cakeColor}
          candleCount={experience.candleCount}
          extinguished={extinguished}
          energy={microphone.level}
          still={calmMotion}
          fallback={
            <div className={`cake cake-${experience.cakeColor}`}>
              <div className="candles" aria-hidden="true">
                {Array.from({ length: experience.candleCount }, (_, index) => (
                  <div
                    className="candle"
                    key={index}
                    style={{ animationDelay: `${index * 0.2}s` }}
                  >
                    {!extinguished ? (
                      <div className="flame">
                        <div />
                      </div>
                    ) : (
                      <span className="smoke" />
                    )}
                    <span className="wick" />
                  </div>
                ))}
              </div>
              <div className="cake-top">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="cake-body">
                <div className="cake-drips">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <Heart
                  className="cake-heart"
                  size={28}
                  fill="currentColor"
                  strokeWidth={1}
                />
                <span className="cake-bottom-trim" />
              </div>
              <div className="cake-plate" />
              <div className="cake-stand" />
            </div>
          }
        />
        <Sparkles
          className="stage-star stage-star-left"
          size={22}
          strokeWidth={1}
          aria-hidden="true"
        />
        <Sparkles
          className="stage-star stage-star-right"
          size={30}
          strokeWidth={1}
          aria-hidden="true"
        />
        <span className="stage-side-note" aria-hidden="true">
          {copy.wishSent}
        </span>
      </div>
      <div className="journey-wish-controls">
        <AnimatePresence mode="wait">
          {extinguished ? (
            <motion.div
              key="wished"
              className="wish-complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="wish-success">
                <Check size={16} /> {copy.wishSuccess}
              </span>
              <p className="wish-sent">{copy.wishSent}</p>
              {!onExtinguished && (
                <button
                  className="text-button"
                  onClick={() => setExtinguished(false)}
                >
                  <RotateCcw size={14} /> {copy.replayButton}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="lit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="wish-actions">
                <button
                  className="button wish-button"
                  aria-describedby="wish-microphone-notice"
                  onClick={() => {
                    if (active) microphone.stop();
                    else {
                      onListenStart?.();
                      void microphone.start();
                    }
                  }}
                >
                  {active ? <X size={17} /> : <Wind size={17} />}
                  {active ? "Cancel listening" : copy.wishButton}
                </button>
              </div>
              <output className="wish-status" id="wish-microphone-notice">
                {messages[microphone.status] ||
                  "Uses your microphone to catch your breath"}
              </output>
              {needsFallback && (
                <button
                  className="text-button wish-fallback"
                  onClick={manualBlow}
                >
                  Make a wish without a microphone
                </button>
              )}
              {active && (
                <meter
                  className="microphone-meter"
                  aria-label="Microphone level"
                  min={0}
                  max={1}
                  value={microphone.level}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
