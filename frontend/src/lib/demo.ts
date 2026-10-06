import type { ExperienceContent } from "./types";
import { defaultPresentation } from "./presentation";

export const demoExperience: ExperienceContent = {
  recipientName: "Sophie",
  senderName: "Alex",
  birthday: "2026-09-21",
  subtitle: "Another trip around the sun. A million more reasons to love you.",
  heroImage: "/images/celebration.jpg",
  theme: "rose",
  presentation: defaultPresentation(),
  memories: [
    {
      id: "the-beginning",
      title: "Where it all began",
      caption:
        "One coffee turned into four hours. I missed my train, and somehow found my favorite person.",
      date: "2022-04-16",
      kind: "image",
      url: "/images/flowers.jpg",
    },
    {
      id: "our-little-escape",
      title: "Our little escape",
      caption:
        "No itinerary. Terrible directions. The best gelato. I'd get lost with you a thousand times over.",
      date: "2023-06-08",
      kind: "image",
      url: "/images/coast.jpg",
    },
    {
      id: "on-top-of-the-world",
      title: "On top of the world",
      caption:
        "You said the view would be worth it. As usual, you were right. But you were still my favorite part.",
      date: "2025-08-23",
      kind: "image",
      url: "/images/mountains.jpg",
    },
  ],
  letterTitle: "My favorite person,",
  letterBody:
    "Somehow, the ordinary days with you are the ones I want to remember forever. The kitchen dancing. The long way home. The way you always save me the last bite.\n\nYou make this life feel bigger and softer all at once. And watching you become more yourself, year after year, is my favorite thing.\n\nSo here's to your next chapter. To the places we haven't been, the stories we haven't told, and all the beautifully ordinary mornings still ahead.\n\nHappy birthday, my love. I'd choose you in every lifetime.",
  closingMessage: "",
  cakeColor: "rose",
  candleCount: 3,
  microphoneSensitivity: 0.06,
  audioUrl: "",
  surprise: {
    enabled: true,
    question: "One more thing... remember where we had our first coffee?",
    answer:
      "We're going back. Just you, me, and a table by the window. Saturday, 10 am. It's a date.",
  },
};

export function emptyExperience(): ExperienceContent {
  return {
    recipientName: "",
    senderName: "",
    birthday: new Date().toISOString().slice(0, 10),
    subtitle: "",
    heroImage: "/images/celebration.jpg",
    theme: "rose",
    presentation: defaultPresentation(),
    memories: [],
    letterTitle: "",
    letterBody: "",
    closingMessage: "",
    cakeColor: "rose",
    candleCount: 3,
    microphoneSensitivity: 0.06,
    audioUrl: "",
    surprise: { enabled: false, question: "", answer: "" },
  };
}

export function formatDate(value: string, includeYear = true): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "A day to remember";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}
