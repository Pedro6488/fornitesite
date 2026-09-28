import Image from "next/image";

export function ItemPreview({ imageUrl, name, rarity, videoUrl }: { imageUrl: string | null; name: string; rarity: string; videoUrl: string | null }) {
  return <div className="detail-art item-art" data-rarity={rarity}>
    {videoUrl ? <video className="cosmo-preview" autoPlay muted loop playsInline preload="metadata" poster={imageUrl ?? undefined} aria-label={`Vista previa de ${name}`}><source src={videoUrl} type={videoUrl.includes("/webm-") ? "video/webm" : "video/mp4"} /></video> : imageUrl ? <Image src={imageUrl} alt={name} fill priority sizes="(max-width: 800px) 100vw, 50vw" /> : <span className="item-fallback">{name.slice(0, 1)}</span>}
  </div>;
}
