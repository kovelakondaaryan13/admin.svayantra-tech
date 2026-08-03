import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STOS — Svayantra Technology Operating System",
  description: "Your AI Chief of Staff. Tell STOS what you want; it plans, executes, and runs the business.",
};

// Set the theme class before paint to avoid a flash. Dark is default (:root); light adds `.light`.
const themeScript = `(function(){try{var t=localStorage.getItem('stos-theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
