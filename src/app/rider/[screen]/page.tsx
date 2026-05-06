import { notFound } from "next/navigation";
import { ScreenTemplate } from "@/components/screen-template";
import { riderScreens } from "@/lib/portal-screens";

type Props = {
  params: Promise<{ screen: string }>;
};

export default async function RiderScreenPage({ params }: Props) {
  const { screen } = await params;
  const config = riderScreens[screen];

  if (!config) {
    notFound();
  }

  return (
    <ScreenTemplate
      title={config.title}
      description={config.description}
      stats={config.stats}
      items={config.items}
      actions={config.actions}
    />
  );
}