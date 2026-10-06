import { ExperienceView } from "@/components/experience-view";
import { demoExperience } from "@/lib/demo";

export default function Home() {
  return <ExperienceView experience={demoExperience} sample />;
}
