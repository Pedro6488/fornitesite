import Image from "next/image";
import robuxImage from "../../../public/games/robux.png";

export function RobuxArt({ className }: { className?: string }) {
  return <Image src={robuxImage} className={className} alt="" sizes="(max-width: 800px) 50vw, 33vw" />;
}
