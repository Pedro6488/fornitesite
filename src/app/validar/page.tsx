import { notFound } from "next/navigation";
import { EligibilityForm } from "@/features/eligibility/components/eligibility-form";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";

export default async function ValidatePage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item: itemId } = await searchParams;
  if (!itemId) notFound();
  const item = await (await getCatalogService()).find(itemId);
  if (!item) notFound();

  return <section className="flow-shell"><GamePageHero slim word="VALIDAR" accent="#8b5cf6" eyebrow="Paso 1 de 3" title={<>Valida quién <span>recibirá el objeto</span></>} lead="Buscaremos una cuenta de entrega con amistad, paVos y cupo diario." /><div className="loot-page-body"><EligibilityForm itemId={item.mainId} requiredVbucks={item.finalPriceVbucks} /></div></section>;
}
