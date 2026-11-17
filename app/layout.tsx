import type { Metadata, Viewport } from "next";
import "./globals.css";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "PantryAI",
  description: "Personal food assistant: budget, pantry, meal plan, and shopping.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PantryAI",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F7F5F0",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="en" data-user-id={user?.id ?? ""}>
      <body className="flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  );
}
