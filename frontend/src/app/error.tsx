"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main className="status-page">
      <div className="status-content">
        <h1>A small pause in the celebration.</h1>
        <p>
          Something didn&apos;t load as expected. Let&apos;s give it another
          try.
        </p>
        <button className="button button-primary" onClick={reset}>
          <RotateCcw size={16} /> Try again
        </button>
      </div>
    </main>
  );
}
