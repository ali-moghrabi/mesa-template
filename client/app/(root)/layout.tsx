import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getConfig } from "@/config/loader";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { layout, features } = getConfig();

  return (
    <div>
      <Navbar />
      <main>{children}</main>
      <Footer
        footer={layout.footer}
        newsletter={features.newsletter}
        cookieSettings={features.cookieBanner}
      />
    </div>
  );
}
