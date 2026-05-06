import { ScreenTemplate } from "@/components/screen-template";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ScreenTemplate
        title="How RAJLO Works"
        description="Riders request by seat count, verified red plate drivers accept, and parish-based pricing is calculated transparently before confirmation."
        items={[
          { title: "Request", meta: "Pickup, dropoff, and seats selected", status: "info" },
          { title: "Match", meta: "Nearest verified driver receives request", status: "good" },
          { title: "Ride", meta: "Live tracking and safety tools", status: "good" },
          { title: "Complete", meta: "Fare receipt and ratings", status: "info" },
        ]}
      />
    </main>
  );
}