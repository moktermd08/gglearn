import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { unreadCount } from "@/lib/notifications";
import { keepCampaignsFresh } from "@/lib/campaigns";
import { lookFor, themeStyle } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const look = lookFor((await currentUser())?.id);
  return {
    title: `${look.name} — Training academy`,
    description: "Role-based training for your team and customers: a learning path for every role, level exams, certificates and career progression.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const look = lookFor(user?.id);
  keepCampaignsFresh(); // weekly and monthly contests roll over by themselves, on whichever page someone opens first
  return (
    <html lang="en" style={themeStyle(look) as React.CSSProperties | undefined}>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader user={user} unread={user ? unreadCount(user.id) : 0} look={look} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter user={user} look={look} />
      </body>
    </html>
  );
}
