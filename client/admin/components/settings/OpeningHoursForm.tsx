"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useController,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  CircleAlert,
  Clock,
  Copy,
  Globe,
  Info,
  LoaderCircle,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  addDays,
  DAYS,
  dayName,
  dayShort,
  fromMinutes,
  getOpenStatus,
  groupWeekly,
  hoursIssues,
  MAX_LABEL,
  MAX_SHIFTS,
  MAX_SPECIAL_DAYS,
  restaurantClock,
  shiftSpan,
  shiftsLabel,
  sortShifts,
  TIME_PATTERN,
  toMinutes,
  type OpeningHours,
  type Shift,
} from "@/lib/opening-hours";
import {
  saveOpeningHours,
  type AdminOpeningHours,
} from "@/admin/lib/settings-actions";
import {
  Section,
  Switch,
  TimeInput,
  inputClass,
} from "@/admin/components/menu/FormParts";

const shift = z.object({ open: z.string(), close: z.string() });
const schema = z
  .object({
    timezone: z.string(),
    weekly: z
      .array(
        z.object({ day: z.enum(DAYS), shifts: z.array(shift).max(MAX_SHIFTS) }),
      )
      .length(7),
    exceptions: z
      .array(
        z.object({
          date: z.string(),
          label: z.string().max(MAX_LABEL),
          shifts: z.array(shift).max(MAX_SHIFTS),
        }),
      )
      .max(MAX_SPECIAL_DAYS),
  })
  .superRefine((values, ctx) => {
    for (const [path, message] of Object.entries(hoursIssues(values)))
      ctx.addIssue({
        code: "custom",
        path: path.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
        message,
      });
  });

type Values = OpeningHours;
type Issues = Record<string, string>;

function nextShift(shifts: Shift[]): Shift {
  const last = sortShifts(
    shifts.filter(
      (s) => TIME_PATTERN.test(s.open) && TIME_PATTERN.test(s.close),
    ),
  ).at(-1);
  if (!last) return { open: "12:00", close: "22:00" };
  const end = shiftSpan(last)[1];
  if (end + 180 > 1440) return { open: "08:00", close: "11:00" };
  const open = end + 120;
  return {
    open: fromMinutes(open),
    close: fromMinutes(Math.min(open + 240, 1440)),
  };
}

type Props = {
  saved: AdminOpeningHours;
  starting: OpeningHours;
  source: "saved" | "config" | "suggested";
  lastChanged?: string;
};

