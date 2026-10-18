import type { Metadata } from "next";
import "../globals.css";
import { currentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { unreadCount } from "@/lib/notifications";
import { noteExpiringCertificates } from "@/lib/certs";
import { keepCampaignsFresh } from "@/lib/campaigns";
import { lookFor, themeStyle } from "@/lib/brand";
import { latestCelebration } from "@/lib/celebrate";
import { CelebrationToast } from "@/components/CelebrationToast";
import { siteUrl } from "@/lib/share";

export async function generateMetadata(): Promise<Metadata> {
  const look = lookFor((await currentUser())?.id);
  const description = "Learn on your own, race your friends, or train a team or customers. Level exams, certificates anyone can verify, and a rival to beat: 20 levels from Novice to Titan.";
  return {
    metadataBase: new URL(await siteUrl()), // so preview images and links are absolute
    title: `${look.name} — Training academy`,
    description,
    openGraph: { siteName: look.name, type: "website", title: `${look.name}: learn, race, prove it`, description },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user) noteExpiringCertificates(user.id); // before the unread count, so a new notice shows on this page load
  const look = lookFor(user?.id);
  const celebration = user ? latestCelebration(user.id) : null; // the newest badge, level-up, promotion or podium they have not yet seen
  keepCampaignsFresh(); // weekly and monthly contests roll over by themselves, on whichever page someone opens first
  return (
    <html lang="en" style={themeStyle(look) as React.CSSProperties | undefined}>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader user={user} unread={user ? unreadCount(user.id) : 0} look={look} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter user={user} look={look} />
        {celebration && <CelebrationToast key={celebration.id} c={celebration} />}
      </body>
    </html>
  );
}
