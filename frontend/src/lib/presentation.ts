import type { CSSProperties } from "react";
import type {
  ExperienceContent,
  JourneyCopy,
  JourneyMedia,
  PresentationSettings,
  ThemeName,
} from "./types";

export const defaultCopy: JourneyCopy = {
  brandName: "ever, after.",
  wishEyebrow: "A LITTLE BIRTHDAY MAGIC",
  wishHeading: "Happy birthday,",
  wishButton: "Blow Candles",
  wishSuccess: "A wish, sent to the universe.",
  wishSent: "Something lovely is on its way.",
  celebrationEyebrow: "YOUR WISH IS ON ITS WAY",
  celebrationHeading: "All this love.\nJust for you.",
  celebrationMessage: "The world is a little sweeter with you in it.",
  celebrationButton: "There's more in my heart",
  celebrationNote: "and it has your name all over it.",
  heartEyebrow: "OF ALL THE THINGS IN THIS UNIVERSE",
  heartHeading: "My favorite thing\nis us.",
  heartMessage: "A few little moments. A whole lot of forever.",
  heartButton: "Open my heart",
  heartNote: "a little universe, made of you and me.",
  memoryEyebrow: "A MOMENT I'D KEEP FOREVER",
  memoryFallbackTitle: "A little piece of us.",
  memoryContinue: "A letter for you",
  letterEyebrow: "THE WORDS I ALWAYS MEAN",
  letterHeading: "Some things are\nbetter in a letter.",
  letterButton: "Open your letter",
  letterNote: "a little piece of my heart.",
  letterSignOff: "Always,",
  finaleEyebrow: "IN THIS LIFETIME. AND EVERY OTHER.",
  finaleHeading: "I'd still\nchoose you.",
  finaleButton: "One more little thing",
  surpriseHeading: "One more little thing.",
  surpriseButton: "Send",
  signOff: "All my love,",
  replayButton: "One more wish",
  senderPrefix: "WITH LOVE,",
};

export const animationOptions: ReadonlyArray<{
  name: string;
  media: JourneyMedia;
}> = [
  {
    name: "Flowers for you",
    media: {
      url: "/animations/flowers-for-you.gif",
      stillUrl: "/animations/flowers-for-you-still.webp",
      alt: "A bear giving a bouquet of red roses to their delighted partner",
    },
  },
  {
    name: "Forever hug",
    media: {
      url: "/animations/forever-hug.gif",
      stillUrl: "/animations/forever-hug-still.webp",
      alt: "Two bears sharing a loving hug beneath four red hearts",
    },
  },
];

export const themeOptions: ReadonlyArray<{
  id: ThemeName;
  name: string;
  accent: string;
  colors: string[];
}> = [
  {
    id: "rose",
    name: "A little rose",
    accent: "#F97BA3",
    colors: ["#F97BA3", "#ffe3ee", "#c3a16a"],
  },
  {
    id: "garden",
    name: "Secret garden",
    accent: "#82B69A",
    colors: ["#315e46", "#c2cba7", "#e7c7c3"],
  },
  {
    id: "midnight",
    name: "After the stars",
    accent: "#A3B5DC",
    colors: ["#414c6c", "#b3c0ce", "#d8c997"],
  },
];

export function defaultPresentation(): PresentationSettings {
  return {
    accentColor: "#F97BA3",
    animationsEnabled: true,
    showBirthday: false,
    showCover: false,
    musicEnabled: true,
    musicAutoplay: true,
    musicVolume: 0.8,
    chapters: { celebration: true, heart: true, memories: true, letter: true },
    chapterOrder: ["celebration", "heart", "memories", "letter"],
    copy: { ...defaultCopy },
    celebrationMedia: { ...animationOptions[0].media },
    finaleMedia: { ...animationOptions[1].media },
  };
}

export function getPresentation(
  experience: ExperienceContent,
): PresentationSettings {
  const defaults = defaultPresentation();
  const stored = experience.presentation;
  return {
    ...defaults,
    ...stored,
    chapters: { ...defaults.chapters, ...stored?.chapters },
    copy: { ...defaults.copy, ...stored?.copy },
    celebrationMedia: {
      ...defaults.celebrationMedia,
      ...stored?.celebrationMedia,
    },
    finaleMedia: { ...defaults.finaleMedia, ...stored?.finaleMedia },
  };
}

export function normalizeExperience(
  experience: ExperienceContent,
): ExperienceContent {
  return { ...experience, presentation: getPresentation(experience) };
}

export type Chapter =
  | "wish"
  | "celebrate"
  | "heart"
  | "memories"
  | "letter"
  | "ending";

export function getChapters(experience: ExperienceContent): Chapter[] {
  const presentation = getPresentation(experience);
  const settings = presentation.chapters;
  return [
    "wish",
    ...presentation.chapterOrder
      .filter(
        (chapter) =>
          settings[chapter] &&
          (chapter !== "memories" || experience.memories.length > 0),
      )
      .map(
        (chapter): Chapter =>
          chapter === "celebration" ? "celebrate" : chapter,
      ),
    "ending",
  ];
}

export function presentationStyle(
  presentation: PresentationSettings,
): CSSProperties {
  return { "--pink": presentation.accentColor } as CSSProperties;
}

export const copyGroups: ReadonlyArray<{
  name: string;
  fields: ReadonlyArray<readonly [keyof JourneyCopy, string]>;
}> = [
  {
    name: "Candle opening",
    fields: [
      ["brandName", "Brand name"],
      ["wishEyebrow", "Opening eyebrow"],
      ["wishHeading", "Birthday heading"],
      ["wishButton", "Candle button"],
      ["wishSuccess", "Wish confirmation"],
      ["wishSent", "Wish follow-up"],
    ],
  },
  {
    name: "Celebration",
    fields: [
      ["celebrationEyebrow", "Celebration eyebrow"],
      ["celebrationHeading", "Celebration heading"],
      ["celebrationMessage", "Celebration message"],
      ["celebrationButton", "Celebration button"],
      ["celebrationNote", "Celebration note"],
    ],
  },
  {
    name: "Heart and memories",
    fields: [
      ["heartEyebrow", "Heart eyebrow"],
      ["heartHeading", "Heart heading"],
      ["heartMessage", "Heart message"],
      ["heartButton", "Heart button"],
      ["heartNote", "Heart note"],
      ["memoryEyebrow", "Memories eyebrow"],
      ["memoryFallbackTitle", "Untitled memory heading"],
      ["memoryContinue", "Memories continue button"],
    ],
  },
  {
    name: "Letter and final page",
    fields: [
      ["letterEyebrow", "Letter eyebrow"],
      ["letterHeading", "Envelope heading"],
      ["letterButton", "Open letter button"],
      ["letterNote", "Envelope note"],
      ["letterSignOff", "Letter sign-off"],
      ["finaleEyebrow", "Final page eyebrow"],
      ["finaleHeading", "Final page heading"],
      ["finaleButton", "Final page button"],
      ["surpriseHeading", "Surprise heading"],
      ["surpriseButton", "Response submit button"],
      ["signOff", "Final sign-off"],
      ["replayButton", "Replay button"],
      ["senderPrefix", "Footer signature prefix"],
    ],
  },
];

export function copyLimit(key: keyof JourneyCopy) {
  if (key.endsWith("Button")) return 40;
  return key.endsWith("Message") || key.endsWith("Note") ? 200 : 100;
}
