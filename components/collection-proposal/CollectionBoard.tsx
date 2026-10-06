"use client";

import type { Ref } from "react";
import type { CollectionLook } from "@/lib/collection-proposal";

// The collection board: the look images with their labels, and the Core DNA
// strip. Every word here is real HTML, so it stays spelled correctly and can
// be exported as one PNG. Styles are inline and use plain colours so the
// export (html2canvas) renders the same as the screen.

const INK = "#18181b";
const MUTED = "#71717a";
const RULE = "#e4e4e7";
const PANEL = "#f4f4f5";

export function CollectionBoard({ looks, coreDNA, lookImages, boardRef }: { looks: CollectionLook[]; coreDNA: string[]; lookImages: string[]; boardRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={boardRef} data-collection-board style={{ background: "#ffffff", color: INK, padding: 32, fontFamily: "Inter, system-ui, sans-serif", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${looks.length > 4 ? 150 : 200}px, 1fr))`, gap: 16 }}>
        {looks.map((look, i) => (
          <div key={i} data-look>
            <div style={{ aspectRatio: "2 / 3", overflow: "hidden", borderRadius: 8, background: PANEL }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated look (a data URL) */}
              <img src={lookImages[i]} alt={`Look ${i + 1}: ${look.title}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>LOOK {i + 1}</p>
            <p style={{ margin: "2px 0 6px", fontSize: 13, fontWeight: 600 }}>{look.title}</p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5, color: MUTED }}>
              {look.details.map((d, j) => (
                <li key={j}>{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>
        <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em" }}>CORE DNA</p>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, coreDNA.length)}, minmax(0, 1fr))`, background: PANEL, borderRadius: 12, overflow: "hidden" }}>
          {coreDNA.map((k, i) => (
            <div key={i} style={{ padding: "14px 10px", textAlign: "center", fontSize: 13, fontWeight: 600, borderLeft: i ? `1px solid ${RULE}` : undefined }}>
              {k}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
