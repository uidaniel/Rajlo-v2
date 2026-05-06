import { UtilityPage } from "@/components/utility-page";

export default function NotFoundPage() {
  return (
    <UtilityPage
      code="404"
      title="Looks like a wrong turn."
      body="We couldn't find the page you're looking for. Let's get you back on the road."
      primaryAction={{ label: "Back home", href: "/" }}
      secondaryAction={{ label: "Book a ride", href: "/auth/rider/signup" }}
    />
  );
}
