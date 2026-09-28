import { unstable_cache } from "next/cache";

export type CosmoPreview = Readonly<{ cosmoId: string; videoUrl: string }>;

const FORTNITE_HOST = "https://www.fortnite.com";
const COSMO_HOST = "https://cosmo.fdeb.live.use1a.on.epicgames.com";

function normalizeHtml(html: string): string {
  return html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

function extractCosmoPreview(html: string): CosmoPreview | null {
  const normalized = normalizeHtml(html);
  const matches = [...normalized.matchAll(/https:\/\/cosmo\.fdeb\.live\.use1a\.on\.epicgames\.com\/v1\/item\/([^/?"\\]+)\/(webm-md|mp4-md)/gi)];
  const preferred = matches.find((match) => match[2].toLowerCase() === "webm-md") ?? matches[0];
  return preferred ? { cosmoId: preferred[1], videoUrl: preferred[0] } : null;
}

function isFortnitePublicUrl(value: string): boolean {
  try {
    const url = new URL(value, FORTNITE_HOST);
    return url.origin === FORTNITE_HOST && url.pathname.startsWith("/item-shop/");
  } catch { return false; }
}

const fortniteHeaders = {
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (compatible; SigfriedLootBox/1.0)"
};

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().toLocaleLowerCase("es-MX");
}

async function findOfficialUrlByName(name: string): Promise<string | null> {
  const response = await fetch(`${FORTNITE_HOST}/item-shop`, { headers: fortniteHeaders, next: { revalidate: 60 * 60 } });
  if (!response.ok) return null;
  const target = name.trim().toLocaleLowerCase("es-MX");
  const anchors = response.text().then((html) => [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,2500}?)<\/a>/gi)]);
  for (const anchor of await anchors) {
    const href = anchor[1];
    if (href.startsWith("/item-shop/") && plainText(anchor[2]).includes(target)) return new URL(href, FORTNITE_HOST).toString();
  }
  return null;
}

const getCachedCosmoPreview = unstable_cache(async (officialUrl: string | null, name: string): Promise<CosmoPreview | null> => {
  const resolvedUrl = officialUrl && isFortnitePublicUrl(officialUrl) ? officialUrl : await findOfficialUrlByName(name);
  if (!resolvedUrl) return null;
  const response = await fetch(new URL(resolvedUrl, FORTNITE_HOST), { headers: fortniteHeaders, next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) return null;
  return extractCosmoPreview(await response.text());
}, ["fortnite-cosmo-preview"], { revalidate: 60 * 60 * 24 });

/** Obtiene y cachea una vista oficial únicamente desde la página de detalle. */
export async function getFortniteCosmoPreview(officialUrl: string | null | undefined, name: string): Promise<CosmoPreview | null> {
  return getCachedCosmoPreview(officialUrl ?? null, name);
}

/** Útil para construir URLs Cosmo únicamente cuando ya fueron extraídas del HTML oficial. */
export function isOfficialCosmoUrl(url: string): boolean {
  return url.startsWith(`${COSMO_HOST}/v1/item/`);
}
