"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import type { CakeColor } from "@/lib/types";
import type { createLoveScene } from "@/lib/love-scene";

export function LoveScene({
  variant,
  cakeColor = "rose",
  candleCount = 3,
  extinguished = false,
  energy = 0,
  still = false,
  accentColor = "#F97BA3",
  fallback,
}: Readonly<{
  variant: "cake" | "heart";
  cakeColor?: CakeColor;
  candleCount?: number;
  extinguished?: boolean;
  energy?: number;
  still?: boolean;
  accentColor?: string;
  fallback: ReactNode;
}>) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createLoveScene> | null>(null);
  const latestState = useRef({ extinguished, energy });
  const [renderer, setRenderer] = useState("loading");
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    latestState.current = { extinguished, energy };
    scene.current?.update(latestState.current);
  }, [extinguished, energy]);

  useEffect(() => {
    let canceled = false;
    const element = host.current;
    if (!element) return;
    void import("@/lib/love-scene")
      .then(({ createLoveScene: create }) => {
        if (canceled) return;
        try {
          scene.current = create(element, {
            variant,
            cakeColor,
            candleCount,
            accentColor,
            reducedMotion: still || Boolean(reducedMotion),
            onContextLost: () => {
              if (!canceled) setRenderer("fallback");
            },
          });
          scene.current.update(latestState.current);
          setRenderer("webgl");
        } catch {
          setRenderer("fallback");
        }
      })
      .catch(() => {
        if (!canceled) setRenderer("fallback");
      });
    return () => {
      canceled = true;
      scene.current?.destroy();
      scene.current = null;
    };
  }, [variant, cakeColor, candleCount, reducedMotion, still, accentColor]);

  return (
    <div
      className="love-scene"
      data-renderer={renderer}
      data-variant={variant}
      data-extinguished={extinguished}
    >
      <div className="three-mount" ref={host} aria-hidden="true" />
      {renderer !== "webgl" && (
        <div className="scene-fallback" aria-hidden="true">
          {fallback}
        </div>
      )}
    </div>
  );
}
