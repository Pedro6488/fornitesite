import Image from "next/image";

export function RobuxArt({ className }: { className?: string }) {
  return <Image src="/games/robux.png" width={367} height={367} className={className} alt="" sizes="(max-width: 800px) 50vw, 33vw" />;
}
