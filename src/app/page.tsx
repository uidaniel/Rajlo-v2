import { LandingV2 } from "@/components/landing-v2";
import { getLandingCtaTargets } from "@/lib/landing-cta-targets";

/**
 * Public landing — server component just resolves the CTA targets
 * (signed-in vs visitor) and hands off to the client landing, which
 * owns all the GSAP animation choreography.
 */
export default async function Home() {
  const cta = await getLandingCtaTargets();
  return <LandingV2 cta={cta} />;
}
