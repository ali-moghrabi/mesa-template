import { DM_Sans } from "next/font/google";
import { getConfig } from "@/config/loader";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { generateThemeCss } from "@/config/generate-css";
import { Consent } from "@/components/consent/Consent";
import { Toaster } from "@/components/ui/toast";
import { rootMetadata, rootViewport } from "@/config/seo";
import { StructuredData } from "@/components/seo/StructuredData";
import { DemoPromo } from "@/components/onboarding/DemoPromo";
import { SIGNED_IN_HINT_COOKIE } from "@/constants/constants";
import "./globals.css";

const font = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const generateMetadata = rootMetadata;
export const generateViewport = rootViewport;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { theme } = getConfig();

  return (
    <html
      lang="en"
      className={`${font.variable} h-full antialiased bg-black`}
      suppressHydrationWarning
    >
      <head>
        <style href="mesa-theme" precedence="default">
          {generateThemeCss(theme)}
        </style>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.cookie.indexOf("${SIGNED_IN_HINT_COOKIE}=")>-1&&document.documentElement.setAttribute("data-signed-in","")`,
          }}
        />
      </head>
      <body>
        <DemoPromo />
        <StructuredData />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="mesa-admin-theme"
          disableTransitionOnChange
        >
          <Consent />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
