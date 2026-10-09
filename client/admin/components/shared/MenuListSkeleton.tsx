import { MENU_PAGE_SIZE } from "@/admin/lib/menu/params";

const bar = "rounded-md bg-foreground/[0.07] animate-pulse";

export function MenuListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dishes">
      <div className="mb-3 flex justify-between px-1">
        <div className={`${bar} h-4 w-24`} />
        <div className={`${bar} h-3.5 w-16`} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden h-10 border-b border-border bg-muted/50 lg:block" />
        <ul className="divide-y divide-border">
          {Array.from({ length: MENU_PAGE_SIZE }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-3.5 p-3.5 sm:p-4 lg:px-5 lg:py-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className={`${bar} size-16 shrink-0 rounded-xl sm:size-18 lg:size-12`}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className={`${bar} h-4`}
                  style={{ width: `${45 + ((i * 17) % 35)}%` }}
                />
                <div className={`${bar} h-3 w-3/5 lg:w-2/5`} />
                <div className={`${bar} h-5 w-20 rounded-full lg:hidden`} />
              </div>
              <div className={`${bar} hidden h-6 w-20 lg:block`} />
              <div className={`${bar} h-4 w-14`} />
              <div className={`${bar} hidden h-6 w-24 rounded-full lg:block`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
