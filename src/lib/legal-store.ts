import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { getSupabaseServerClient } from "./supabase-server";
import {
  LEGAL_DOCUMENTS,
  getLegalDocument,
  type LegalAudience,
} from "./legal-documents";

/** SHA-256 of a policy body — the fingerprint stored alongside each
 *  acceptance so RAJLO can prove the exact wording a user agreed to. */
export function legalContentHash(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * Resolves the EFFECTIVE (currently-published) version of each policy.
 *
 * Two sources, in priority order:
 *   1. The `legal_documents` DB table — an admin's published edit.
 *   2. The committed `policies/*.txt` baseline + the code catalog
 *      metadata — used for any policy that has never been edited.
 *
 * So a freshly-deployed platform serves the .txt baseline; the moment
 * an admin publishes an edit (OTP-confirmed), that policy switches to
 * its DB row. The structural facts (key, audience) always come from
 * the code catalog and can't be changed from the admin panel.
 */

export type EffectiveLegalDocument = {
  key: string;
  title: string;
  version: string;
  /** ISO date string, e.g. "2026-05-17". */
  effectiveDate: string;
  summary: string;
  audience: LegalAudience;
  body: string;
  /** SHA-256 of `body` — pins the exact accepted wording. */
  contentHash: string;
  /** "db" = an admin-published edit; "baseline" = the committed .txt. */
  source: "db" | "baseline";
  updatedAt: string | null;
  updatedByEmail: string | null;
};

type LegalDocumentRow = {
  key: string;
  title: string;
  version: string;
  effective_date: string;
  summary: string;
  body: string;
  updated_at: string;
  updated_by_email: string | null;
};

/**
 * Reads the committed baseline body for a key from `policies/<key>.txt`,
 * stripped of the leading title line, the "Effective Date:" line, and
 * the trailing "RAJLO —" tagline — leaving a clean editable body that
 * matches the shape stored in the `legal_documents.body` column.
 */
function readBaselineBody(key: string, title: string): string {
  const safeKey = key.replace(/[^a-z0-9-]/gi, "");
  try {
    const raw = readFileSync(
      join(process.cwd(), "policies", `${safeKey}.txt`),
      "utf8",
    );
    return raw
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim();
        if (t === title) return false;
        if (/^effective date:/i.test(t)) return false;
        if (/^RAJLO\s+[—-]/.test(t)) return false;
        return true;
      })
      .join("\n")
      .trim();
  } catch {
    return "";
  }
}

/** Build a baseline (never-edited) effective document from the catalog. */
function baselineDocument(key: string): EffectiveLegalDocument | null {
  const cat = getLegalDocument(key);
  if (!cat) return null;
  const body = readBaselineBody(cat.key, cat.title);
  return {
    key: cat.key,
    title: cat.title,
    version: cat.version,
    effectiveDate: cat.effectiveDate,
    summary: cat.summary,
    audience: cat.audience,
    body,
    contentHash: legalContentHash(body),
    source: "baseline",
    updatedAt: null,
    updatedByEmail: null,
  };
}

/** Merge a DB row over the catalog (audience always from the catalog). */
function fromRow(row: LegalDocumentRow): EffectiveLegalDocument | null {
  const cat = getLegalDocument(row.key);
  if (!cat) return null;
  return {
    key: cat.key,
    title: row.title,
    version: row.version,
    effectiveDate: row.effective_date,
    summary: row.summary,
    audience: cat.audience,
    body: row.body,
    contentHash: legalContentHash(row.body),
    source: "db",
    updatedAt: row.updated_at,
    updatedByEmail: row.updated_by_email,
  };
}

/** The single effective document for one key, or null if the key isn't
 *  in the catalog. */
export async function getEffectiveLegalDocument(
  key: string,
): Promise<EffectiveLegalDocument | null> {
  if (!getLegalDocument(key)) return null;
  const supabase = getSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase
      .from("legal_documents")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (data) {
      const merged = fromRow(data as LegalDocumentRow);
      if (merged) return merged;
    }
  }
  return baselineDocument(key);
}

/** Every effective document, in catalog order. */
export async function getAllEffectiveLegalDocuments(): Promise<
  EffectiveLegalDocument[]
> {
  const supabase = getSupabaseServerClient();
  const byKey = new Map<string, LegalDocumentRow>();
  if (supabase) {
    const { data } = await supabase.from("legal_documents").select("*");
    for (const row of (data ?? []) as LegalDocumentRow[]) {
      byKey.set(row.key, row);
    }
  }
  const result: EffectiveLegalDocument[] = [];
  for (const cat of LEGAL_DOCUMENTS) {
    const row = byKey.get(cat.key);
    const doc = row ? fromRow(row) : baselineDocument(cat.key);
    if (doc) result.push(doc);
  }
  return result;
}
