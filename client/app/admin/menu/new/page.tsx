import Link from "next/link";
import { ArrowLeft, ChefHat } from "lucide-react";
import { requireTeam } from "@/lib/auth/get-user";

export default async function NewMenuItemPage() {
  await requireTeam("menu:manage");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
      <Link
        href="/admin/menu"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Menu
      </Link>
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-20 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <ChefHat className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          New menu item
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The form to create a dish goes here.
        </p>
      </div>
    </div>
  );
}
