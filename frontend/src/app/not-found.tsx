import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";

export default function NotFound() {
  return (
    <main className="status-page">
      <Link className="wordmark" href="/">
        ever<span>,</span> after<span className="wordmark-dot">.</span>
      </Link>
      <div className="status-content">
        <Heart size={35} strokeWidth={1.2} />
        <h1>A little off the beaten path.</h1>
        <p>There isn&apos;t a story at this address.</p>
        <Link className="button button-primary" href="/">
          <ArrowLeft size={16} /> Back to the celebration
        </Link>
      </div>
    </main>
  );
}
