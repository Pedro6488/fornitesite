import type { CSSProperties } from "react";

const pieces = Array.from({ length: 28 }, (_, index) => ({
  color: ["#ffd51f", "#55d9ff", "#39d88f", "#ffffff", "#ff5b83"][index % 5],
  delay: `${(index % 7) * 0.09}s`,
  drift: `${((index * 37) % 90) - 45}px`,
  left: `${3 + ((index * 29) % 94)}%`,
  rotate: `${(index * 47) % 180}deg`,
}));

export function PurchaseConfetti() {
  return <div className="purchase-confetti" aria-hidden="true">
    {pieces.map((piece, index) => <i key={index} style={{
      "--confetti-color": piece.color,
      "--confetti-delay": piece.delay,
      "--confetti-drift": piece.drift,
      "--confetti-left": piece.left,
      "--confetti-rotate": piece.rotate,
    } as CSSProperties} />)}
  </div>;
}
