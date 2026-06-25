import { getSessionAdmin } from "@/lib/auth/session";

export async function getCostAccess() {
  const admin = await getSessionAdmin();
  const raw = process.env.COST_PAGE_USERS || "";
  const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ok = !!admin && allow.length > 0 && allow.includes((admin.username || "").toLowerCase());
  return { ok, admin };
}
