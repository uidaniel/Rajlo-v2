import { notFound } from "next/navigation";
import { ScreenTemplate } from "@/components/screen-template";
import { driverScreens } from "@/lib/portal-screens";

type Props = {
  params: Promise<{ screen: string }>;
};

export default async function DriverScreenPage({ params }: Props) {
  const { screen } = await params;
  const config = driverScreens[screen];

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