import { SharedExperience } from "@/components/shared-experience";

export default async function SharedPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return <SharedExperience token={token} />;
}
