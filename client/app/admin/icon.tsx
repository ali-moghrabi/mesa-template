import { brandIcon } from "@/lib/brand-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function AdminIcon() {
  return brandIcon(64, "admin");
}
