import sharp from "sharp";

export const runtime = "nodejs";

function assetUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn2.unrealengine.com"
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && /^\/sk-[a-zA-Z0-9_-]+\.png$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const character = assetUrl(params.get("character"));
  const items = assetUrl(params.get("items"));
  if (!character || !items) return new Response("Invalid bundle assets", { status: 400 });

  try {
    const layers = await Promise.all([character, items].map(async (url, index) => {
      const response = await fetch(url, { next: { revalidate: 86400 }, redirect: "error", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Bundle asset returned ${response.status}`);
      const input = Buffer.from(await response.arrayBuffer());
      const { data, info } = await sharp(input, { limitInputPixels: 16000000 }).trim()
        .resize(index === 0 ? 940 : 960, index === 0 ? 800 : 190, { fit: "inside" })
        .png().toBuffer({ resolveWithObject: true });
      return { input: data, left: Math.floor((1024 - info.width) / 2), top: index === 0 ? 800 - info.height : 820 };
    }));
    const output = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(layers).webp({ quality: 90 }).toBuffer();
    return new Response(new Uint8Array(output), { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, s-maxage=604800"
    } });
  } catch (error) {
    console.error("catalog.bundle-image.failed", error);
    return new Response("Bundle image unavailable", { status: 502 });
  }
}
