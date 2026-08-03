/**
 * Svayantra Tech brand lockup — the real logo (public/brand/svayantra-logo.png), hardcoded.
 * The logo has dark wordmark text designed for light backgrounds, so in DARK mode it sits on a
 * light tile (`.logo-tile`) for contrast; in light mode it renders plain on the canvas.
 */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg"; byline?: boolean }) {
  const h = size === "lg" ? "h-16" : size === "sm" ? "h-6" : "h-9";
  return (
    <span className="logo-tile inline-flex items-center justify-center rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/svayantra-logo.png" alt="Svayantra Tech — STOS" className={`${h} w-auto object-contain`} />
    </span>
  );
}
