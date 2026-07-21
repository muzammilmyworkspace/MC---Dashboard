import confetti from "canvas-confetti";

export function celebrate() {
  const colors = ["#8b5cf6", "#a78bfa", "#6366f1", "#10b981", "#ffffff"];
  const end = Date.now() + 700;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({
    particleCount: 90,
    spread: 90,
    startVelocity: 42,
    origin: { y: 0.6 },
    colors,
  });
}
