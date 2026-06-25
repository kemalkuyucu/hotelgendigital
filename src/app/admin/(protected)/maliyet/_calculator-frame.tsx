"use client";
import { CALCULATOR_HTML } from "./calculator-html";

export default function CalculatorFrame() {
  return (
    <iframe
      srcDoc={CALCULATOR_HTML}
      title="Maliyet Hesaplayıcı"
      style={{ width: "100%", height: "calc(100vh - 150px)", border: "1px solid #E2DDD2", borderRadius: 12, background: "#F7F5F0" }}
    />
  );
}
