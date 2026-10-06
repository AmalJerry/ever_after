"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Asterisk,
  ChevronLeft,
  ChevronRight,
  Heart,
  LockKeyhole,
  Mail,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/demo";
import type { ExperienceContent, JourneyCopy, Memory } from "@/lib/types";
import {
  getChapters,
  getPresentation,
  presentationStyle,
  type Chapter,
} from "@/lib/presentation";
import { BirthdayCake } from "./birthday-cake";
import { LoveScene } from "./love-scene";
import { SoundControl, type SoundControlHandle } from "./sound-control";
import { StoryText } from "./story-text";
import "./experience.css";

function HeadingText({ text }: Readonly<{ text: string }>) {
  const [firstLine, ...rest] = text.split("\n");
  return (
    <>
      {firstLine}
      {rest.length > 0 && (
        <>
          <br />
          <em>{rest.join("\n")}</em>
        </>
      )}
    </>
  );
}

function MemoryScreen({
  memory,
  index,
  count,
  onPrevious,
  onNext,
  onContinue,
  copy,
  calmMotion,
}: Readonly<{
  memory: Memory;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
  onContinue: () => void;
  copy: JourneyCopy;
  calmMotion: boolean;
}>) {
  return (
    <section
      className="journey-page memory-screen"
      aria-labelledby="memory-heading"
    >
      <div className="journey-heading">
        <span className="journey-eyebrow">{copy.memoryEyebrow}</span>
        <h2 id="memory-heading" tabIndex={-1}>
          {memory.title || copy.memoryFallbackTitle}
        </h2>
      </div>
      <div className="memory-keepsake" key={memory.id}>
        <div className="keepsake-photo">
          {memory.kind === "video" ? (
            <video
              src={memory.url}
              controls
              playsInline
              preload="metadata"
              aria-label={memory.title || "Our memory video"}
            />
          ) : (
            <Image
              src={
                (calmMotion && memory.stillUrl
                  ? memory.stillUrl
                  : memory.url) || "/images/flowers.jpg"
              }
              alt={memory.title || "A favorite moment together"}
              fill
              sizes="(max-width: 600px) 88vw, 520px"
              unoptimized={memory.url.startsWith("/api/")}
            />
          )}
        </div>
        <div className="keepsake-label">
          <span>
            {memory.date ? formatDate(memory.date) : "A DAY TO REMEMBER"}
          </span>
          <Heart size={14} />
        </div>
      </div>
      {memory.caption ? (
        <div className="memory-caption">
          <StoryText text={memory.caption} label="Memory caption" />
        </div>
      ) : (
        <div className="memory-caption empty" />
      )}
      <div className="chapter-actions memory-page-actions">
        <button
          className="icon-button"
          aria-label="Previous memory"
          title="Previous memory"
          disabled={index === 0}
          onClick={onPrevious}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="page-count">
          {String(index + 1).padStart(2, "0")} <span>/</span>{" "}
          {String(count).padStart(2, "0")}
        </span>
        {index < count - 1 ? (
          <button
            className="icon-button"
            aria-label="Next memory"
            title="Next memory"
            onClick={onNext}
          >
            <ChevronRight size={20} />
          </button>
        ) : (
          <button className="button journey-button" onClick={onContinue}>
            <Mail size={16} /> {copy.memoryContinue} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

export function ExperienceView({
  experience,
  sample = false,
  preview = false,
  onExitPreview,
}: Readonly<{
  experience: ExperienceContent;
  sample?: boolean;
  preview?: boolean;
  onExitPreview?: () => void;
}>) {
  const [chapter, setChapter] = useState<Chapter>("wish");
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [letterOpen, setLetterOpen] = useState(false);
  const [surpriseResponse, setSurpriseResponse] = useState("");
  const [surpriseRevealed, setSurpriseRevealed] = useState(false);
  const presentation = getPresentation(experience);
  const copy = presentation.copy;
  const surpriseSubmitLabel =
    copy.surpriseButton === "Tell me everything" ? "Send" : copy.surpriseButton;
  const prefersReducedMotion = useReducedMotion();
  const calmMotion =
    !presentation.animationsEnabled || Boolean(prefersReducedMotion);
  const root = useRef<HTMLDivElement>(null);
  const soundtrack = useRef<SoundControlHandle>(null);
  const chapters = getChapters(experience);
  const stageNames: Record<Chapter, string> = {
    wish: "A wish for you",
    celebrate: "A little celebration",
    heart: "My favorite universe",
    memories: "Our little moments",
    letter: "From the heart",
    ending: "Always, you",
  };

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (surpriseRevealed) {
      root.current
        ?.querySelector<HTMLElement>(".surprise-message")
        ?.focus({ preventScroll: true });
    }
  }, [surpriseRevealed]);

  function focusHeading() {
    root.current
      ?.querySelector<HTMLElement>(".journey-page h1, .journey-page h2")
      ?.focus({ preventScroll: true });
  }

  function restart() {
    soundtrack.current?.stop();
    setChapter("wish");
    setMemoryIndex(0);
    setLetterOpen(false);
    setSurpriseResponse("");
    setSurpriseRevealed(false);
  }

  function goBack() {
    const index = chapters.indexOf(chapter);
    if (index > 1) setChapter(chapters[index - 1]);
  }

  function advanceChapter() {
    setChapter(chapters[chapters.indexOf(chapter) + 1] || "ending");
  }

  return (
    <MotionConfig reducedMotion={calmMotion ? "always" : "user"}>
      <div
        ref={root}
        className={`love-journey journey-theme-${experience.theme} ${calmMotion ? "is-calm" : ""}`}
        style={presentationStyle(presentation)}
        data-chapter={chapter}
      >
        {presentation.showCover && experience.heroImage && (
          <div className="journey-cover-backdrop" aria-hidden="true">
            <Image
              src={experience.heroImage}
              alt=""
              fill
              sizes="100vw"
              priority
              unoptimized={experience.heroImage.startsWith("/api/")}
            />
          </div>
        )}
        <div className="journey-ornament ornament-left" aria-hidden="true">
          <Heart strokeWidth={0.65} />
        </div>
        <div className="journey-ornament ornament-right" aria-hidden="true">
          <Heart strokeWidth={0.65} />
        </div>
        <header className="journey-topbar">
          <span className="journey-brand">
            {copy.brandName}
            <Asterisk size={14} strokeWidth={1.4} />
          </span>
          <div className="journey-tools">
            {preview ? (
              <button className="preview-exit" onClick={onExitPreview}>
                <ArrowLeft size={14} /> Back to editor
              </button>
            ) : !sample ? (
              <LockKeyhole size={14} aria-label="Private birthday story" />
            ) : null}
            {presentation.musicEnabled && (
              <SoundControl
                key={`${experience.audioUrl}:${presentation.musicVolume}`}
                ref={soundtrack}
                audioUrl={experience.audioUrl}
                initialVolume={presentation.musicVolume}
                visible={chapter !== "wish"}
              />
            )}
          </div>
        </header>
        <main className="journey-stage" aria-label="Your birthday story">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={chapter}
              className="chapter-frame"
              initial={{ opacity: 0, scale: calmMotion ? 1 : 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: calmMotion ? 1 : 1.025 }}
              transition={{
                duration: calmMotion ? 0 : 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={focusHeading}
            >
              {chapter === "wish" && (
                <BirthdayCake
                  experience={experience}
                  calmMotion={calmMotion}
                  onListenStart={() => soundtrack.current?.prepare()}
                  onCandlesOut={() => {
                    if (presentation.musicAutoplay) soundtrack.current?.start();
                  }}
                  onExtinguished={advanceChapter}
                />
              )}

              {chapter === "celebrate" && (
                <section
                  className="journey-page celebration-screen"
                  aria-labelledby="celebration-heading"
                >
                  <div className="journey-heading">
                    <span className="journey-eyebrow">
                      <Sparkles size={13} /> {copy.celebrationEyebrow}
                    </span>
                    <h2 id="celebration-heading" tabIndex={-1}>
                      <HeadingText text={copy.celebrationHeading} />
                    </h2>
                    {copy.celebrationMessage && (
                      <p>{copy.celebrationMessage}</p>
                    )}
                  </div>
                  <div className="celebration-art">
                    <Image
                      className="celebration-gif"
                      src={
                        calmMotion
                          ? presentation.celebrationMedia.stillUrl ||
                            presentation.celebrationMedia.url
                          : presentation.celebrationMedia.url
                      }
                      alt={presentation.celebrationMedia.alt}
                      fill
                      sizes="(max-width: 600px) 90vw, 450px"
                      unoptimized
                      priority
                    />
                    <span
                      className="art-spark art-spark-one"
                      aria-hidden="true"
                    >
                      <Sparkles size={26} strokeWidth={1} />
                    </span>
                    <span
                      className="art-spark art-spark-two"
                      aria-hidden="true"
                    >
                      <Heart size={18} strokeWidth={1} />
                    </span>
                  </div>
                  <div className="chapter-actions">
                    <button
                      className="button journey-button"
                      onClick={advanceChapter}
                    >
                      {copy.celebrationButton}{" "}
                      <Heart size={16} fill="currentColor" />
                      <ArrowRight size={16} />
                    </button>
                    <span className="handwritten-note">
                      {copy.celebrationNote}
                    </span>
                  </div>
                </section>
              )}

              {chapter === "heart" && (
                <section
                  className="journey-page heart-screen"
                  aria-labelledby="heart-heading"
                >
                  <div className="journey-heading">
                    <span className="journey-eyebrow">{copy.heartEyebrow}</span>
                    <h2 id="heart-heading" tabIndex={-1}>
                      <HeadingText text={copy.heartHeading} />
                    </h2>
                    {copy.heartMessage && <p>{copy.heartMessage}</p>}
                  </div>
                  <button
                    className="heart-portal"
                    aria-label="Open our memories"
                    title="Open our memories"
                    onClick={advanceChapter}
                  >
                    <LoveScene
                      variant="heart"
                      accentColor={presentation.accentColor}
                      still={calmMotion}
                      fallback={
                        <Heart
                          className="heart-fallback"
                          size={200}
                          fill="currentColor"
                          strokeWidth={0.7}
                        />
                      }
                    />
                    <span className="heart-portal-caption">
                      <span>{copy.heartButton}</span>
                      <ArrowRight size={17} />
                    </span>
                  </button>
                  <span className="handwritten-note">{copy.heartNote}</span>
                </section>
              )}

              {chapter === "memories" && experience.memories[memoryIndex] && (
                <MemoryScreen
                  key={memoryIndex}
                  memory={experience.memories[memoryIndex]}
                  index={memoryIndex}
                  count={experience.memories.length}
                  copy={copy}
                  calmMotion={calmMotion}
                  onPrevious={() => setMemoryIndex(memoryIndex - 1)}
                  onNext={() => setMemoryIndex(memoryIndex + 1)}
                  onContinue={advanceChapter}
                />
              )}

              {chapter === "letter" && (
                <section
                  className={`journey-page letter-screen ${letterOpen ? "letter-is-open" : ""}`}
                  aria-labelledby="letter-heading"
                >
                  <div className="journey-heading">
                    <span className="journey-eyebrow">
                      {copy.letterEyebrow}
                    </span>
                    <h2 id="letter-heading" tabIndex={-1}>
                      {letterOpen ? (
                        experience.letterTitle || "My favorite person,"
                      ) : (
                        <HeadingText text={copy.letterHeading} />
                      )}
                    </h2>
                  </div>
                  {letterOpen ? (
                    <div className="open-letter">
                      <Heart
                        size={22}
                        className="letter-heart"
                        strokeWidth={1.2}
                      />
                      <StoryText
                        text={experience.letterBody}
                        label="Love letter"
                      />
                      <span className="journey-signature">
                        {copy.letterSignOff}{" "}
                        {experience.senderName || "your person"}
                      </span>
                    </div>
                  ) : (
                    <button
                      className="sealed-letter"
                      aria-label={copy.letterButton}
                      title={copy.letterButton}
                      onClick={() => setLetterOpen(true)}
                    >
                      <span className="envelope-backing" />
                      <span className="envelope-insert">
                        For {experience.recipientName || "my love"},<br />
                        <em>{experience.letterTitle}</em>
                      </span>
                      <span className="envelope-fold" />
                      <span className="envelope-lid" />
                      <span className="rose-seal">
                        <Heart size={24} strokeWidth={1.4} />
                      </span>
                      <span className="envelope-caption">
                        {copy.letterNote}
                      </span>
                    </button>
                  )}
                  <div className="chapter-actions">
                    {letterOpen ? (
                      <button
                        className="button journey-button"
                        onClick={advanceChapter}
                      >
                        {copy.finaleButton}
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="button journey-button"
                        onClick={() => setLetterOpen(true)}
                      >
                        <Mail size={16} /> {copy.letterButton}{" "}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </section>
              )}

              {chapter === "ending" && (
                <section
                  className={`journey-page ending-screen ${experience.surprise.enabled ? "has-surprise" : ""}`}
                  aria-labelledby="ending-heading"
                >
                  <div className="journey-heading">
                    <span className="journey-eyebrow">
                      {copy.finaleEyebrow}
                    </span>
                    <h2 id="ending-heading" tabIndex={-1}>
                      <HeadingText text={copy.finaleHeading} />
                    </h2>
                  </div>
                  <div className="ending-art">
                    <Image
                      className="ending-gif"
                      src={
                        calmMotion
                          ? presentation.finaleMedia.stillUrl ||
                            presentation.finaleMedia.url
                          : presentation.finaleMedia.url
                      }
                      alt={presentation.finaleMedia.alt}
                      fill
                      sizes="(max-width: 600px) 85vw, 330px"
                      unoptimized
                    />
                  </div>
                  {experience.surprise.enabled && (
                    <div className="finale-surprise">
                      <h3>
                        <HeadingText text={copy.surpriseHeading} />
                      </h3>
                      <section
                        className="surprise-message"
                        id="surprise-prompt"
                        aria-label={
                          surpriseRevealed
                            ? "Your surprise result"
                            : "Surprise question"
                        }
                        tabIndex={-1}
                      >
                        <StoryText
                          key={surpriseRevealed ? "answer" : "question"}
                          text={
                            surpriseRevealed
                              ? experience.surprise.answer
                              : experience.surprise.question
                          }
                          label={
                            surpriseRevealed
                              ? "Surprise answer"
                              : "Surprise question"
                          }
                        />
                      </section>
                      {!surpriseRevealed && (
                        <form
                          className="surprise-response-form"
                          aria-label="Surprise response"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (!surpriseResponse.trim()) return;
                            setSurpriseRevealed(true);
                          }}
                        >
                          <label
                            className="sr-only"
                            htmlFor="surprise-response"
                          >
                            Your response
                          </label>
                          <input
                            id="surprise-response"
                            name="response"
                            type="text"
                            value={surpriseResponse}
                            onChange={(event) =>
                              setSurpriseResponse(event.target.value)
                            }
                            aria-describedby="surprise-prompt"
                            placeholder="Your response..."
                            autoComplete="off"
                            enterKeyHint="send"
                            maxLength={500}
                            required
                          />
                          <button
                            className="button journey-button"
                            type="submit"
                            disabled={!surpriseResponse.trim()}
                          >
                            <Send size={15} /> {surpriseSubmitLabel}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                  {experience.closingMessage.trim() && (
                    <div className="ending-message">
                      <StoryText
                        text={experience.closingMessage}
                        label="Closing dedication"
                      />
                    </div>
                  )}
                  <span className="journey-signature">
                    {copy.signOff} {experience.senderName || "your person"}
                  </span>
                  <button
                    className="text-button restart-story"
                    onClick={restart}
                  >
                    <RotateCcw size={13} /> {copy.replayButton}
                  </button>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="journey-footer">
          <span className="journey-dedication">
            <Heart size={12} strokeWidth={1.4} />{" "}
            {experience.senderName
              ? `${copy.senderPrefix} ${experience.senderName}`
              : copy.senderPrefix}
          </span>
          <div
            className="journey-progress"
            aria-label={`${stageNames[chapter]}, chapter ${chapters.indexOf(chapter) + 1} of ${chapters.length}`}
          >
            {chapters.map((item, index) => (
              <span
                key={item}
                className={
                  chapter === item
                    ? "current"
                    : index < chapters.indexOf(chapter)
                      ? "complete"
                      : ""
                }
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="journey-footer-right">
            {chapters.indexOf(chapter) > 1 && (
              <button
                className="icon-button"
                aria-label="Previous chapter"
                title="Previous chapter"
                onClick={goBack}
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <span>
              {preview
                ? "PRIVATE PREVIEW"
                : sample
                  ? "A SAMPLE LOVE STORY"
                  : "ONLY FOR YOU"}
            </span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
