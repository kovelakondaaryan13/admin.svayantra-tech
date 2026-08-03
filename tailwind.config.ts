import type { Config } from "tailwindcss";

/**
 * STOS Design System v2 — token system, now THEME-AWARE (light + dark).
 * Colors resolve to CSS variables (RGB triplets) defined per theme in globals.css, so every
 * `bg-surface` / `text-fg` / `text-accent` etc. flips with the active theme. Palette is matched
 * to the Svayantra Tech logo: steel BLUE + cyan (TECH) + ORANGE arrow, near-black text on a
 * light canvas (light) / deep navy (dark). Components consume tokens, never raw hex.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        panel: v("panel"),
        elevated: v("elevated"),
        floating: v("floating"),
        border: v("border"),
        "border-strong": v("border-strong"),
        fg: v("fg"), // primary text/foreground
        muted: v("muted"),
        faint: v("faint"),
        overlay: v("overlay"), // subtle surface overlays (hover/cards) — theme-aware
        accent: v("accent"), // cyan (logo "TECH")
        blue: v("blue"), // steel blue (logo S/T)
        teal: v("teal"),
        action: v("action"), // orange (logo arrow)
        violet: v("violet"),
        indigo: v("indigo"),
        success: v("success"),
        warning: v("warning"),
        danger: v("danger"),
        info: v("info"),
      },
      borderRadius: { md: "10px", lg: "14px", xl: "20px", "2xl": "26px" },
      boxShadow: {
        e1: "0 1px 0 0 rgb(var(--sheen) / 0.5) inset, 0 8px 24px -18px rgb(var(--shadow) / 0.85)",
        e2: "0 1px 0 0 rgb(var(--sheen) / 0.6) inset, 0 18px 40px -24px rgb(var(--shadow) / 0.9)",
        e3: "0 1px 0 0 rgb(var(--sheen) / 0.7) inset, 0 30px 70px -30px rgb(var(--shadow) / 0.95)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.18), 0 10px 40px -12px rgb(var(--accent) / 0.35)",
        "glow-ai": "0 0 0 1px rgb(var(--violet) / 0.22), 0 12px 44px -12px rgb(var(--indigo) / 0.4)",
        card: "0 1px 0 0 rgb(var(--sheen) / 0.5) inset, 0 10px 30px -20px rgb(var(--shadow) / 0.8)",
      },
      backgroundImage: {
        // Signature brand gradient — logo-matched: steel blue → cyan.
        brand: "linear-gradient(135deg, rgb(var(--blue)) 0%, rgb(var(--accent)) 100%)",
        "brand-soft": "linear-gradient(135deg, rgb(var(--accent) / 0.16), rgb(var(--blue) / 0.16))",
        ai: "linear-gradient(135deg, rgb(var(--violet) / 0.20), rgb(var(--accent) / 0.16))",
        "stos-radial":
          "radial-gradient(1100px 620px at 12% -12%, rgb(var(--accent) / 0.12), transparent 55%), radial-gradient(1000px 560px at 108% -6%, rgb(var(--blue) / 0.12), transparent 52%), radial-gradient(900px 700px at 60% 118%, rgb(var(--teal) / 0.07), transparent 55%)",
      },
      transitionTimingFunction: { emphasized: "cubic-bezier(0.22, 1, 0.36, 1)" },
      transitionDuration: { fast: "120ms", base: "220ms" },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        "pulse-glow": { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 0.34s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
