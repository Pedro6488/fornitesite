import fs from "node:fs";

const shop = JSON.parse(fs.readFileSync("fn-shop.json", "utf8"));

function meta(layout, kind, key) {
  return (layout?.[kind] ?? []).find((item) => item.key === key)?.value ?? null;
}

const ids = new Map();
for (const entry of shop.data.entries) {
  const pieces = [
    ...(entry.brItems ?? []).map((item) => ({ id: item.id, name: item.name, type: item.type?.displayValue })),
    ...(entry.tracks ?? []).map((item) => ({ id: item.id, name: item.title, type: "track" })),
    ...(entry.cars ?? []).map((item) => ({ id: item.id, name: item.name, type: item.type?.displayValue })),
    ...(entry.instruments ?? []).map((item) => ({ id: item.id, name: item.name, type: item.type?.displayValue ?? "instrument" }))
  ];
  for (const piece of pieces) {
    const list = ids.get(piece.id) ?? [];
    list.push({
      name: piece.name,
      type: piece.type,
      price: entry.finalPrice,
      pieces: pieces.length,
      bundle: entry.bundle?.name ?? meta(entry.layout, "textMetadata", "title"),
      subtitle: meta(entry.layout, "textMetadata", "subtitle"),
      inDate: entry.inDate
    });
    ids.set(piece.id, list);
  }
}

const today = "2026-11-15";
const interesting = [...ids.entries()].filter(([, offers]) => offers.some((offer) => offer.inDate?.startsWith(today)));
for (const [id, offers] of interesting) {
  const solo = offers.find((offer) => offer.pieces === 1);
  console.log(`\n${offers[0].name} [${offers[0].type}] ${id}`);
  for (const offer of offers) {
    console.log(`  $${offer.price} pieces=${offer.pieces} ${offer.subtitle ?? offer.bundle ?? "item"} ${solo ? "" : ""}`);
  }
  if (!solo) console.log("  ** no solo offer **");
}
