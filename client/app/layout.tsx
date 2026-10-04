import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { getConfig } from "@/config/loader";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { generateThemeCss } from "@/config/generate-css";
import "./globals.css";

const font = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export function generateMetadata(): Metadata {
  const { brand, seo } = getConfig();
  return {
    title: `${brand.name}`,
    description: seo.defaultDescription,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { theme } = getConfig();

  return (
    <html
      lang="en"
      className={`${font.variable} h-full antialiased bg-black`}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: generateThemeCss(theme) }} />
      </head>
      <body>
        {" "}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
