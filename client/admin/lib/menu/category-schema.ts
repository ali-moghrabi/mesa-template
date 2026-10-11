import { z } from "zod";

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export const DAY_SHORT: Record<WeekDay, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const MAX_SERVING_WINDOWS = 7;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const RESERVED_SLUGS = new Set(["new", "edit", "categories", "promotions"]);

const servingWindowSchema = z
  .object({
    days: z.array(z.enum(WEEK_DAYS)),
    from: z.string().regex(TIME, "Pick a time"),
    to: z.string().regex(TIME, "Pick a time"),
  })
  .refine((w) => w.from !== w.to, {
    path: ["to"],
    message: "Must differ from the start",
  });

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name")
    .max(60, "60 characters at most"),
  slug: z
    .string()
    .trim()
    .max(80, "80 characters at most")
    .refine(
      (v) => v === "" || SLUG.test(v),
      'Lowercase letters, numbers and dashes, like "hot-drinks"',
    )
    .refine((v) => !RESERVED_SLUGS.has(v), "This one is reserved"),
  description: z.string().trim().max(300, "300 characters at most"),
  image: z.string().nullable(),
  isActive: z.boolean(),
  servingHours: z
    .array(servingWindowSchema)
    .max(MAX_SERVING_WINDOWS, `${MAX_SERVING_WINDOWS} at most`),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type ServingWindowValues = CategoryFormValues["servingHours"][number];

export const emptyCategory = (): CategoryFormValues => ({
  name: "",
  slug: "",
  description: "",
  image: null,
  isActive: true,
  servingHours: [],
});

export const SERVING_PRESETS: { label: string; window: ServingWindowValues }[] =
  [
    { label: "Breakfast", window: { days: [], from: "07:00", to: "11:30" } },
    { label: "Lunch", window: { days: [], from: "12:00", to: "15:30" } },
    { label: "Dinner", window: { days: [], from: "18:00", to: "23:00" } },
    {
      label: "Weekend brunch",
      window: { days: ["saturday", "sunday"], from: "10:00", to: "14:00" },
    },
  ];

export function toCategoryPayload(values: CategoryFormValues) {
  return {
    name: values.name,
    ...(values.slug && { slug: values.slug }),
    ...(values.description && { description: values.description }),
    ...(values.image && { image: values.image }),
    isActive: values.isActive,
    servingHours: values.servingHours.map((w) => ({
      ...w,
      days: WEEK_DAYS.filter((d) => w.days.includes(d)),
    })),
  };
}

export function daysLabel(days: readonly string[]): string {
  const picked = WEEK_DAYS.filter((d) => days.includes(d));
  if (picked.length === 0 || picked.length === 7) return "Every day";
  const indexes = picked.map((d) => WEEK_DAYS.indexOf(d));
  const consecutive = indexes.every(
    (value, i) => i === 0 || value === indexes[i - 1] + 1,
  );
  if (consecutive && picked.length >= 3)
    return `${DAY_SHORT[picked[0]]}–${DAY_SHORT[picked[picked.length - 1]]}`;
  return picked.map((d) => DAY_SHORT[d]).join(", ");
}

export const servingLabel = (w: {
  days: readonly string[];
  from: string;
  to: string;
}) => `${daysLabel(w.days)} · ${w.from}–${w.to}`;

export function previewCategorySlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return RESERVED_SLUGS.has(base) ? `${base}-menu` : base;
}
