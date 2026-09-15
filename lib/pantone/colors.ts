// Curated PANTONE® FHI/TCX (textile) reference dataset — NOT the Pantone
// library. This app does not scrape pantone.com and does not embed the
// proprietary Pantone color system. Every entry below is a widely and
// repeatedly published Pantone Fashion Color of the Year selection (Pantone's
// own annual press announcements), so the code/name pairing is verifiable
// from public record — codes and names are never invented here.
//
// `hex` is this app's own digital approximation for on-screen display only,
// not a certified physical match — every UI surface using these values must
// keep making that distinction explicit (see PantoneShadePicker and the
// production specification output).
//
// This is a seed set, not a claim of completeness. Swap or extend this file
// (or replace it with a call into a licensed/official Pantone API) without
// touching any component — nothing outside lib/pantone/ should import this
// array directly.
import type { PantoneColor } from "./types";

export const PANTONE_COLORS: PantoneColor[] = [
  { code: "13-1023", name: "Peach Fuzz", hex: "#FFBE98", family: "Orange", system: "FHI", suffix: "TCX" },
  { code: "18-1750", name: "Viva Magenta", hex: "#BB2649", family: "Pink", system: "FHI", suffix: "TCX" },
  { code: "17-3938", name: "Very Peri", hex: "#6667AB", family: "Blue", system: "FHI", suffix: "TCX" },
  { code: "17-5104", name: "Ultimate Gray", hex: "#939597", family: "Gray", system: "FHI", suffix: "TCX" },
  { code: "13-0647", name: "Illuminating", hex: "#F5DF4D", family: "Yellow", system: "FHI", suffix: "TCX" },
  { code: "19-4052", name: "Classic Blue", hex: "#0F4C81", family: "Blue", system: "FHI", suffix: "TCX" },
  { code: "16-1546", name: "Living Coral", hex: "#FF6F61", family: "Orange", system: "FHI", suffix: "TCX" },
  { code: "18-3838", name: "Ultra Violet", hex: "#5F4B8B", family: "Purple", system: "FHI", suffix: "TCX" },
  { code: "15-0343", name: "Greenery", hex: "#88B04B", family: "Green", system: "FHI", suffix: "TCX" },
  { code: "13-1520", name: "Rose Quartz", hex: "#F7CAC9", family: "Pink", system: "FHI", suffix: "TCX" },
  { code: "15-3919", name: "Serenity", hex: "#92A8D1", family: "Blue", system: "FHI", suffix: "TCX" },
  { code: "18-1438", name: "Marsala", hex: "#955251", family: "Red", system: "FHI", suffix: "TCX" },
  { code: "18-3224", name: "Radiant Orchid", hex: "#B565A7", family: "Purple", system: "FHI", suffix: "TCX" },
  { code: "17-5641", name: "Emerald", hex: "#009B77", family: "Green", system: "FHI", suffix: "TCX" },
  { code: "17-1463", name: "Tangerine Tango", hex: "#DD4124", family: "Orange", system: "FHI", suffix: "TCX" },
  { code: "18-2120", name: "Honeysuckle", hex: "#D65076", family: "Pink", system: "FHI", suffix: "TCX" },
  { code: "15-5519", name: "Turquoise", hex: "#45B5AA", family: "Blue", system: "FHI", suffix: "TCX" },
];
