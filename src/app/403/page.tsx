import { UtilityPage } from "@/components/utility-page";

export default function Unauthorized() {
  return (
    <UtilityPage
      code="403"
      title="That stop's off-route."
      body="You don't have access to this part of Rajlo. If you believe this is a mistake, please contact support."
      primaryAction={{ label: "Back home", href: "/" }}
      secondaryAction={{ label: "Sign in", href: "/auth/rider/login" }}
      tone="black"
    />
  );
}
