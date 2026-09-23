import { notFound } from "next/navigation";
import { EligibilityForm } from "@/features/eligibility/components/eligibility-form";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

export default async function ValidatePage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item: itemId } = await searchParams;
  if (!itemId) notFound();
  const item = await (await getCatalogService()).find(itemId);
  if (!item) notFound();

  return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">PASO 1 DE 3</p><h1>Valida quién recibirá el objeto.</h1><p>Buscaremos una cuenta de entrega con amistad, paVos y cupo diario.</p></div><EligibilityForm itemId={item.mainId} requiredVbucks={item.finalPriceVbucks} /></section>;
}
