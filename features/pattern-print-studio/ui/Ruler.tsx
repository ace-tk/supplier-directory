"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "../engine/Editor";
import { toUnits, UNITS_PER_INCH, type DisplayUnit } from "../engine/units";

export const RULER_SIZE = 22;

// Nice major steps (in display units) and how many minor ticks each gets.
const STEPS: Record<DisplayUnit, { step: number; minor: number }[]> = {
  in: [
    { step: 1 / 16, minor: 1 },
    { step: 1 / 8, minor: 2 },
    { step: 1 / 4, minor: 4 },
    { step: 1 / 2, minor: 8 },
    { step: 1, minor: 16 },
    { step: 2, minor: 8 },
    { step: 4, minor: 4 },
    { step: 8, minor: 8 },
    { step: 16, minor: 4 },
    { step: 32, minor: 4 },
    { step: 64, minor: 4 },
    { step: 128, minor: 4 },
    { step: 256, minor: 4 },
  ],
  cm: [
    { step: 0.1, minor: 1 },
    { step: 0.5, minor: 5 },
    { step: 1, minor: 10 },
    { step: 2, minor: 4 },
    { step: 5, minor: 5 },
    { step: 10, minor: 10 },
    { step: 20, minor: 4 },
    { step: 50, minor: 5 },
    { step: 100, minor: 10 },
    { step: 200, minor: 4 },
    { step: 500, minor: 5 },
  ],
  mm: [
    { step: 1, minor: 1 },
    { step: 5, minor: 5 },
    { step: 10, minor: 10 },
    { step: 20, minor: 4 },
    { step: 50, minor: 5 },
    { step: 100, minor: 10 },
    { step: 200, minor: 4 },
    { step: 500, minor: 5 },
    { step: 1000, minor: 10 },
    { step: 2000, minor: 4 },
    { step: 5000, minor: 5 },
  ],
};

const MIN_LABEL_PX = 56;

function fmtLabel(v: number) {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

/**
 * A ruler drawn imperatively on its own small canvas (not React-rendered
 * per frame), redrawn on every view change. Labels are in the current
 * display units, relative to the ruler origin; the vertical ruler counts UP.
 */
export function Ruler({ editor, orientation, unit }: { editor: Editor; orientation: "h" | "v"; unit: DisplayUnit }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const host = canvas.parentElement;
      if (!host) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = orientation === "h" ? host.clientWidth : RULER_SIZE;
      const cssH = orientation === "h" ? RULER_SIZE : host.clientHeight;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const styles = getComputedStyle(canvas);
      const bg = styles.getPropertyValue("--pps-ruler-bg").trim() || "#f4f5f7";
      const fg = styles.getPropertyValue("--pps-ruler-fg").trim() || "#4b5563";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      const { origin } = editor.getState();
      const view = editor.getViewInfo();
      const pxPerUnit = view.ppi / UNITS_PER_INCH[unit];
      const len = orientation === "h" ? cssW : cssH;
      // Display value at screen px `s`: horizontal → x - origin.x; vertical → origin.y - y (up).
      const startProj = orientation === "h" ? view.left : view.top;
      const valueAt = (s: number) => {
        const proj = startProj + s / view.ppi;
        return orientation === "h" ? toUnits(proj - origin.x, unit) : toUnits(origin.y - proj, unit);
      };
      const screenOf = (v: number) => {
        const inches = v / UNITS_PER_INCH[unit];
        const proj = orientation === "h" ? origin.x + inches : origin.y - inches;
        return (proj - startProj) * view.ppi;
      };

      const choice = STEPS[unit].find((s) => s.step * pxPerUnit >= MIN_LABEL_PX) ?? STEPS[unit][STEPS[unit].length - 1];
      let minor = choice.minor;
      while (minor > 1 && (choice.step / minor) * pxPerUnit < 4) minor /= 2;
      const minorStep = choice.step / Math.max(1, Math.round(minor));

      const v0 = valueAt(0);
      const v1 = valueAt(len);
      const lo = Math.min(v0, v1);
      const hi = Math.max(v0, v1);

      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 1;
      ctx.font = "10px ui-sans-serif, system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "top";
      ctx.beginPath();
      const first = Math.floor(lo / minorStep);
      const last = Math.ceil(hi / minorStep);
      const perMajor = Math.round(choice.step / minorStep);
      for (let i = first; i <= last; i++) {
        const v = i * minorStep;
        const s = Math.round(screenOf(v)) + 0.5;
        const isMajor = i % perMajor === 0;
        const isHalf = !isMajor && perMajor % 2 === 0 && i % (perMajor / 2) === 0;
        const tick = isMajor ? RULER_SIZE : isHalf ? RULER_SIZE * 0.45 : RULER_SIZE * 0.25;
        if (orientation === "h") {
          ctx.moveTo(s, RULER_SIZE);
          ctx.lineTo(s, RULER_SIZE - tick);
        } else {
          ctx.moveTo(RULER_SIZE, s);
          ctx.lineTo(RULER_SIZE - tick, s);
        }
        if (isMajor) {
          const label = fmtLabel(v);
          if (orientation === "h") ctx.fillText(label, s + 3, 2);
          else {
            ctx.save();
            ctx.translate(2, s + 3);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(label, 0, -10);
            ctx.restore();
          }
        }
      }
      ctx.stroke();
      // Edge line toward the canvas
      ctx.beginPath();
      if (orientation === "h") {
        ctx.moveTo(0, RULER_SIZE - 0.5);
        ctx.lineTo(cssW, RULER_SIZE - 0.5);
      } else {
        ctx.moveTo(RULER_SIZE - 0.5, 0);
        ctx.lineTo(RULER_SIZE - 0.5, cssH);
      }
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Cursor position marker
      const cur = editor.getState().cursor;
      if (cur) {
        const s = Math.round(((orientation === "h" ? cur.x : cur.y) - startProj) * view.ppi) + 0.5;
        ctx.strokeStyle = "#dc2626";
        ctx.beginPath();
        if (orientation === "h") {
          ctx.moveTo(s, 0);
          ctx.lineTo(s, RULER_SIZE);
        } else {
          ctx.moveTo(0, s);
          ctx.lineTo(RULER_SIZE, s);
        }
        ctx.stroke();
      }
    };
    draw();
    const offView = editor.onView(draw);
    const offState = editor.subscribe(draw);
    const ro = new ResizeObserver(draw);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      offView();
      offState();
      ro.disconnect();
    };
  }, [editor, orientation, unit]);

  return (
    <canvas
      ref={ref}
      className="block cursor-crosshair touch-none select-none"
      title={orientation === "h" ? "Drag down to create a horizontal guideline" : "Drag right to create a vertical guideline"}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        editor.beginGuideFromRuler(orientation, e.nativeEvent);
      }}
    />
  );
}
