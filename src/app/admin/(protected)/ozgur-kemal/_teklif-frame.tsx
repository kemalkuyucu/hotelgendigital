"use client";
import { TEKLIF_TAKIP_HTML } from "./teklif-takip-html";

export default function TeklifFrame() {
  return (
    <iframe
      srcDoc={TEKLIF_TAKIP_HTML}
      title="Teklif & Takip"
      style={{ width: "100%", height: "calc(100vh - 150px)", border: "1px solid #E2DDD2", borderRadius: 12, background: "#F7F5F0" }}
    />
  );
}
