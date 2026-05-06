import { ScreenTemplate } from "@/components/screen-template";
import { parishes } from "@/lib/mock-data";

export default function FareEstimatorPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ScreenTemplate
        title="Fare Estimator"
        description="Preview parish-based fare logic before requesting a ride."
        stats={[
          { label: "Origin", value: "Kingston" },
          { label: "Destination", value: "St. Andrew" },
          { label: "Estimated Total", value: "JMD 525" },
        ]}
        items={parishes.slice(0, 6).map((parish) => ({
          title: `${parish} Sample Route`,
          meta: `Typical fare range JMD ${300 + parish.length * 20} - ${600 + parish.length * 30}`,
          status: "info",
        }))}
      />
    </main>
  );
}