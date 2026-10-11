import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";
import { adminFetch } from "@/admin/lib/menu/api";
import type { AdminGalleryPhoto } from "@/admin/lib/gallery-actions";
import { GalleryManager } from "@/admin/components/gallery/GalleryManager";
import QueryWrapper from "@/components/providers/query-wrapper";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return { title: `Gallery | ${brand.name} Admin` };
}

export default async function GalleryPage() {
  await requireTeam("content:manage");
  const result = await adminFetch<AdminGalleryPhoto[]>("/admin/gallery");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
      {result.ok ? (
        <QueryWrapper>
          <GalleryManager photos={result.data} />
        </QueryWrapper>
      ) : (
        <>
          <h1 className="pt-6 pb-6 text-[28px] leading-tight font-semibold tracking-tight sm:text-3xl lg:pt-10">
            Gallery
          </h1>
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">The gallery didn&apos;t load</p>
              <p className="mt-0.5 text-sm">{result.message}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
