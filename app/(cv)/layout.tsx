import type { Metadata } from "next";
import "../globals.css";

/**
 * A CV link is a document, not part of the site: no header, no footer, no sign-in prompts. Its own root layout, like the admin and the map.
 * No referrer is sent, so an address in someone's CV cannot learn the address of the CV that linked to it.
 */
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

export default function CvLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f1f5f9] px-3 py-6 antialiased sm:py-10 print:bg-[#fff] print:p-0">
        <style>{`@media print { @page { size: A4; margin: 14mm; } }`}</style>
        {children}
      </body>
    </html>
  );
}
