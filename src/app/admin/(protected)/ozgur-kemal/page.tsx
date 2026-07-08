import { redirect } from "next/navigation";
import { getCostAccess } from "@/lib/auth/cost-access";
import TeklifFrame from "./_teklif-frame";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { ok } = await getCostAccess();
  if (!ok) redirect("/admin");
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: "#fff" }}>Ozgur&Kemal</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px" }}>Yalnizca yetkili yoneticiler · teklif simulasyonu & aktif otel takip</p>
      <TeklifFrame />
    </div>
  );
}
