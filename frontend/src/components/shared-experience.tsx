"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Heart, LockKeyhole, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ExperienceContent } from "@/lib/types";
import { ExperienceView } from "./experience-view";

export function SharedExperience({ token }: Readonly<{ token: string }>) {
  const [experience, setExperience] = useState<ExperienceContent | null>(null);
  const [error, setError] = useState<"unavailable" | "connection" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .shared(token, controller.signal)
      .then(setExperience)
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          failure instanceof ApiError && failure.status === 404
            ? "unavailable"
            : "connection",
        );
      });
    return () => controller.abort();
  }, [token, attempt]);

  if (experience) return <ExperienceView experience={experience} />;

  return (
    <main className="status-page">
      <Link className="wordmark" href="/">
        ever<span>,</span> after<span className="wordmark-dot">.</span>
      </Link>
      <div className="status-content">
        {error ? (
          <LockKeyhole size={35} strokeWidth={1.2} />
        ) : (
          <Heart size={35} strokeWidth={1.2} />
        )}
        <h1>
          {error === "unavailable"
            ? "A little story, out of reach."
            : error
              ? "Let's try that again."
              : "Something lovely is waiting."}
        </h1>
        <p>
          {error === "unavailable"
            ? "This private link has expired, was withdrawn, or isn't quite right. Ask the sender for a fresh one."
            : error
              ? "We couldn't load your birthday story. Check your connection and try again."
              : "Opening your birthday story..."}
        </p>
        {error === "unavailable" ? (
          <Link href="/" className="button button-primary">
            Visit Ever, after <ArrowRight size={16} />
          </Link>
        ) : error ? (
          <button
            className="button button-primary"
            onClick={() => {
              setError(null);
              setAttempt(attempt + 1);
            }}
          >
            <RotateCcw size={16} /> Try again
          </button>
        ) : (
          <div
            className="loading-line"
            aria-label="Loading birthday story"
            role="progressbar"
          />
        )}
      </div>
    </main>
  );
}
