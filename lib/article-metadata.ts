// Best-effort Open Graph / <title>/<meta> scraper for Articles — no
// third-party scraping service, just a direct fetch + light regex parse
// (no cheerio/jsdom dependency in this project). Always resolves to a
// partial-or-empty result rather than throwing, so a failed/blocked fetch
// never prevents the caller from saving the URL manually.

import type { ArticleMetadata } from "@/types/article";

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 500_000;

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

function extractMeta(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, "i");
  const altRe = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, "i");
  const match = html.match(re) ?? html.match(altRe);
  return match ? decodeHtmlEntities(match[1]).trim() || null : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function resolveUrl(base: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

/** Never throws — a fetch/parse failure just yields an all-null result. */
export async function fetchArticleMetadata(rawUrl: string): Promise<ArticleMetadata> {
  const empty: ArticleMetadata = { title: null, description: null, thumbnailUrl: null, sourceDomain: null };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return empty;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return empty;
  if (isPrivateHostname(url.hostname)) return empty;

  const sourceDomain = url.hostname.replace(/^www\./, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SupplyBaseArticleBot/1.0)" },
    });
    if (!res.ok || !res.body) return { ...empty, sourceDomain };

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { ...empty, sourceDomain };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});

    const title = extractMeta(html, "property", "og:title") ?? extractMeta(html, "name", "twitter:title") ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decodeHtmlEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]).trim() : null);
    const description = extractMeta(html, "property", "og:description") ?? extractMeta(html, "name", "description");
    const ogImage = extractMeta(html, "property", "og:image") ?? extractMeta(html, "name", "twitter:image");
    const thumbnailUrl = ogImage ? resolveUrl(url.toString(), ogImage) : null;

    return { title: title || null, description: description || null, thumbnailUrl, sourceDomain };
  } catch {
    return { ...empty, sourceDomain };
  } finally {
    clearTimeout(timeout);
  }
}
