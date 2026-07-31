// Catalog imagery for the Shop page.
//
// We tried LoremFlickr (real photos, keyword-matched) to get genuine fashion
// photography. Two dealbreakers surfaced during manual review of ~60
// candidates: (1) keyword matching is loose enough that it occasionally
// returned off-topic or inappropriate content (a lingerie ad, a suggestive
// pin-up shot, branded storefronts, CGI avatars), and (2) worse, the same
// "locked" URL was independently reconfirmed to serve three different
// images across three requests minutes apart — so even a manually-vetted
// URL isn't stable over time. That's disqualifying for production.
//
// Picsum is used instead: it's a curated, always-safe Unsplash-derived
// dataset, and — verified — the same seed deterministically returns the
// same photo every time. Content is professional stock photography but not
// category-targeted (Picsum has no keyword/category control).

function fallbackUrl(seedKey: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seedKey)}/${width}/${height}`;
}

export function fashionImageUrl(
  category: string,
  seedKey: string,
  width: number,
  height: number
): string {
  return fallbackUrl(`${category}-${seedKey}`, width, height);
}

export function fashionImageSet(
  category: string,
  seedKey: string,
  count: number,
  width: number,
  height: number
): string[] {
  return Array.from({ length: count }, (_, i) =>
    fallbackUrl(`${category}-${seedKey}-${i}`, width, height)
  );
}
