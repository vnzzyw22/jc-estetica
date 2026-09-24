import { ImageResponse } from "next/og";

export const alt = "Jennifer Camila — Estética facial e corporal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Tipográfica de propósito: não há foto profissional ainda. Trocar por foto real quando existir.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#efe9e3",
          color: "#241a18",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 26, color: "#5a4a44" }}>Estética facial e corporal</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 168, lineHeight: 0.9, letterSpacing: -6, fontWeight: 300 }}>
          <span>Jennifer</span>
          <span style={{ marginLeft: 220 }}>Camila</span>
        </div>
      </div>
    ),
    size,
  );
}
