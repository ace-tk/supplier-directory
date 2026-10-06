import { designStudioWorkflows } from "@/lib/design-studio-workflows";

export interface GarmentStudioCard {
  title: string;
  description: string;
  /** Served from public/garment-studio/. */
  image: string;
  /** Omitted = no route yet; rendered as a non-clickable card. */
  href?: string;
  /** Shows the "Voice" pill on the image. */
  voice?: boolean;
}

export interface GarmentStudioSection {
  title: string;
  cards: GarmentStudioCard[];
}

// Live routes come from designStudioWorkflows — the same entries the hero's
// pill tabs (StudioNav) use — so a card can never point somewhere the nav
// doesn't.
function workflowHref(id: string): string {
  const workflow = designStudioWorkflows.find((w) => w.id === id);
  if (!workflow) throw new Error(`Unknown Design Studio workflow: ${id}`);
  return workflow.href;
}

const img = (file: string) => `/garment-studio/${file}`;

/** AI Garment Studio home (/design-studio) — every section and card, in order. */
export const garmentStudioSections: GarmentStudioSection[] = [
  {
    title: "Studio",
    cards: [
      { title: "Repeat Print Maker", description: "Turn artwork into seamless, tileable repeat prints.", image: img("repeat-print.jpg"), href: workflowHref("repeat-print-maker") },
      { title: "Garment Studio", description: "Generate garments with AI and edit them region by region.", image: img("garment-studio.jpg"), href: workflowHref("ai-garment-studio") },
      { title: "Pattern Library", description: "Browse, reuse and apply your saved seamless patterns.", image: img("pattern-library.jpg"), href: workflowHref("pattern-library") },
      { title: "Print → Embroidery", description: "Convert artwork into an embroidery concept and preview it on a garment.", image: img("print-embroidery.jpg"), href: workflowHref("print-to-embroidery") },
      { title: "Embroidery Assets", description: "A home for embroidery-ready assets, with detailed categorization coming later.", image: img("embroidery-assets.jpg"), href: workflowHref("embroidery-assets") },
    ],
  },
  {
    title: "Design",
    cards: [
      // Not in designStudioWorkflows (same as Pattern to Garment): that list also drives the hero's pill nav.
      { title: "Hit Collection Proposal", description: "Extend a bestseller into cohesive style variations while preserving its core design language.", image: img("hit-collection.jpg"), href: "/design-studio/hit-collection-proposal" },
      // TODO: route
      { title: "Collection Proposal", description: "Build a cohesive collection proposal around a bestseller with aligned themes, categories and design language.", image: img("collection-proposal.jpg") },
      // TODO: route
      { title: "Detail to Design", description: "Turn a neckline, sleeve, pocket or other detail reference into multiple apparel concepts.", image: img("detail-to-design.jpg") },
      // TODO: route
      { title: "Fabric to Design", description: "Create apparel concepts that match the color, texture and drape of a fabric reference.", image: img("fabric-to-design.jpg") },
    ],
  },
  {
    title: "Model to Product",
    cards: [
      { title: "Back Design", description: "Upload the front style image and generate the corresponding back style in one click.", image: img("back-design.jpg"), href: workflowHref("garment-back-design") },
      // TODO: route
      { title: "Outfit Design", description: "One-click to generate matched garments from a single top or bottom for fast complete-set creation.", image: img("outfit-design.jpg") },
      // TODO: route
      { title: "Image to Design", description: "Create new style options from an existing garment image.", image: img("image-to-design.jpg") },
      // TODO: route
      { title: "Voice to Design", description: "Describe an idea out loud and turn your spoken brief into quick apparel concept images.", image: img("voice-to-design.jpg"), voice: true },
      // Not in designStudioWorkflows on purpose — that list also drives the
      // hero's pill nav (StudioNav), which this tool doesn't appear in.
      { title: "Pattern to Garment", description: "Transform garment pattern pieces into a complete stitched garment visualization while preserving the original pattern structure and design.", image: img("pattern-to-garment.svg"), href: "/design-studio/pattern-to-garment" },
    ],
  },
  {
    title: "Print",
    cards: [
      // TODO: route
      { title: "Graphic Extractor", description: "Detect and extract complete patterns from product or reference images.", image: img("graphic-extractor.jpg") },
      // TODO: route
      { title: "Graphic Colorways", description: "Create dedicated colorway options for any print or graphic.", image: img("graphic-colorways.jpg") },
      // TODO: route
      { title: "Graphic Techniques", description: "Apply embroidery and craft effects to print patterns quickly.", image: img("graphic-techniques.jpg") },
      // TODO: route
      { title: "Voice to Print Generator", description: "Speak a print idea and generate matching patterns from your voice description.", image: img("voice-to-print.jpg"), voice: true },
    ],
  },
  {
    title: "Photoshoot",
    cards: [
      // TODO: route
      { title: "Generate Views", description: "Adjust the model's angle and generate multiple views instantly.", image: img("generate-views.jpg") },
      // TODO: route
      { title: "Outfit Try-On", description: "Combine garments and accessories into a complete styled outfit image.", image: img("outfit-tryon.jpg") },
      // TODO: route
      { title: "Model Variations", description: "Generate a set of related campaign images from one hero image.", image: img("model-variations.jpg") },
      // TODO: route
      { title: "Change Background", description: "Swap the scene behind your model to create varied campaign images.", image: img("change-background.jpg") },
    ],
  },
  {
    title: "Visual Merchandising",
    cards: [
      // TODO: route
      { title: "Image to Video", description: "Turn static fashion images into short product display videos.", image: img("image-to-video.jpg") },
      // TODO: route
      { title: "Side-hanging Display", description: "Upload garment images to generate a standard single-rail side-hang display in one click.", image: img("side-hanging.jpg") },
      // TODO: route
      { title: "Rail Swap", description: "Batch-move all garments from one rail to the target display rail in one click.", image: img("rail-swap.jpg") },
      // TODO: route
      { title: "Rail Merge", description: "Upload garment images to add new items to an existing side-hang display rail in one click.", image: img("rail-merge.jpg") },
    ],
  },
  {
    title: "Image Toolbox",
    cards: [
      // TODO: route
      { title: "Photo Enhancer", description: "Improve sharpness and image quality while restoring blurry details.", image: img("photo-enhancer.jpg") },
      // TODO: route
      { title: "AI Print Repair", description: "Repair print defects and restore clean, accurate clothing patterns in one click.", image: img("print-repair.jpg") },
      // TODO: route
      { title: "AI Color Correction", description: "Fix color casts and restore accurate garment colors in one click.", image: img("color-correction.jpg") },
      // TODO: route
      { title: "Background Remover", description: "Detect the subject edge and create a clean transparent cutout.", image: img("bg-remover.jpg") },
      // TODO: route
      { title: "Image Upscaler", description: "Upscale images to 2K, 4K, or 8K while preserving detail and color.", image: img("upscaler.jpg") },
      // TODO: route
      { title: "Object Remover", description: "Remove unwanted objects, marks, or watermarks while keeping the image natural.", image: img("object-remover.jpg") },
      // TODO: route
      { title: "Inpainting", description: "All-in-one AI photo retouch, tweak whole or parts, boost details instantly.", image: img("inpainting.jpg") },
      // TODO: route
      { title: "Expand Image", description: "Extend image edges naturally to fit new formats and layouts.", image: img("expand-image.jpg") },
      // TODO: route
      { title: "Garment Retouching", description: "Refine garment texture and material details for cleaner product images.", image: img("garment-retouching.jpg") },
      // TODO: route
      { title: "Clothes Wrinkle Remover", description: "Remove clothing wrinkles instantly for flawless editorial looks.", image: img("wrinkle-remover.jpg") },
      // TODO: route
      { title: "Image Editor", description: "Adjust resolution, color, and overall image quality with precision.", image: img("image-editor.jpg") },
      // TODO: route
      { title: "Text Editor", description: "Fine-tune wording, sentences and text content to enhance the overall texture of writing.", image: img("text-editor.jpg") },
      // TODO: route
      { title: "AI Image Translator", description: "Detect text, translate it, and re-layout it on the original image while keeping its style.", image: img("image-translator.jpg") },
    ],
  },
];
