import type { Metadata } from "next";
import { CreatorStudio } from "@/components/creator-studio";

export const metadata: Metadata = { title: "Your Story Studio | Ever, after." };

export default function StudioPage() {
  return <CreatorStudio />;
}
