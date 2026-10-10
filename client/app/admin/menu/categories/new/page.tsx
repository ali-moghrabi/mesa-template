import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { fetchAdminCategories } from "@/admin/lib/menu/api";
import { CategoryForm } from "@/admin/components/menu/CategoryForm";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `New category | ${brand.name} Admin` };
}

type Props = { searchParams: Promise<{ name?: string | string[] }> };

export default async function NewCategoryPage({ searchParams }: Props) {
  await requireTeam("menu:manage");
  const [existing, { name }] = await Promise.all([
    fetchAdminCategories(),
    searchParams,
  ]);
  const initialName =
    (Array.isArray(name) ? name[0] : name)?.slice(0, 60) ?? "";

  const position = (existing.ok ? existing.data.length : 0) + 1;

  return (
    <QueryWrapper>
      <CategoryForm initialName={initialName} position={position} />
    </QueryWrapper>
  );
}
