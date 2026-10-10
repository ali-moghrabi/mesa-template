import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { fetchMenuSummary } from "@/admin/lib/menu/api";
import { MenuItemForm } from "@/admin/components/menu/MenuItemForm";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `New menu item | ${brand.name} Admin` };
}

type Props = { searchParams: Promise<{ category?: string | string[] }> };

export default async function NewMenuItemPage({ searchParams }: Props) {
  await requireTeam("menu:manage");
  const config = getConfig();
  const [summary, { category }] = await Promise.all([
    fetchMenuSummary(),
    searchParams,
  ]);
  const categories = summary.ok ? summary.data.categories : [];
  const slug = Array.isArray(category) ? category[0] : category;

  return (
    <QueryWrapper>
      <MenuItemForm
        categories={categories}
        currency={config.menu.currency.primary.code}
        initialCategoryId={categories.find((c) => c.slug === slug)?.id}
        categoriesError={summary.ok ? undefined : summary.message}
      />
    </QueryWrapper>
  );
}
