import { UtilityPage } from "@/components/utility-page";

export default function Maintenance() {
  return (
    <UtilityPage
      title="Rajlo's pulled over for a tune-up."
      body="We'll be back on the road shortly. Thanks for your patience."
      primaryAction={{ label: "Try again", href: "/" }}
      tone="black"
    />
  );
}
