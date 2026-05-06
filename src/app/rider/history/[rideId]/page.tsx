import { ScreenTemplate } from "@/components/screen-template";

export default function RiderHistoryDetailPage({
  params,
}: {
  params: Promise<{ rideId: string }>;
}) {
  return (
    <ScreenTemplate
      title={`Ride Details - #${(params as any).rideId}`}
      description="Full trip receipt, driver details, route summary, and rebook availability."
      stats={[
        { label: "Date", value: "21 March 2026" },
        { label: "Duration", value: "23 mins" },
        { label: "Total", value: "JMD 1,340" },
      ]}
      items={[
        { title: "Driver", meta: "Andre Thompson • 4.8 stars", status: "good" },
        { title: "Vehicle", meta: "Toyota Probox 5812 GK", status: "info" },
        { title: "Route", meta: "Kingston to Portmore via South Coastal", status: "info" },
      ]}
    />
  );
}