export function OpeningHoursForm({
  saved,
  starting,
  source,
  lastChanged,
}: Props) {
  const router = useRouter();
  const [version, setVersion] = useState(saved.version);
  const [conflict, setConflict] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: saved.hours ?? starting,
  });
  const { control, formState, handleSubmit, reset, setError } = form;
  const values = useWatch({ control }) as Values;
  const issues = useMemo(() => hoursIssues(values), [values]);
  const issueCount = Object.keys(issues).length;

  const save = useMutation({
    mutationFn: async (hours: Values) => {
      const result = await saveOpeningHours(hours, version);
      if (!result.ok)
        throw Object.assign(new Error(result.message), {
          status: result.status,
          fieldErrors: result.fieldErrors,
        });
      return result.data;
    },
    onSuccess: (data) => {
      setVersion(data.version);
      setConflict(false);
      if (data.hours) reset(data.hours);
      toast.add({
        title: "Opening hours saved",
        description: "The website shows them now.",
        type: "success",
      });
      router.refresh();
    },
    onError: (error: Error & { status?: number; fieldErrors?: Issues }) => {
      if (error.status === 409) setConflict(true);
      Object.entries(error.fieldErrors ?? {}).forEach(
        ([path, message], index) =>
          setError(
            path as FieldPath<Values>,
            { type: "server", message },
            { shouldFocus: index === 0 },
          ),
      );
      toast.add({
        title: "The hours weren't saved",
        description: error.message,
        type: "error",
      });
    },
  });

  const dirty = formState.isDirty;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = handleSubmit((hours) => save.mutate(hours));
  const showIssues = formState.isSubmitted;

  return (
    <form onSubmit={submit} noValidate className="pb-4">
      {conflict && (
        <Banner tone="danger" icon={<CircleAlert className="size-4" />}>
          Someone else saved the hours while you were editing.{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-semibold underline underline-offset-4"
          >
            Load their version
          </button>{" "}
          (your changes here will be lost), or save again to replace theirs
          after reloading.
        </Banner>
      )}
      {source !== "saved" && (
        <Banner tone="info" icon={<Info className="size-4" />}>
          {source === "config"
            ? "These hours come from your setup file. Check them and save once: from then on you manage them here."
            : "No hours yet: here is a suggested week to start from. Adjust it and save."}
        </Banner>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <WeeklySection
            control={control}
            values={values}
            issues={issues}
            setValue={form.setValue}
          />
          <SpecialDaysSection
            control={control}
            values={values}
            issues={issues}
            showAll={showIssues}
          />
          <TimezoneSection control={control} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <GuestPreview values={values} valid={issueCount === 0} />
          {lastChanged && (
            <p className="px-1 text-xs text-muted-foreground">
              Last changed by {lastChanged}.
            </p>
          )}
        </aside>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-background/85 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-3">
          <p
            className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block"
            aria-live="polite"
          >
            {issueCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                <CircleAlert className="size-4" />{" "}
                {issueCount === 1
                  ? "1 thing needs"
                  : `${issueCount} things need`}{" "}
                fixing before you can save
              </span>
            ) : dirty || source !== "saved" ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />{" "}
                {dirty ? "Unsaved changes" : "Not saved yet"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-emerald-600" /> Everything is
                saved
              </span>
            )}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {dirty && (
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => reset()}
                className="h-11 rounded-xl px-4 sm:h-10 sm:rounded-lg"
              >
                <RotateCcw className="size-4" />
                <span className="sr-only sm:not-sr-only">Discard</span>
              </Button>
            )}
            <Button
              type="submit"
              disabled={save.isPending || (!dirty && source === "saved")}
              className="h-11 flex-1 rounded-xl px-5 text-[15px] font-semibold shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] sm:h-10 sm:flex-none sm:text-sm"
            >
              {save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {save.isPending ? "Saving…" : "Save hours"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

type SetValue = UseFormSetValue<Values>;

function WeeklySection({
  control,
  values,
  issues,
  setValue,
}: {
  control: Control<Values>;
  values: Values;
  issues: Issues;
  setValue: SetValue;
}) {
  const spill = DAYS.map((_, i) => {
    const before = values.weekly[(i + 6) % 7]?.shifts ?? [];
    return Math.max(
      0,
      ...before.filter(validShift).map((s) => shiftSpan(s)[1] - 1440),
    );
  });

  const copy = (from: number, targets: number[], label: string) => {
    const shifts = values.weekly[from].shifts.map((s) => ({ ...s }));
    targets.forEach((t) =>
      setValue(
        `weekly.${t}.shifts`,
        shifts.map((s) => ({ ...s })),
        { shouldDirty: true },
      ),
    );
    toast.add({
      title: `${dayName(DAYS[from])}'s hours copied to ${label}`,
      type: "success",
    });
  };

  return (
    <Section
      icon={<Clock className="size-4.5" />}
      title="Weekly hours"
      description="When guests can come in. Add a second shift for a break between lunch and dinner."
    >
      <div className="-mb-2 hidden grid-cols-[9.5rem_minmax(0,1fr)] gap-4 md:grid">
        <span />
        <div className="relative h-4 text-[10px] font-medium text-muted-foreground tabular-nums">
          {[0, 6, 12, 18, 24].map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>
      <ul className="-mx-4 divide-y divide-border sm:-mx-6">
        {DAYS.map((day, i) => (
          <DayRow
            key={day}
            index={i}
            control={control}
            spill={spill[i]}
            issues={issues}
            onCopy={copy}
          />
        ))}
      </ul>
    </Section>
  );
}

const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

function DayRow({
  index,
  control,
  spill,
  issues,
  onCopy,
}: {
  index: number;
  control: Control<Values>;
  spill: number;
  issues: Issues;
  onCopy: (from: number, targets: number[], label: string) => void;
}) {
  const day = DAYS[index];
  const { field } = useController({ control, name: `weekly.${index}.shifts` });
  const shifts = field.value ?? [];
  const open = shifts.length > 0;

  const stash = useRef<Shift[] | null>(null);
  const labelId = useId();

  const toggle = (on: boolean) => {
    if (on)
      field.onChange(stash.current?.length ? stash.current : [nextShift([])]);
    else {
      stash.current = shifts;
      field.onChange([]);
    }
  };

  const others = DAYS.map((_, i) => i).filter((i) => i !== index);
  const copyTargets: { label: string; targets: number[] }[] = [
    { label: "every other day", targets: others },
    { label: "Monday to Friday", targets: WEEKDAYS.filter((i) => i !== index) },
    { label: "the weekend", targets: WEEKEND.filter((i) => i !== index) },
    { label: dayName(DAYS[(index + 1) % 7]), targets: [(index + 1) % 7] },
  ].filter((c) => c.targets.length > 0);

  return (
    <li
      className={cn(
        "px-4 py-3.5 transition-colors sm:px-6",
        !open && "bg-muted/30",
      )}
    >
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className="flex h-10 items-center gap-3">
          <Switch checked={open} onChange={toggle} labelledBy={labelId} />
          <span
            id={labelId}
            className={cn(
              "flex-1 text-sm font-semibold",
              !open && "text-muted-foreground",
            )}
          >
            <span className="md:hidden">{dayName(day)}</span>
            <span className="hidden md:inline">{dayShort(day)}</span>
          </span>
          <CopyMenu
            day={day}
            options={copyTargets}
            onCopy={(t, label) => onCopy(index, t, label)}
          />
        </div>

        <div className="min-w-0">
          {open ? (
            <ShiftsEditor
              value={shifts}
              onChange={field.onChange}
              base={`weekly.${index}`}
              issues={issues}
              dayLabel={dayName(day)}
            />
          ) : (
            <p className="flex h-10 items-center text-sm text-muted-foreground md:pl-1">
              Closed
              {spill > 0 && (
                <span className="ml-1.5 text-xs">
                  · open until {fromMinutes(spill)} from{" "}
                  {dayName(DAYS[(index + 6) % 7])}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="hidden md:block" />
        <Timeline shifts={shifts} spill={spill} />
      </div>
    </li>
  );
}

const validShift = (s: Shift) =>
  TIME_PATTERN.test(s.open) && TIME_PATTERN.test(s.close) && s.open !== s.close;

function Timeline({ shifts, spill }: { shifts: Shift[]; spill: number }) {
  return (
    <div
      aria-hidden
      className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]"
    >
      {[6, 12, 18].map((h) => (
        <span
          key={h}
          className="absolute inset-y-0 w-px bg-background/80"
          style={{ left: `${(h / 24) * 100}%` }}
        />
      ))}
      {spill > 0 && (
        <span
          className="absolute inset-y-0 left-0 rounded-r-full bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--primary)_45%,transparent)_0_3px,transparent_3px_6px)]"
          style={{ width: `${(spill / 1440) * 100}%` }}
        />
      )}
      {shifts.filter(validShift).map((s, i) => {
        const [open, close] = shiftSpan(s);
        const end = Math.min(close, 1440);
        return (
          <span
            key={i}
            className={cn(
              "absolute inset-y-0 rounded-full bg-primary",
              close > 1440 && "rounded-r-none",
            )}
            style={{
              left: `${(open / 1440) * 100}%`,
              width: `${((end - open) / 1440) * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}

function CopyMenu({
  day,
  options,
  onCopy,
}: {
  day: (typeof DAYS)[number];
  options: { label: string; targets: number[] }[];
  onCopy: (targets: number[], label: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Copy ${dayName(day)}'s hours`}
        className="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 data-popup-open:bg-muted data-popup-open:text-foreground"
      >
        <Copy className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl bg-card p-1.5 text-foreground shadow-lg"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Copy {dayShort(day)}&apos;s hours to
          </DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuItem
              key={option.label}
              onClick={() => onCopy(option.targets, option.label)}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-sm focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground"
            >
              {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShiftsEditor({
  value,
  onChange,
  base,
  issues,
  dayLabel,
}: {
  value: Shift[];
  onChange: (shifts: Shift[]) => void;
  base: string;
  issues: Issues;
  dayLabel: string;
}) {
  const update = (j: number, part: keyof Shift, time: string) =>
    onChange(value.map((s, k) => (k === j ? { ...s, [part]: time } : s)));
  const problems = [
    ...value.flatMap((_, j) => [
      issues[`${base}.shifts.${j}.open`],
      issues[`${base}.shifts.${j}.close`],
    ]),
    issues[`${base}.shifts`],
  ].filter((p, k, all): p is string => !!p && all.indexOf(p) === k);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {value.map((shift, j) => {
          const overnight =
            validShift(shift) &&
            toMinutes(shift.close) < toMinutes(shift.open) &&
            shift.close !== "00:00";
          return (
            <div
              key={j}
              className="group/shift relative inline-flex items-center gap-1 rounded-xl border border-border bg-background py-1 pr-1 pl-1 shadow-xs dark:bg-input/20"
            >
              <TimeInput
                value={shift.open}
                onChange={(t) => update(j, "open", t)}
                invalid={!!issues[`${base}.shifts.${j}.open`]}
                label={`${dayLabel}, shift ${j + 1}, opens`}
              />
              <span className="text-muted-foreground" aria-hidden>
                –
              </span>
              <TimeInput
                value={shift.close}
                onChange={(t) => update(j, "close", t)}
                invalid={!!issues[`${base}.shifts.${j}.close`]}
                label={`${dayLabel}, shift ${j + 1}, closes`}
              />
              {overnight && (
                <span
                  title="Closes after midnight"
                  className="grid size-7 place-items-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                >
                  <Moon className="size-3.5" />
                  <span className="sr-only">closes the next day</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, k) => k !== j))}
                aria-label={`Remove ${dayLabel}'s shift ${shift.open}–${shift.close}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
        {value.length < MAX_SHIFTS && (
          <button
            type="button"
            onClick={() => onChange([...value, nextShift(value)])}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="size-3.5" />{" "}
            {value.length === 0 ? "Add hours" : "Add a shift"}
          </button>
        )}
      </div>
      {problems.map((problem) => (
        <p
          key={problem}
          role="alert"
          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-destructive"
        >
          <CircleAlert className="size-3.5 shrink-0" /> {problem}
        </p>
      ))}
    </div>
  );
}

function SpecialDaysSection({
  control,
  values,
  issues,
  showAll,
}: {
  control: Control<Values>;
  values: Values;
  issues: Issues;
  showAll: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "exceptions",
  });
  const [showPast, setShowPast] = useState(false);
  const now = useNow();
  const today = now ? restaurantClock(values.timezone, now).date : "";

  const rows = fields.map((field, index) => ({
    field,
    index,
    date: values.exceptions[index]?.date ?? "",
  }));
  const upcoming = rows
    .filter((r) => !r.date || r.date >= today)
    .sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
  const past = rows.filter((r) => r.date && r.date < today);

  const addDay = () => {
    const from = today || restaurantClock(values.timezone).date;
    const taken = new Set(values.exceptions.map((e) => e.date));
    let k = 1;
    while (taken.has(addDays(from, k).date) && k < 400) k++;
    append({ date: addDays(from, k).date, label: "", shifts: [] });
  };

  return (
    <Section
      icon={<CalendarDays className="size-4.5" />}
      title="Special days"
      description="Holidays and one-off changes. On these dates they replace the weekly hours."
      action={
        <Button
          type="button"
          variant="outline"
          onClick={addDay}
          disabled={fields.length >= MAX_SPECIAL_DAYS}
          className="h-9 shrink-0 rounded-lg px-3"
        >
          <CalendarPlus className="size-4" />
          <span className="hidden sm:inline">Add a day</span>
        </Button>
      }
    >
      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <CalendarDays className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">
            No special days coming up
          </p>
          <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
            Closed for a holiday, or open late for New Year&apos;s Eve? Add the
            date here.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={addDay}
            className="mt-4 h-9 rounded-lg"
          >
            <CalendarPlus className="size-4" /> Add a special day
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {upcoming.map(({ field, index }) => (
            <SpecialDayRow
              key={field.id}
              index={index}
              control={control}
              issues={issues}
              showAll={showAll}
              today={today}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {past.length} past {past.length === 1 ? "day" : "days"}{" "}
            {showPast ? "" : "hidden"}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="rounded-md px-2 py-1 font-semibold hover:bg-background hover:text-foreground"
            >
              {showPast ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={() => remove(past.map((p) => p.index))}
              className="rounded-md px-2 py-1 font-semibold text-destructive hover:bg-destructive/10"
            >
              Remove {past.length === 1 ? "it" : "them"}
            </button>
          </span>
        </div>
      )}
      {showPast && past.length > 0 && (
        <ul className="space-y-3 opacity-70">
          {past.map(({ field, index }) => (
            <SpecialDayRow
              key={field.id}
              index={index}
              control={control}
              issues={issues}
              showAll={showAll}
              today={today}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function SpecialDayRow({
  index,
  control,
  issues,
  showAll,
  today,
  onRemove,
}: {
  index: number;
  control: Control<Values>;
  issues: Issues;
  showAll: boolean;
  today: string;
  onRemove: () => void;
}) {
  const date = useController({ control, name: `exceptions.${index}.date` });
  const label = useController({ control, name: `exceptions.${index}.label` });
  const shifts = useController({ control, name: `exceptions.${index}.shifts` });
  const stash = useRef<Shift[] | null>(null);
  const base = `exceptions.${index}`;
  const dateIssue =
    (showAll || date.fieldState.isDirty) && issues[`${base}.date`];
  const labelIssue =
    (showAll || label.fieldState.isTouched) && issues[`${base}.label`];
  const open = (shifts.field.value ?? []).length > 0;

  return (
    <li className="rounded-xl border border-border bg-background/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-full sm:w-44">
          <input
            type="date"
            {...date.field}
            aria-label="Date"
            aria-invalid={dateIssue ? true : undefined}
            className={cn(inputClass, "scheme-light dark:scheme-dark")}
          />
          <p
            className={cn(
              "mt-1 text-xs",
              dateIssue
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {dateIssue || describeDate(date.field.value, today)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <input
            {...label.field}
            maxLength={MAX_LABEL}
            placeholder="Christmas Day, private event…"
            aria-label="Name"
            aria-invalid={labelIssue ? true : undefined}
            className={inputClass}
          />
          {labelIssue && (
            <p className="mt-1 text-xs font-medium text-destructive">
              {labelIssue}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this special day"
          className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          role="radiogroup"
          aria-label="Hours that day"
          className="inline-flex h-10 shrink-0 self-start rounded-lg border border-border bg-muted/50 p-1"
        >
          {[
            { on: false, label: "Closed" },
            { on: true, label: "Special hours" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={open === option.on}
              onClick={() => {
                if (option.on === open) return;
                if (option.on)
                  shifts.field.onChange(
                    stash.current?.length
                      ? stash.current
                      : [{ open: "12:00", close: "17:00" }],
                  );
                else {
                  stash.current = shifts.field.value;
                  shifts.field.onChange([]);
                }
              }}
              className={cn(
                "rounded-md px-3 text-sm font-medium transition-colors",
                open === option.on
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {open && (
          <div className="min-w-0 flex-1">
            <ShiftsEditor
              value={shifts.field.value}
              onChange={shifts.field.onChange}
              base={base}
              issues={issues}
              dayLabel={label.field.value || "Special day"}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function describeDate(date: string, today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a date";
  if (!today) return dayName(addDays(date, 0).day);
  const days = Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
  const weekday = dayName(addDays(date, 0).day);
  if (days === 0) return `${weekday} · today`;
  if (days === 1) return `${weekday} · tomorrow`;
  if (days < 0) return `${weekday} · ${-days} days ago`;
  return `${weekday} · in ${days} days`;
}

function TimezoneSection({ control }: { control: Control<Values> }) {
  const { field } = useController({ control, name: "timezone" });
  const [open, setOpen] = useState(false);
  const now = useNow();

  return (
    <Section
      icon={<Globe className="size-4.5" />}
      title="Time zone"
      description="“Open now” and every time on this page use the restaurant's local time."
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{field.value.replace(/_/g, " ")}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {now
              ? `${zoneTime(field.value, now)} there now · ${zoneOffset(field.value, now)}`
              : " "}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-9 rounded-lg"
        >
          Change
        </Button>
      </div>
      {open && (
        <TimezoneDialog
          value={field.value}
          onPick={(zone) => {
            field.onChange(zone);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </Section>
  );
}

function TimezoneDialog({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (zone: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const now = useNow() ?? new Date();
  const zones = useMemo(() => allTimeZones(), []);
  const terms = search
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const matches = terms.length
    ? zones.filter((zone) => {
        const text = zone.toLowerCase().replace(/_/g, " ");
        return terms.every((t) => text.includes(t));
      })
    : [value, ...zones.filter((zone) => zone !== value)];
  const shown = matches.slice(0, 60);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 text-left sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 pb-4 text-left">
          <DialogTitle className="text-lg">Time zone</DialogTitle>
          <DialogDescription>
            Search a city or region, like “Beirut” or “Europe”.
          </DialogDescription>
          <div className="group relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="City or region"
              aria-label="Search time zones"
              className={cn(inputClass, "h-11 rounded-xl pl-11 text-[15px]")}
            />
          </div>
        </DialogHeader>
        <ul
          className="min-h-0 flex-1 overflow-y-auto p-2"
          aria-label="Time zones"
        >
          {shown.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-muted-foreground">
              No time zone matches “{search}”.
            </li>
          )}
          {shown.map((zone) => {
            const [region, ...rest] = zone.split("/");
            const city = (rest.join(" / ") || region).replace(/_/g, " ");
            const active = zone === value;
            return (
              <li key={zone}>
                <button
                  type="button"
                  onClick={() => onPick(zone)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted",
                    active && "bg-primary/8",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {city}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {rest.length ? region.replace(/_/g, " ") : "Zone"} ·{" "}
                      {zoneOffset(zone, now)}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {zoneTime(zone, now)}
                  </span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              </li>
            );
          })}
          {matches.length > shown.length && (
            <li className="px-3 py-2 text-center text-xs text-muted-foreground">
              {matches.length - shown.length} more: keep typing to narrow it
              down
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function allTimeZones(): string[] {
  try {
    return (
      Intl as unknown as { supportedValuesOf: (key: string) => string[] }
    ).supportedValuesOf("timeZone");
  } catch {
    return [
      "UTC",
      "Europe/London",
      "Europe/Paris",
      "Asia/Beirut",
      "Asia/Dubai",
      "America/New_York",
      "America/Los_Angeles",
    ];
  }
}

const zoneTime = (timeZone: string, now: Date) => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
  } catch {
    return "";
  }
};

const zoneOffset = (timeZone: string, now: Date) => {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
};

function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function GuestPreview({ values, valid }: { values: Values; valid: boolean }) {
  const now = useNow();
  const status = valid && now ? getOpenStatus(values, now) : null;
  const today = now ? restaurantClock(values.timezone, now) : null;
  const coming = today
    ? [...values.exceptions]
        .filter((e) => e.date >= today.date && e.label.trim())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3)
    : [];

  return (
    <section
      aria-label="What guests see"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
    >
      <div className="border-b border-border/70 px-5 py-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <Store className="size-3.5" /> What guests see
        </p>
        <div className="mt-3 min-h-12" aria-live="polite">
          {status ? (
            <>
              <p className="flex items-center gap-2 text-base font-semibold">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    status.open
                      ? status.closingSoon
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                      : "bg-foreground/30",
                  )}
                />
                {status.label}
              </p>
              <p className="mt-0.5 pl-4.5 text-xs text-muted-foreground">
                {status.special ? `${status.special} · ` : ""}
                {status.closingSoon ? "Closing soon · " : ""}Right now,{" "}
                {zoneTime(values.timezone, now!)} local time
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {valid ? " " : "Fix the highlighted hours to see the preview."}
            </p>
          )}
        </div>
      </div>

      <dl className="divide-y divide-border/60 px-5">
        {groupWeekly(values.weekly).map((group) => (
          <div
            key={group.days}
            className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
          >
            <dt className="shrink-0 font-medium">{group.days}</dt>
            <dd
              className={cn(
                "text-right tabular-nums",
                group.closed ? "text-muted-foreground" : "text-foreground/85",
              )}
            >
              {group.hours.split(", ").map((range) => (
                <span key={range} className="block">
                  {range}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      {coming.length > 0 && (
        <div className="border-t border-border/70 bg-muted/30 px-5 py-3">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Coming up
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {coming.map((day) => (
              <li
                key={day.date}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{day.label}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {shortDate(day.date)}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    day.shifts.length
                      ? "text-foreground/85"
                      : "text-muted-foreground",
                  )}
                >
                  {shiftsLabel(day.shifts)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "info" | "danger";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "mb-5 flex gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/25 bg-primary/[0.07] text-foreground/85",
      )}
    >
      <span
        className={cn("mt-0.5 shrink-0", tone === "info" && "text-primary")}
      >
        {icon}
      </span>
      <p>{children}</p>
    </div>
  );
}

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
