import { UtilityPage } from "@/components/utility-page";

export default function ErrorPage() {
  return (
    <UtilityPage
      title="Something went wrong."
      body="An unexpected error stopped your trip. Please try again — and if it keeps happening, our support team is here to help."
      primaryAction={{ label: "Try again", href: "/" }}
      secondaryAction={{ label: "Contact support", href: "/legal/safety" }}
      tone="muted"
    />
  );
}
