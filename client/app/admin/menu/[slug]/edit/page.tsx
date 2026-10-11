import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { fetchAdminMenuItem, fetchMenuSummary } from "@/admin/lib/menu/api";
import { MenuItemForm } from "@/admin/components/menu/MenuItemForm";
import QueryWrapper from "@/components/providers/query-wrapper";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { brand } = getConfig();
  const result = await fetchAdminMenuItem(slug);
  return {
    title: `Edit ${result.ok ? result.data.name : "dish"} | ${brand.name} Admin`,
  };
}

export default async function EditMenuItemPage({ params }: Props) {
  await requireTeam("menu:manage");
  const { slug } = await params;
  const config = getConfig();

  const [itemResult, summary] = await Promise.all([
    fetchAdminMenuItem(slug),
    fetchMenuSummary(),
  ]);
  if (
    !itemResult.ok &&
    (itemResult.status === 404 || itemResult.status === 400)
  )
    notFound();
  if (!itemResult.ok) throw new Error(itemResult.message);

  const item = itemResult.data;
  const categories = summary.ok ? summary.data.categories : [];

  return (
    <QueryWrapper>
      <MenuItemForm
        key={item.updatedAt}
        item={item}
        categories={categories}
        currency={config.menu.currency.primary.code}
        initialCategoryId={
          categories.find((c) => c.slug === item.category.slug)?.id
        }
        categoriesError={summary.ok ? undefined : summary.message}
      />
    </QueryWrapper>
  );
}
