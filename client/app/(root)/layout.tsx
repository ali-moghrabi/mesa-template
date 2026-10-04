import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getConfig } from "@/config/loader";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { layout } = getConfig();

  return (
    <div>
      <Navbar />
      <main>{children}</main>
      <Footer footer={layout.footer} />
    </div>
  );
}
