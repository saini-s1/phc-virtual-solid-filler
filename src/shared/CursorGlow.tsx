// A soft blue hue that trails the pointer across the whole suite. It doesn't
// snap to the cursor — instead it eases toward it each frame (a lerp), so the
// glow lags slightly and feels smooth rather than twitchy. Coordinates never
// go through React state (that would re-render on every mousemove); we drive
// the transform directly inside one requestAnimationFrame loop.
import { useEffect, useRef } from "react";

// How much of the remaining distance the glow closes each frame (0..1).
// Lower = more lag / lazier trail. Higher = tighter follow. 0.12 feels calm.
const FOLLOW_EASE = 0.12;

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Respect users who ask for reduced motion — no chasing glow for them.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const el = glowRef.current;
    if (!el) return;

    // Where the pointer actually is vs. where the glow currently sits.
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let frame = 0;
    let visible = false;

    const tick = () => {
      // Ease the glow a fraction of the way toward the pointer each frame.
      currentX += (targetX - currentX) * FOLLOW_EASE;
      currentY += (targetY - currentY) * FOLLOW_EASE;

      // translate3d keeps the move on the GPU compositor (no layout/paint).
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;

      const dx = targetX - currentX;
      const dy = targetY - currentY;
      // Keep animating until we've essentially caught up, then idle.
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        visible = true;
        el.style.opacity = "1";
      }
      // Restart the easing loop if it had gone idle.
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      visible = false;
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 -z-10 h-[520px] w-[520px] rounded-full opacity-0 mix-blend-multiply transition-opacity duration-500 ease-out will-change-transform"
      style={{
        background:
          "radial-gradient(circle, rgba(38,73,234,0.18) 0%, rgba(6,182,212,0.12) 32%, rgba(38,73,234,0) 70%)",
      }}
    />
  );
}
