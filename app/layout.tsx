import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <title>SanatanStream - Premium Devotional Player</title>
        <meta name="description" content="A professional and elegant devotional video player with custom controls" />
      </head>
      <body className="antialiased bg-[#0b0f19] text-[#f3f4f6]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
