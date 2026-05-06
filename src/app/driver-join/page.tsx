import { ScreenTemplate } from "@/components/screen-template";

export default function DriverJoinPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ScreenTemplate
        title="Drive with RAJLO"
        description="Let's go! Join as a verified red plate driver on RAJLO and access shared-seat demand across Jamaica parishes."
        items={[
          { title: "Step 1", meta: "Create driver account", status: "info" },
          { title: "Step 2", meta: "Upload required TA documents", status: "info" },
          { title: "Step 3", meta: "Verification review and activation", status: "good" },
        ]}
        actions={[
          { label: "Driver Sign Up", href: "/auth/driver/signup" },
          { label: "Driver Login", href: "/auth/driver/login" },
        ]}
      />
    </main>
  );
}