import type { Metadata } from "next";
import { ThreeDsReturn } from "./ThreeDsReturn";

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false },
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

export default async function ThreeDsDonePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { order } = await searchParams;
  const id = typeof order === "string" && OBJECT_ID.test(order) ? order : null;
  return <ThreeDsReturn orderId={id} />;
}
