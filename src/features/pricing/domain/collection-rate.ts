import { UNGROUPED_COLLABORATION } from "@/features/catalog/application/catalog-query";

export function priceCollection(item: { collaboration?: string | null }): string {
  return item.collaboration?.trim() || UNGROUPED_COLLABORATION;
}

/** Tarifa en MXN por cada 100 paVos; redondeo al peso superior. */
export function calculateCollectionPrice(vbucks: number, mxnPerHundred: number): number {
  if (!Number.isInteger(vbucks) || vbucks <= 0 || !Number.isFinite(mxnPerHundred) || mxnPerHundred <= 0) throw new Error("Tarifa inválida.");
  return Math.ceil(vbucks * Math.round(mxnPerHundred * 100) / 10000);
}
