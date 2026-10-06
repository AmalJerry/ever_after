export type ThemeName = "garden" | "rose" | "midnight";
export type CakeColor = "rose" | "vanilla" | "sage";

export interface JourneyCopy {
  brandName: string;
  wishEyebrow: string;
  wishHeading: string;
  wishButton: string;
  wishSuccess: string;
  wishSent: string;
  celebrationEyebrow: string;
  celebrationHeading: string;
  celebrationMessage: string;
  celebrationButton: string;
  celebrationNote: string;
  heartEyebrow: string;
  heartHeading: string;
  heartMessage: string;
  heartButton: string;
  heartNote: string;
  memoryEyebrow: string;
  memoryFallbackTitle: string;
  memoryContinue: string;
  letterEyebrow: string;
  letterHeading: string;
  letterButton: string;
  letterNote: string;
  letterSignOff: string;
  finaleEyebrow: string;
  finaleHeading: string;
  finaleButton: string;
  surpriseHeading: string;
  surpriseButton: string;
  signOff: string;
  replayButton: string;
  senderPrefix: string;
}

export interface JourneyMedia {
  url: string;
  stillUrl: string;
  alt: string;
}

export interface PresentationSettings {
  accentColor: string;
  animationsEnabled: boolean;
  showBirthday: boolean;
  showCover: boolean;
  musicEnabled: boolean;
  musicAutoplay: boolean;
  musicVolume: number;
  chapters: {
    celebration: boolean;
    heart: boolean;
    memories: boolean;
    letter: boolean;
  };
  chapterOrder: Array<"celebration" | "heart" | "memories" | "letter">;
  copy: JourneyCopy;
  celebrationMedia: JourneyMedia;
  finaleMedia: JourneyMedia;
}

export interface Memory {
  id: string;
  title: string;
  caption: string;
  date: string;
  kind: "image" | "video";
  url: string;
  stillUrl?: string;
}

export interface ExperienceContent {
  recipientName: string;
  senderName: string;
  birthday: string;
  subtitle: string;
  heroImage: string;
  theme: ThemeName;
  memories: Memory[];
  letterTitle: string;
  letterBody: string;
  closingMessage: string;
  cakeColor: CakeColor;
  candleCount: 1 | 3 | 5;
  microphoneSensitivity: number;
  audioUrl: string;
  surprise: { enabled: boolean; question: string; answer: string };
  presentation?: PresentationSettings;
}

export interface ExperienceRecord {
  id: string;
  draft: ExperienceContent;
  publishedAt: string | null;
  shareToken: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface Creator {
  id: number;
  username: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  stillUrl: string;
  kind: "image" | "video" | "audio";
  name: string;
}
