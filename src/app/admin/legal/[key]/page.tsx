import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { AdminLegalEditor } from "@/components/admin-legal-editor";
import { getEffectiveLegalDocument } from "@/lib/legal-store";

/**
 * /admin/legal/[key] — OTP-gated editor for a single policy.
 *
 * Server component: loads the EFFECTIVE document (the admin-published
 * copy or the baseline) and hands it to the client editor, which
 * drives the request-OTP → enter-code → publish flow.
 */

export const dynamic = "force-dynamic";

export default async function AdminLegalEditorPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const doc = await getEffectiveLegalDocument(key);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-2 py-2 md:px-3 md:py-8">
      <Link
        href="/admin/legal"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rajlo-red hover:underline"
      >
        <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
        All policies
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">
        Edit: {doc.title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Saving sends a 6-digit code to your admin email. The change goes
        live only after you enter that code.
      </p>

      <div className="mt-6">
        <AdminLegalEditor
          docKey={doc.key}
          initial={{
            title: doc.title,
            version: doc.version,
            effectiveDate: doc.effectiveDate,
            summary: doc.summary,
            body: doc.body,
          }}
          source={doc.source}
        />
      </div>
    </div>
  );
}
