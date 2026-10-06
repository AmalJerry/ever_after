"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function StoryText({
  text,
  label,
}: Readonly<{ text: string; label: string }>) {
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const element = measure.current;
    if (!element) return;
    let canceled = false;
    let frame = 0;
    const segments = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      (entry) => entry.segment,
    );

    function paginate() {
      if (canceled || !element || element.clientHeight < 20) return;
      const nextPages: string[] = [];
      let start = 0;
      while (start < segments.length) {
        let minimum = 1;
        let maximum = segments.length - start;
        let count = 1;
        while (minimum <= maximum) {
          const midpoint = Math.floor((minimum + maximum) / 2);
          element.textContent = segments
            .slice(start, start + midpoint)
            .join("");
          if (
            element.scrollHeight <= element.clientHeight &&
            element.scrollWidth <= element.clientWidth
          ) {
            count = midpoint;
            minimum = midpoint + 1;
          } else maximum = midpoint - 1;
        }
        if (start + count < segments.length) {
          for (
            let boundary = count - 1;
            boundary > count * 0.65;
            boundary -= 1
          ) {
            if (/\s/u.test(segments[start + boundary])) {
              count = boundary + 1;
              break;
            }
          }
        }
        nextPages.push(segments.slice(start, start + count).join(""));
        start += count;
      }
      element.textContent = "";
      setPages(nextPages.length ? nextPages : [""]);
      setIndex((current) =>
        Math.min(current, Math.max(0, nextPages.length - 1)),
      );
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paginate);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    void document.fonts.ready.then(() => {
      if (!canceled) schedule();
    });
    return () => {
      canceled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text]);

  return (
    <div className="story-text" aria-label={label}>
      <div className="story-text-viewport">
        <div className="story-text-measure" ref={measure} aria-hidden="true" />
        <p className="story-text-content" aria-live="polite">
          {pages[index] || ""}
        </p>
      </div>
      <div className="story-text-pagination" aria-label={`${label} pagination`}>
        {pages.length > 1 && (
          <>
            <button
              className="icon-button"
              title="Previous page"
              aria-label={`Previous ${label.toLowerCase()} page`}
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {index + 1} / {pages.length}
            </span>
            <button
              className="icon-button"
              title="Next page"
              aria-label={`Next ${label.toLowerCase()} page`}
              disabled={index === pages.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
