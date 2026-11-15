// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

it("rechaza imágenes externas y redirecciones fuera del CDN permitido", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const params = new URLSearchParams({ character: "https://localhost/private.png", items: "https://cdn2.unrealengine.com/sk-Items.png" });
  expect((await GET(new Request(`https://example.com/api/catalog/bundle-image?${params}`))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("incluye el personaje y los accesorios en una imagen transparente", async () => {
  const character = await sharp({ create: { width: 100, height: 200, channels: 4, background: "red" } }).png().toBuffer();
  const items = await sharp({ create: { width: 500, height: 100, channels: 4, background: "blue" } }).png().toBuffer();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array(character))).mockResolvedValueOnce(new Response(new Uint8Array(items)));
  vi.stubGlobal("fetch", fetchMock);
  const params = new URLSearchParams({ character: "https://cdn2.unrealengine.com/sk-Character.png", items: "https://cdn2.unrealengine.com/sk-Items.png" });
  const response = await GET(new Request(`https://example.com/api/catalog/bundle-image?${params}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/webp");
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(1024);
  expect(info.height).toBe(1024);
  const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + info.channels)];
  expect(pixel(512, 400)[0]).toBeGreaterThan(200);
  expect(pixel(512, 900)[2]).toBeGreaterThan(200);
  expect(pixel(0, 0)[3]).toBe(0);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "error" });
});
