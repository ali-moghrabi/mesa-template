/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  FileText,
  ImagePlus,
  Loader2,
  MessageCircle,
  Moon,
  Palette,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  COLOR_PRESETS,
  CUISINES,
  CURRENCIES,
  DAYS,
  PLANS,
  PRICE_RANGES,
  RESTAURANT_TYPES,
  STEPS,
  buildConfig,
  contrastWithWhite,
  emptyAnswers,
  logoColors,
  mix,
  shrinkPhoto,
  validateStep,
  type Day,
  type Errors,
  type OnboardingAnswers,
  type Step,
} from "@/lib/onboarding";

type Props = {
  apiUrl: string;
  base: Record<string, unknown>;
  plan?: string;
};

type Photo = { id: string; file: File; url: string };

const DRAFT_KEY = "mesa:onboarding-draft";
const MAX_PHOTOS = 15;
const MAX_MENU_FILES = 5;

const STEP_INFO: Record<Step, { title: string; hint: string }> = {
  restaurant: {
    title: "Your restaurant",
    hint: "The basics guests should know",
  },
  contact: {
    title: "Location & contact",
    hint: "Where guests find and reach you",
  },
  look: { title: "Look & photos", hint: "Your colour, logo and pictures" },
  hours: { title: "Opening hours", hint: "When you're open" },
  services: { title: "Services", hint: "Bookings, delivery and payments" },
  final: { title: "Menu & last details", hint: "Your menu, domain and you" },
  review: { title: "Review & send", hint: "Check everything once" },
};

/* ───────────── draft on this device ───────────── */

const readDraft = (): OnboardingAnswers | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OnboardingAnswers) : null;
  } catch {
    return null;
  }
};
const noSubscribe = () => () => {};
const hasDraftSnapshot = () => readDraft() !== null;
const noDraftOnServer = () => false;

/* ───────────── the form ───────────── */

export function Onboarding({ apiUrl, base, plan }: Props) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(() =>
    emptyAnswers(plan),
  );
  const [stepIndex, setStepIndex] = useState(-1); // -1 = welcome
  const [errors, setErrors] = useState<Errors>({});
  const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasDraft = useSyncExternalStore(
    noSubscribe,
    hasDraftSnapshot,
    noDraftOnServer,
  );

  const step = stepIndex >= 0 ? STEPS[stepIndex] : null;

  // Keep the answers on this device while typing (files can't be kept)
  useEffect(() => {
    if (stepIndex < 0 || doneId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch {
      // private window: nothing to keep
    }
  }, [answers, stepIndex, doneId]);

  // Object URLs for previews are freed when the page goes
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => urls.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );
  const preview = (file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    return url;
  };

  /** answers.section = { ...answers.section, ...patch } */
  const patch = <K extends keyof OnboardingAnswers>(
    section: K,
    value: Partial<OnboardingAnswers[K]>,
  ) => setAnswers((a) => ({ ...a, [section]: { ...a[section], ...value } }));

  const goTo = (index: number) => {
    setStepIndex(index);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    if (!step) return;
    const found = validateStep(step, answers);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(),
      );
      return;
    }
    goTo(stepIndex + 1);
  };

  const start = (resume: boolean) => {
    const draft = resume ? readDraft() : null;
    if (draft) setAnswers({ ...emptyAnswers(plan), ...draft });
    else {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    }
    goTo(0);
  };

  /* files */

  const addLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogo({ file, url: preview(file) });
    const colors = await logoColors(file);
    setSuggested(colors);
    if (colors[0] && answers.brand.primaryColor === COLOR_PRESETS[0])
      patch("brand", { primaryColor: colors[0] });
  };

  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const files = [...list]
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room);
    if (files.length === 0) return;
    setPreparing(true);
    const ready: Photo[] = [];
    for (const f of files) {
      const small = await shrinkPhoto(f);
      ready.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: small,
        url: preview(small),
      });
    }
    setPhotos((p) => [...p, ...ready].slice(0, MAX_PHOTOS));
    setPreparing(false);
  };

  const addMenuFiles = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list].filter((f) =>
      /^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type),
    );
    setMenuFiles((m) => [...m, ...ok].slice(0, MAX_MENU_FILES));
  };

  /* submit */

  const submit = () => {
    setSendError(null);
    const form = new FormData();
    form.append("data", JSON.stringify(answers));
    form.append("config", JSON.stringify(buildConfig(answers, base)));
    if (logo) form.append("logo", logo.file);
    photos.forEach((p) => form.append("photos", p.file));
    menuFiles.forEach((f) => form.append("menu", f));

    // XHR rather than fetch: it reports upload progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl.replace(/\/+$/, "")}/onboarding`);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && setSending(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setSending(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        let id = "";
        try {
          id = (JSON.parse(xhr.responseText) as { id?: string }).id ?? "";
        } catch {}
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        setDoneId(id || "sent");
        window.scrollTo({ top: 0 });
      } else {
        let message =
          "Something went wrong on our side. Please try again in a minute.";
        try {
          const body = JSON.parse(xhr.responseText) as {
            message?: string | string[];
          };
          if (xhr.status === 429)
            message =
              "Too many attempts. Please wait a few minutes and try again.";
          else if (xhr.status === 413)
            message =
              "The files are too big together. Remove a few photos and try again.";
          else if (body.message)
            message = Array.isArray(body.message)
              ? body.message[0]
              : body.message;
        } catch {}
        setSendError(message);
      }
    };
    xhr.onerror = () => {
      setSending(null);
      setSendError(
        "Couldn't reach our server. Check your connection and try again.",
      );
    };
    setSending(0);
    xhr.send(form);
  };

  if (doneId)
    return (
      <Done name={answers.person.name} restaurant={answers.restaurant.name} />
    );

  return (
    <div className="fixed inset-0 z-100 overflow-y-auto bg-[#F7F2EC] text-[#1C1512] scheme-light">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 pb-16 sm:px-6 lg:flex-row lg:gap-10 lg:px-8">
        <aside
          className={
            step
              ? "pt-6 lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:pt-10"
              : "pt-6 lg:hidden"
          }
        >
          <Logo />
          {step && (
            <>
              <div className="mt-6 lg:hidden">
                <div className="flex items-center justify-between text-sm font-medium text-[#6B5E54]">
                  <span>
                    Step {stepIndex + 1} of {STEPS.length}
                  </span>
                  <span>{STEP_INFO[step].title}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E9DFD4]">
                  <div
                    className="h-full rounded-full bg-[#B4532A] transition-[width] duration-500"
                    style={{
                      width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <ol className="mt-10 hidden space-y-1 lg:block">
                {STEPS.map((s, i) => {
                  const done = i < stepIndex;
                  const current = i === stepIndex;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        disabled={i > stepIndex}
                        onClick={() => goTo(i)}
                        aria-current={current ? "step" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${current ? "bg-white shadow-sm" : done ? "hover:bg-white/60" : "opacity-50"}`}
                      >
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-[#B4532A] text-white" : current ? "bg-[#1C1512] text-white" : "bg-[#E9DFD4] text-[#6B5E54]"}`}
                        >
                          {done ? (
                            <Check className="size-3.5" strokeWidth={3} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {STEP_INFO[s].title}
                          </span>
                          <span className="block text-xs text-[#6B5E54]">
                            {STEP_INFO[s].hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-8 hidden text-xs text-[#8A7D72] lg:block">
                Your answers are saved on this device as you go.
              </p>
            </>
          )}
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pt-6 lg:pt-10">
          {!step && (
            <div className="hidden lg:block">
              <Logo />
            </div>
          )}
          {!step ? (
            <Welcome hasDraft={hasDraft} onStart={start} />
          ) : (
            <div className="rounded-[28px] bg-white p-5 shadow-[0_30px_80px_-40px_rgba(60,30,15,0.35)] ring-1 ring-black/5 sm:p-8 lg:p-10">
              <p className="text-xs font-bold tracking-[0.16em] text-[#B4532A] uppercase">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
              >
                {STEP_INFO[step].title}
              </h1>
              <p className="mt-2 text-[#6B5E54]">{STEP_INFO[step].hint}.</p>

              <div className="mt-8 space-y-7">
                {step === "restaurant" && (
                  <RestaurantStep a={answers} patch={patch} errors={errors} />
                )}
                {step === "contact" && (
                  <ContactStep a={answers} patch={patch} errors={errors} />
                )}
                {step === "look" && (
                  <LookStep
                    a={answers}
                    patch={patch}
                    errors={errors}
                    logo={logo}
                    suggested={suggested}
                    onLogo={addLogo}
                    onRemoveLogo={() => {
                      setLogo(null);
                      setSuggested([]);
                    }}
                    photos={photos}
                    preparing={preparing}
                    onPhotos={addPhotos}
                    onRemovePhoto={(id) =>
                      setPhotos((p) => p.filter((x) => x.id !== id))
                    }
                    onCover={(id) =>
                      setPhotos((p) => [
                        ...p.filter((x) => x.id === id),
                        ...p.filter((x) => x.id !== id),
                      ])
                    }
                  />
                )}
                {step === "hours" && (
                  <HoursStep
                    a={answers}
                    setAnswers={setAnswers}
                    errors={errors}
                  />
                )}
                {step === "services" && (
                  <ServicesStep a={answers} patch={patch} errors={errors} />
                )}
                {step === "final" && (
                  <FinalStep
                    a={answers}
                    patch={patch}
                    errors={errors}
                    menuFiles={menuFiles}
                    onMenuFiles={addMenuFiles}
                    onRemoveMenu={(i) =>
                      setMenuFiles((m) => m.filter((_, j) => j !== i))
                    }
                  />
                )}
                {step === "review" && (
                  <ReviewStep
                    a={answers}
                    logo={logo}
                    photos={photos}
                    menuFiles={menuFiles}
                    onEdit={(s) => goTo(STEPS.indexOf(s))}
                    consent={consent}
                    onConsent={setConsent}
                  />
                )}
              </div>

              {sendError && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {sendError}
                </p>
              )}

              {/* Navigation */}
              <div className="mt-10 flex flex-col-reverse gap-3 border-t border-[#EFE7DE] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => goTo(stepIndex - 1)}
                  disabled={stepIndex === 0 || sending !== null}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold text-[#6B5E54] transition-colors hover:bg-[#F7F2EC] hover:text-[#1C1512] disabled:invisible"
                >
                  <ArrowLeft className="size-4" /> Back
                </button>
                {step === "review" ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!consent || sending !== null}
                    className="relative inline-flex h-13 items-center justify-center gap-2 overflow-hidden rounded-full bg-[#B4532A] px-8 font-semibold text-white shadow-[0_14px_30px_-14px_#B4532A] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending !== null && (
                      <span
                        className="absolute inset-y-0 left-0 bg-white/20 transition-[width]"
                        style={{ width: `${sending}%` }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative inline-flex items-center gap-2">
                      {sending !== null ? (
                        <Loader2 className="size-4.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-4.5" />
                      )}
                      {sending !== null
                        ? sending < 100
                          ? `Sending… ${sending}%`
                          : "Almost done…"
                        : "Send my details"}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={next}
                    disabled={preparing}
                    className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#1C1512] px-8 font-semibold text-white transition hover:bg-black disabled:opacity-60"
                  >
                    {preparing ? "Preparing photos…" : "Continue"}{" "}
                    <ArrowRight className="size-4.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <a
      href="https://www.mesa-template.store"
      className="inline-flex items-center gap-2.5"
      aria-label="MESA"
    >
      <span className="grid size-9 place-items-center rounded-[10px] bg-[#B4532A] text-lg font-extrabold text-[#FBF7F2]">
        M
      </span>
      <span className="text-xl font-extrabold tracking-tight">
        MESA<span className="text-[#B4532A]">.</span>
      </span>
    </a>
  );
}

function Welcome({
  hasDraft,
  onStart,
}: {
  hasDraft: boolean;
  onStart: (resume: boolean) => void;
}) {
  const needs = [
    {
      icon: <ImagePlus className="size-5" />,
      text: "Your logo and a few photos (dishes, the room, the front)",
    },
    {
      icon: <FileText className="size-5" />,
      text: "Your menu: a PDF, photos of it, or a link",
    },
    { icon: <Clock className="size-5" />, text: "Your opening hours" },
    {
      icon: <Bike className="size-5" />,
      text: "Delivery fees and areas, if you deliver",
    },
  ];
  return (
    <div className="grid gap-10 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:pt-20">
      <div>
        <p className="text-sm font-bold tracking-[0.16em] text-[#B4532A] uppercase">
          Welcome to MESA
        </p>
        <h1 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
          Let&apos;s build your restaurant&apos;s website.
        </h1>
        <p className="mt-5 max-w-lg text-lg text-pretty text-[#6B5E54]">
          Tell us about your place once, in about{" "}
          <strong className="text-[#1C1512]">10 minutes</strong>. We take it
          from there and send you a preview before anything goes live.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {hasDraft ? (
            <>
              <button
                type="button"
                onClick={() => onStart(true)}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#B4532A] px-8 font-semibold text-white shadow-[0_14px_30px_-14px_#B4532A] transition hover:brightness-110"
              >
                Continue where I left off <ArrowRight className="size-4.5" />
              </button>
              <button
                type="button"
                onClick={() => onStart(false)}
                className="inline-flex h-13 items-center justify-center rounded-full px-6 font-semibold text-[#6B5E54] hover:bg-white"
              >
                Start over
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onStart(false)}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#B4532A] px-8 font-semibold text-white shadow-[0_14px_30px_-14px_#B4532A] transition hover:brightness-110"
            >
              Let&apos;s start <ArrowRight className="size-4.5" />
            </button>
          )}
        </div>
      </div>
      <div className="rounded-[28px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(60,30,15,0.35)] ring-1 ring-black/5 sm:p-8">
        <p className="font-semibold">Good to have nearby</p>
        <ul className="mt-5 space-y-4">
          {needs.map((n) => (
            <li key={n.text} className="flex gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F7F2EC] text-[#B4532A]">
                {n.icon}
              </span>
              <span className="pt-2 text-[15px] text-[#3D332C]">{n.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-xl bg-[#F7F2EC] px-4 py-3 text-sm text-[#6B5E54]">
          Missing something? Skip it: you can send it later, and you&apos;ll
          edit most things yourself in your admin panel.
        </p>
      </div>
    </div>
  );
}

function Done({ name, restaurant }: { name: string; restaurant: string }) {
  return (
    <div className="fixed inset-0 z-100 overflow-y-auto bg-[#F7F2EC] text-[#1C1512]">
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-[#B4532A] text-white shadow-[0_20px_40px_-16px_#B4532A] transition-transform duration-500 starting:scale-50">
          <Check className="size-10" strokeWidth={3} />
        </span>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-balance">
          Thank you{name ? `, ${name.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-4 text-lg text-pretty text-[#6B5E54]">
          We received everything for{" "}
          <strong className="text-[#1C1512]">{restaurant}</strong>. A
          confirmation is on its way to your email and WhatsApp.
        </p>
        <ol className="mt-10 w-full space-y-3 text-left">
          {[
            "We design your website with your colour and photos.",
            "We send you a private preview to review.",
            "Once you're happy, your site goes live and we show you the admin panel.",
          ].map((t, i) => (
            <li
              key={t}
              className="flex items-start gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-black/5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F7F2EC] text-sm font-bold text-[#B4532A]">
                {i + 1}
              </span>
              <span className="pt-1">{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ───────────── steps ───────────── */

type Patch = <K extends keyof OnboardingAnswers>(
  section: K,
  value: Partial<OnboardingAnswers[K]>,
) => void;
type StepProps = { a: OnboardingAnswers; patch: Patch; errors: Errors };

function RestaurantStep({ a, patch, errors }: StepProps) {
  const r = a.restaurant;
  const [custom, setCustom] = useState("");
  const toggleCuisine = (c: string) =>
    patch("restaurant", {
      cuisine: r.cuisine.includes(c)
        ? r.cuisine.filter((x) => x !== c)
        : [...r.cuisine, c].slice(0, 6),
    });
  const addCustom = () => {
    const c = custom.trim();
    if (c && !r.cuisine.includes(c))
      patch("restaurant", { cuisine: [...r.cuisine, c].slice(0, 6) });
    setCustom("");
  };
  const extra = r.cuisine.filter((c) => !CUISINES.includes(c));

  return (
    <>
      <Field
        label="Restaurant name"
        error={errors["restaurant.name"]}
        id="name"
      >
        <input
          id="name"
          value={r.name}
          onChange={(e) => patch("restaurant", { name: e.target.value })}
          maxLength={80}
          placeholder="e.g. Zaatar & Co"
          autoComplete="organization"
          className={INPUT}
          aria-invalid={!!errors["restaurant.name"]}
        />
      </Field>

      <Group label="What kind of place is it?">
        <div className="flex flex-wrap gap-2">
          {RESTAURANT_TYPES.map((t) => (
            <Chip
              key={t.id}
              active={r.type === t.id}
              onClick={() => patch("restaurant", { type: t.id })}
            >
              {t.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group
        label="Cuisine"
        hint="Pick up to 6, or type your own"
        error={errors["restaurant.cuisine"]}
      >
        <div className="flex flex-wrap gap-2">
          {[...CUISINES, ...extra].map((c) => (
            <Chip
              key={c}
              active={r.cuisine.includes(c)}
              onClick={() => toggleCuisine(c)}
            >
              {c}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            maxLength={40}
            placeholder="Another cuisine…"
            aria-label="Another cuisine"
            aria-invalid={!!errors["restaurant.cuisine"]}
            className={`${INPUT} max-w-xs`}
          />
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-[#E4D9CD] px-4 text-sm font-semibold hover:bg-[#F7F2EC]"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>
      </Group>

      <Group label="Price range">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRICE_RANGES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={r.priceRange === p.id}
              onClick={() => patch("restaurant", { priceRange: p.id })}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${r.priceRange === p.id ? "border-[#1C1512] bg-[#1C1512] text-white" : "border-[#E4D9CD] hover:bg-[#F7F2EC]"}`}
            >
              <span className="block font-semibold">{p.id}</span>
              <span
                className={`block text-xs ${r.priceRange === p.id ? "text-white/70" : "text-[#6B5E54]"}`}
              >
                {p.hint}
              </span>
            </button>
          ))}
        </div>
      </Group>

      <Field
        label="Tell guests about your place"
        hint={`${r.description.length}/600`}
        error={errors["restaurant.description"]}
        id="desc"
      >
        <textarea
          id="desc"
          value={r.description}
          onChange={(e) => patch("restaurant", { description: e.target.value })}
          rows={4}
          maxLength={600}
          placeholder="What makes it special? The food, the story, the atmosphere…"
          className={`${INPUT} h-auto py-3`}
          aria-invalid={!!errors["restaurant.description"]}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Short tagline" hint="Optional" id="tagline">
          <input
            id="tagline"
            value={r.tagline}
            onChange={(e) => patch("restaurant", { tagline: e.target.value })}
            maxLength={120}
            placeholder="e.g. Fresh manakish, all day"
            className={INPUT}
          />
        </Field>
        <Field
          label="Open since"
          hint="Optional"
          error={errors["restaurant.since"]}
          id="since"
        >
          <input
            id="since"
            value={r.since}
            onChange={(e) =>
              patch("restaurant", {
                since: e.target.value.replace(/\D/g, "").slice(0, 4),
              })
            }
            inputMode="numeric"
            placeholder="2015"
            className={INPUT}
            aria-invalid={!!errors["restaurant.since"]}
          />
        </Field>
      </div>
    </>
  );
}

function ContactStep({ a, patch, errors }: StepProps) {
  const c = a.contact;
  const set =
    (key: keyof OnboardingAnswers["contact"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      patch("contact", { [key]: e.target.value });
  const err = (key: string) => errors[`contact.${key}`];
  return (
    <>
      <Field
        label="Google Maps link"
        hint="Open your place on Google Maps, tap Share, paste the link"
        error={err("mapsLink")}
        id="maps"
      >
        <input
          id="maps"
          value={c.mapsLink}
          onChange={set("mapsLink")}
          inputMode="url"
          placeholder="https://maps.app.goo.gl/…"
          className={INPUT}
          aria-invalid={!!err("mapsLink")}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Street & building" hint="Optional" id="street">
          <input
            id="street"
            value={c.street}
            onChange={set("street")}
            autoComplete="street-address"
            placeholder="Bliss Street, Najjar Bldg"
            className={INPUT}
          />
        </Field>
        <Field label="Area" hint="Optional" id="area">
          <input
            id="area"
            value={c.area}
            onChange={set("area")}
            placeholder="Hamra"
            className={INPUT}
          />
        </Field>
        <Field label="City" error={err("city")} id="city">
          <input
            id="city"
            value={c.city}
            onChange={set("city")}
            autoComplete="address-level2"
            placeholder="Beirut"
            className={INPUT}
            aria-invalid={!!err("city")}
          />
        </Field>
        <Field label="Country" error={err("country")} id="country">
          <input
            id="country"
            value={c.country}
            onChange={set("country")}
            autoComplete="country-name"
            className={INPUT}
            aria-invalid={!!err("country")}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone for guests" error={err("phone")} id="phone">
          <input
            id="phone"
            value={c.phone}
            onChange={set("phone")}
            type="tel"
            autoComplete="tel"
            placeholder="+961 1 234 567"
            className={INPUT}
            aria-invalid={!!err("phone")}
          />
        </Field>
        <Field
          label="WhatsApp"
          hint="For orders and questions"
          error={err("whatsapp")}
          id="wa"
        >
          <input
            id="wa"
            value={c.whatsapp}
            onChange={set("whatsapp")}
            type="tel"
            placeholder="+961 71 234 567"
            className={INPUT}
            aria-invalid={!!err("whatsapp")}
          />
        </Field>
      </div>
      <Field
        label="Email"
        hint="Bookings, orders and messages arrive here"
        error={err("email")}
        id="email"
      >
        <input
          id="email"
          value={c.email}
          onChange={set("email")}
          type="email"
          autoComplete="email"
          placeholder="hello@yourplace.com"
          className={INPUT}
          aria-invalid={!!err("email")}
        />
      </Field>

      <Group label="Social media" hint="Optional: paste the links">
        <div className="grid gap-3 sm:grid-cols-3">
          {(["instagram", "facebook", "tiktok"] as const).map((p) => (
            <div key={p}>
              <input
                value={c[p]}
                onChange={set(p)}
                inputMode="url"
                placeholder={`https://${p}.com/…`}
                aria-label={p}
                className={INPUT}
                aria-invalid={!!err(p)}
              />
              {err(p) && <p className="mt-1 text-sm text-red-700">{err(p)}</p>}
            </div>
          ))}
        </div>
      </Group>

      <Field
        label="Company's legal name"
        hint="Optional, for your privacy policy and terms"
        id="legal"
      >
        <input
          id="legal"
          value={c.legalName}
          onChange={set("legalName")}
          placeholder="e.g. Zaatar & Co SARL"
          className={INPUT}
        />
      </Field>
    </>
  );
}

function LookStep({
  a,
  patch,
  errors,
  logo,
  suggested,
  onLogo,
  onRemoveLogo,
  photos,
  preparing,
  onPhotos,
  onRemovePhoto,
  onCover,
}: StepProps & {
  logo: { file: File; url: string } | null;
  suggested: string[];
  onLogo: (f: File | undefined) => void;
  onRemoveLogo: () => void;
  photos: Photo[];
  preparing: boolean;
  onPhotos: (l: FileList | null) => void;
  onRemovePhoto: (id: string) => void;
  onCover: (id: string) => void;
}) {
  const color = a.brand.primaryColor;
  const valid = /^#[0-9a-f]{6}$/i.test(color);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const lowContrast = valid && contrastWithWhite(color) < 3;
  const pickColor = (c: string) => {
    patch("brand", { primaryColor: c });
    setHexDraft(null);
  };

  return (
    <>
      <Group
        label="Logo"
        hint="PNG or SVG with a transparent background is best"
      >
        {logo ? (
          <div className="flex items-center gap-4 rounded-2xl border border-[#E4D9CD] p-3">
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-[repeating-conic-gradient(#f1ebe4_0_25%,#fff_0_50%)] bg-size-[16px_16px]">
              <img
                src={logo.url}
                alt="Your logo"
                className="max-h-16 max-w-16 object-contain"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {logo.file.name}
              </span>
              <span className="text-sm text-[#6B5E54]">
                {Math.round(logo.file.size / 1024)} KB
              </span>
            </span>
            <button
              type="button"
              onClick={onRemoveLogo}
              aria-label="Remove logo"
              className="grid size-10 place-items-center rounded-full text-[#6B5E54] hover:bg-[#F7F2EC]"
            >
              <X className="size-4.5" />
            </button>
          </div>
        ) : (
          <DropZone
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onFiles={(l) => onLogo(l?.[0])}
            icon={<Upload className="size-5" />}
            title="Upload your logo"
            hint="Drop it here or tap to choose"
          />
        )}
      </Group>

      <Group
        label="Your main colour"
        hint="Buttons, links and highlights use it. We match the other colours to it."
        error={errors["brand.primaryColor"]}
      >
        {suggested.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-sm font-medium text-[#6B5E54]">
              From your logo
            </p>
            <div className="flex flex-wrap gap-2">
              {suggested.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  active={color.toUpperCase() === c.toUpperCase()}
                  onClick={() => pickColor(c)}
                />
              ))}
            </div>
          </div>
        )}
        <p className="mb-2 text-sm font-medium text-[#6B5E54]">
          {suggested.length > 0 ? "Or pick one" : "Pick one"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRESETS.map((c) => (
            <Swatch
              key={c}
              color={c}
              active={color.toUpperCase() === c.toUpperCase()}
              onClick={() => pickColor(c)}
            />
          ))}
          <label
            className="relative grid size-11 cursor-pointer place-items-center rounded-full border-2 border-dashed border-[#D6C9BB] text-[#6B5E54] hover:border-[#1C1512]"
            title="Any colour"
          >
            <Palette className="size-4.5" />
            <input
              type="color"
              value={valid ? color : "#B4532A"}
              onChange={(e) => pickColor(e.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Any colour"
            />
          </label>
          <input
            value={hexDraft ?? color}
            onFocus={() => setHexDraft(color)}
            onBlur={() => setHexDraft(null)}
            onChange={(e) => {
              const v = e.target.value.trim();
              setHexDraft(v);
              const hex = v.startsWith("#") ? v : `#${v}`;
              if (/^#[0-9a-f]{6}$/i.test(hex))
                patch("brand", { primaryColor: hex.toUpperCase() });
            }}
            maxLength={7}
            aria-label="Colour code"
            className={`${INPUT} max-w-32 font-mono uppercase`}
          />
        </div>
        {lowContrast && (
          <p className="mt-2 text-sm text-amber-800">
            This colour is light: white text on it is hard to read. We&apos;ll
            use a deeper shade for buttons.
          </p>
        )}

        {valid && (
          <MiniPreview
            name={a.restaurant.name || "Your restaurant"}
            color={color}
            mode={a.brand.mode}
            logo={logo?.url}
          />
        )}
      </Group>

      <Group label="Website style">
        <div className="grid grid-cols-2 gap-3">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={a.brand.mode === m}
              onClick={() => patch("brand", { mode: m })}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${a.brand.mode === m ? "border-[#1C1512] ring-1 ring-[#1C1512]" : "border-[#E4D9CD] hover:bg-[#F7F2EC]"}`}
            >
              <span
                className={`grid size-10 place-items-center rounded-xl ${m === "light" ? "bg-[#F7F2EC] text-[#B4532A]" : "bg-[#1C1512] text-[#F3C9A8]"}`}
              >
                {m === "light" ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </span>
              <span>
                <span className="block font-semibold">
                  {m === "light" ? "Light" : "Dark"}
                </span>
                <span className="block text-xs text-[#6B5E54]">
                  {m === "light"
                    ? "Bright and airy"
                    : "Moody, for evenings and bars"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Group>

      <Group
        label="Photos"
        hint={`Up to ${MAX_PHOTOS}: dishes, the room, the front. The first one is the cover.`}
      >
        {photos.length > 0 && (
          <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <li
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-[#F7F2EC]"
              >
                <img
                  src={p.url}
                  alt={`Photo ${i + 1}`}
                  className="size-full object-cover"
                />
                {i === 0 ? (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-[#1C1512]/85 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCover(p.id)}
                    className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#1C1512] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemovePhoto(p.id)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-[#1C1512] shadow-sm"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <DropZone
            accept="image/*"
            multiple
            onFiles={onPhotos}
            icon={
              preparing ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImagePlus className="size-5" />
              )
            }
            title={
              preparing
                ? "Preparing photos…"
                : photos.length
                  ? "Add more photos"
                  : "Upload photos"
            }
            hint="Big phone photos are fine: we shrink them for you"
          />
        )}
      </Group>
    </>
  );
}

function MiniPreview({
  name,
  color,
  mode,
  logo,
}: {
  name: string;
  color: string;
  mode: "light" | "dark";
  logo?: string;
}) {
  const dark = mode === "dark";
  const button = contrastWithWhite(color) < 3 ? mix(color, -0.25) : color;
  return (
    <div
      aria-hidden="true"
      className={`mt-5 overflow-hidden rounded-2xl ring-1 ${dark ? "bg-[#15120F] text-[#F5EFE6] ring-white/10" : "bg-[#FBF7F2] text-[#1F1B16] ring-black/5"}`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3 text-sm ${dark ? "border-b border-white/10" : "border-b border-black/5"}`}
      >
        <span className="flex items-center gap-2 font-bold">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="h-6 w-auto max-w-20 object-contain"
            />
          ) : (
            <span
              className="grid size-6 place-items-center rounded-md text-xs text-white"
              style={{ background: button }}
            >
              {name.charAt(0)}
            </span>
          )}
          <span className="max-w-40 truncate">{name}</span>
        </span>
        <span className="hidden gap-4 opacity-70 sm:flex">
          <span>Menu</span>
          <span>About</span>
          <span
            style={{ color: dark ? mix(color, 0.25) : color }}
            className="font-semibold"
          >
            Book
          </span>
        </span>
      </div>
      <div className="px-5 py-7">
        <p
          className="text-xs font-bold tracking-[0.16em] uppercase"
          style={{ color: dark ? mix(color, 0.3) : color }}
        >
          Welcome
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          Good food, shared.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className="inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold text-white"
            style={{ background: button }}
          >
            Book a table
          </span>
          <span
            className="inline-flex h-10 items-center rounded-full border px-5 text-sm font-semibold"
            style={{
              borderColor: dark ? mix(color, 0.25) : color,
              color: dark ? mix(color, 0.3) : color,
            }}
          >
            View menu
          </span>
        </div>
      </div>
    </div>
  );
}

function HoursStep({
  a,
  setAnswers,
  errors,
}: {
  a: OnboardingAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<OnboardingAnswers>>;
  errors: Errors;
}) {
  const setDay = (
    d: Day,
    fn: (h: OnboardingAnswers["hours"][Day]) => OnboardingAnswers["hours"][Day],
  ) =>
    setAnswers((x) => ({ ...x, hours: { ...x.hours, [d]: fn(x.hours[d]) } }));
  const copyToAll = (from: Day) =>
    setAnswers((x) => ({
      ...x,
      hours: Object.fromEntries(
        DAYS.map((d) => [d, JSON.parse(JSON.stringify(x.hours[from]))]),
      ) as OnboardingAnswers["hours"],
    }));

  return (
    <>
      {errors.hours && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {errors.hours}
        </p>
      )}
      <ul className="divide-y divide-[#EFE7DE] rounded-2xl border border-[#E4D9CD]">
        {DAYS.map((d) => {
          const h = a.hours[d];
          return (
            <li
              key={d}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
            >
              <div className="flex items-center justify-between gap-3 sm:w-44 sm:pt-2.5">
                <span className="font-semibold capitalize">{d}</span>
                <Switch
                  checked={!h.closed}
                  onChange={(open) =>
                    setDay(d, (x) => ({
                      closed: !open,
                      shifts: x.shifts.length
                        ? x.shifts
                        : [{ open: "12:00", close: "23:00" }],
                    }))
                  }
                  label={`Open on ${d}`}
                />
              </div>
              <div className="flex-1">
                {h.closed ? (
                  <p className="py-2.5 text-[#8A7D72]">Closed</p>
                ) : (
                  <div className="space-y-2">
                    {h.shifts.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={s.open}
                            onChange={(e) =>
                              setDay(d, (x) => ({
                                ...x,
                                shifts: x.shifts.map((y, j) =>
                                  j === i ? { ...y, open: e.target.value } : y,
                                ),
                              }))
                            }
                            aria-label={`${d} opens`}
                            className={`${INPUT} max-w-36`}
                            aria-invalid={!!errors[`hours.${d}.${i}`]}
                          />
                          <span className="text-[#8A7D72]">to</span>
                          <input
                            type="time"
                            value={s.close}
                            onChange={(e) =>
                              setDay(d, (x) => ({
                                ...x,
                                shifts: x.shifts.map((y, j) =>
                                  j === i ? { ...y, close: e.target.value } : y,
                                ),
                              }))
                            }
                            aria-label={`${d} closes`}
                            className={`${INPUT} max-w-36`}
                            aria-invalid={!!errors[`hours.${d}.${i}`]}
                          />
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDay(d, (x) => ({
                                  ...x,
                                  shifts: x.shifts.filter((_, j) => j !== i),
                                }))
                              }
                              aria-label="Remove this time"
                              className="grid size-10 place-items-center rounded-full text-[#6B5E54] hover:bg-[#F7F2EC]"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                        {errors[`hours.${d}.${i}`] && (
                          <p className="mt-1 text-sm text-red-700">
                            {errors[`hours.${d}.${i}`]}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {h.shifts.length < 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDay(d, (x) => ({
                              ...x,
                              shifts: [
                                ...x.shifts,
                                { open: "18:00", close: "23:00" },
                              ],
                            }))
                          }
                          className="text-sm font-semibold text-[#B4532A] hover:underline"
                        >
                          + Second time (e.g. lunch and dinner)
                        </button>
                      )}
                      {d === "monday" && (
                        <button
                          type="button"
                          onClick={() => copyToAll("monday")}
                          className="text-sm font-semibold text-[#6B5E54] hover:text-[#1C1512] hover:underline"
                        >
                          Copy Monday to every day
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-[#8A7D72]">
        Closing after midnight? Just enter it (for example 18:00 to 02:00).
        Holidays and special days can be set later in your admin panel.
      </p>
    </>
  );
}

function ServicesStep({ a, patch, errors }: StepProps) {
  const s = a.services;
  const togglePay = (p: OnboardingAnswers["services"]["payments"][number]) =>
    patch("services", {
      payments: s.payments.includes(p)
        ? s.payments.filter((x) => x !== p)
        : [...s.payments, p],
    });

  return (
    <>
      <ServiceCard
        icon={<CalendarDays className="size-5" />}
        title="Table reservations"
        hint="Guests book online, you confirm in your admin panel"
        checked={s.reservations}
        onChange={(v) => patch("services", { reservations: v })}
      >
        <Field
          label="Largest party guests can book online"
          hint="Bigger groups call you"
          id="party"
        >
          <input
            id="party"
            type="number"
            min={1}
            max={100}
            value={s.maxPartySize ?? ""}
            onChange={(e) =>
              patch("services", {
                maxPartySize: e.target.value
                  ? Math.max(1, Math.min(100, Number(e.target.value)))
                  : undefined,
              })
            }
            className={`${INPUT} max-w-36`}
          />
        </Field>
      </ServiceCard>

      <ServiceCard
        icon={<Bike className="size-5" />}
        title="Delivery"
        hint="Guests order on your website, you deliver"
        checked={s.delivery}
        onChange={(v) => patch("services", { delivery: v })}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MoneyField
            label="Delivery fee"
            value={s.deliveryFee}
            onChange={(v) => patch("services", { deliveryFee: v })}
            currency={s.currency}
            error={errors["services.deliveryFee"]}
            id="fee"
          />
          <MoneyField
            label="Minimum order"
            hint="Optional"
            value={s.deliveryMinimum}
            onChange={(v) => patch("services", { deliveryMinimum: v })}
            currency={s.currency}
            id="min"
          />
          <MoneyField
            label="Free delivery over"
            hint="Optional"
            value={s.deliveryFreeOver}
            onChange={(v) => patch("services", { deliveryFreeOver: v })}
            currency={s.currency}
            id="free"
          />
        </div>
        <Field
          label="Areas you deliver to"
          hint="Optional: list them, with a different fee if any"
          id="areas"
        >
          <textarea
            id="areas"
            value={s.deliveryAreas}
            onChange={(e) =>
              patch("services", { deliveryAreas: e.target.value })
            }
            rows={3}
            maxLength={600}
            placeholder={
              "Hamra, Verdun, Achrafieh ($3)\nMar Mikhael, Gemmayzeh ($4)"
            }
            className={`${INPUT} h-auto py-3`}
          />
        </Field>
      </ServiceCard>

      <ServiceCard
        icon={<ShoppingBag className="size-5" />}
        title="Pickup"
        hint="Guests order online and collect it"
        checked={s.pickup}
        onChange={(v) => patch("services", { pickup: v })}
      />

      <ServiceCard
        icon={<MessageCircle className="size-5" />}
        title="Ordering on WhatsApp"
        hint="Guests send their order to your WhatsApp, no account needed"
        checked={s.whatsappOrdering}
        onChange={(v) => patch("services", { whatsappOrdering: v })}
      />

      <Group
        label="How guests can pay"
        hint={
          s.delivery || s.pickup ? undefined : "For delivery and pickup orders"
        }
        error={errors["services.payments"]}
      >
        <div className="flex flex-wrap gap-2">
          <Chip
            active={s.payments.includes("cash")}
            onClick={() => togglePay("cash")}
            icon={<Banknote className="size-4" />}
          >
            Cash
          </Chip>
          <Chip
            active={s.payments.includes("card")}
            onClick={() => togglePay("card")}
            icon={<CreditCard className="size-4" />}
          >
            Card online
          </Chip>
          <Chip
            active={s.payments.includes("whish")}
            onClick={() => togglePay("whish")}
            icon={<Wallet className="size-4" />}
          >
            Whish
          </Chip>
        </div>
      </Group>

      <Group label="Prices on your menu are in">
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => (
            <Chip
              key={c}
              active={s.currency === c}
              onClick={() => patch("services", { currency: c })}
            >
              {c}
            </Chip>
          ))}
        </div>
      </Group>
    </>
  );
}

function FinalStep({
  a,
  patch,
  errors,
  menuFiles,
  onMenuFiles,
  onRemoveMenu,
}: StepProps & {
  menuFiles: File[];
  onMenuFiles: (l: FileList | null) => void;
  onRemoveMenu: (i: number) => void;
}) {
  const x = a.extras;
  const p = a.person;
  return (
    <>
      <Group
        label="Your menu"
        hint="A PDF or photos of it, up to 5 files. We add the dishes for you."
      >
        {menuFiles.length > 0 && (
          <ul className="mb-3 space-y-2">
            {menuFiles.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-[#E4D9CD] px-3 py-2.5"
              >
                <FileText className="size-5 shrink-0 text-[#B4532A]" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {f.name}
                </span>
                <span className="text-xs text-[#8A7D72]">
                  {Math.max(1, Math.round(f.size / 1024))} KB
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveMenu(i)}
                  aria-label={`Remove ${f.name}`}
                  className="grid size-8 place-items-center rounded-full text-[#6B5E54] hover:bg-[#F7F2EC]"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {menuFiles.length < MAX_MENU_FILES && (
          <DropZone
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            onFiles={onMenuFiles}
            icon={<FileText className="size-5" />}
            title="Upload your menu"
            hint="PDF, JPG or PNG"
          />
        )}
        <div className="mt-3">
          <input
            value={x.menuLink}
            onChange={(e) => patch("extras", { menuLink: e.target.value })}
            inputMode="url"
            placeholder="Or paste a link to your menu (optional)"
            aria-label="Link to your menu"
            className={INPUT}
            aria-invalid={!!errors["extras.menuLink"]}
          />
          {errors["extras.menuLink"] && (
            <p className="mt-1 text-sm text-red-700">
              {errors["extras.menuLink"]}
            </p>
          )}
        </div>
      </Group>

      <Field
        label="Website address"
        hint="Leave empty if you need one: we'll suggest some"
        id="domain"
      >
        <input
          id="domain"
          value={x.domain}
          onChange={(e) => patch("extras", { domain: e.target.value })}
          inputMode="url"
          placeholder="yourplace.com"
          className={INPUT}
        />
      </Field>

      <Group label="Plan">
        <div className="grid gap-2 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              aria-pressed={x.plan === plan.id}
              onClick={() => patch("extras", { plan: plan.id })}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${x.plan === plan.id ? "border-[#1C1512] ring-1 ring-[#1C1512]" : "border-[#E4D9CD] hover:bg-[#F7F2EC]"}`}
            >
              <span className="block font-semibold">{plan.label}</span>
              <span className="block text-xs text-[#6B5E54]">{plan.hint}</span>
            </button>
          ))}
        </div>
      </Group>

      <Field label="Anything else we should know?" hint="Optional" id="notes">
        <textarea
          id="notes"
          value={x.notes}
          onChange={(e) => patch("extras", { notes: e.target.value })}
          rows={3}
          maxLength={2000}
          placeholder="Websites you like, special requests, branches…"
          className={`${INPUT} h-auto py-3`}
        />
      </Field>

      <div className="rounded-2xl bg-[#F7F2EC] p-5">
        <p className="font-semibold">Who should we talk to?</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Your name" error={errors["person.name"]} id="pname">
            <input
              id="pname"
              value={p.name}
              onChange={(e) => patch("person", { name: e.target.value })}
              autoComplete="name"
              className={`${INPUT} bg-white`}
              aria-invalid={!!errors["person.name"]}
            />
          </Field>
          <Field label="Your role" hint="Optional" id="prole">
            <input
              id="prole"
              value={p.role}
              onChange={(e) => patch("person", { role: e.target.value })}
              placeholder="Owner, manager…"
              className={`${INPUT} bg-white`}
            />
          </Field>
          <Field
            label="Your phone / WhatsApp"
            error={errors["person.phone"]}
            id="pphone"
          >
            <input
              id="pphone"
              value={p.phone}
              onChange={(e) => patch("person", { phone: e.target.value })}
              type="tel"
              autoComplete="tel"
              className={`${INPUT} bg-white`}
              aria-invalid={!!errors["person.phone"]}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function ReviewStep({
  a,
  logo,
  photos,
  menuFiles,
  onEdit,
  consent,
  onConsent,
}: {
  a: OnboardingAnswers;
  logo: { file: File; url: string } | null;
  photos: Photo[];
  menuFiles: File[];
  onEdit: (s: Step) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
}) {
  const s = a.services;
  const openDays = DAYS.filter((d) => !a.hours[d].closed);
  const services =
    [
      s.reservations && "Reservations",
      s.delivery && "Delivery",
      s.pickup && "Pickup",
      s.whatsappOrdering && "WhatsApp ordering",
    ]
      .filter(Boolean)
      .join(" · ") || "Website only";
  const pay = { cash: "Cash", card: "Card", whish: "Whish" };

  return (
    <>
      <ReviewCard title="Your restaurant" onEdit={() => onEdit("restaurant")}>
        <p className="text-lg font-semibold">{a.restaurant.name}</p>
        <p className="text-[#6B5E54]">
          {a.restaurant.cuisine.join(", ")} · {a.restaurant.priceRange}
          {a.restaurant.since && ` · since ${a.restaurant.since}`}
        </p>
        <p className="mt-2 line-clamp-3 text-sm text-[#3D332C]">
          {a.restaurant.description}
        </p>
      </ReviewCard>
      <ReviewCard title="Location & contact" onEdit={() => onEdit("contact")}>
        <p>
          {[a.contact.street, a.contact.area, a.contact.city, a.contact.country]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="text-[#6B5E54]">
          {[
            a.contact.phone,
            a.contact.whatsapp && `WhatsApp ${a.contact.whatsapp}`,
            a.contact.email,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </ReviewCard>
      <ReviewCard title="Look & photos" onEdit={() => onEdit("look")}>
        <div className="flex items-center gap-3">
          <span
            className="size-8 rounded-full ring-1 ring-black/10"
            style={{ background: a.brand.primaryColor }}
          />
          <span className="font-mono text-sm">{a.brand.primaryColor}</span>
          <span className="text-[#6B5E54]">
            · {a.brand.mode === "light" ? "Light" : "Dark"} style
          </span>
        </div>
        <p className="mt-2 text-sm text-[#6B5E54]">
          {logo ? "Logo added" : "No logo yet"} · {photos.length} photo
          {photos.length === 1 ? "" : "s"}
        </p>
      </ReviewCard>
      <ReviewCard title="Opening hours" onEdit={() => onEdit("hours")}>
        <p>
          Open {openDays.length} day{openDays.length === 1 ? "" : "s"} a week
          {openDays.length > 0 && (
            <span className="text-[#6B5E54]">
              {" "}
              · {openDays.map((d) => d.slice(0, 3)).join(", ")}
            </span>
          )}
        </p>
      </ReviewCard>
      <ReviewCard title="Services" onEdit={() => onEdit("services")}>
        <p>{services}</p>
        <p className="text-[#6B5E54]">
          Pay by {s.payments.map((p) => pay[p]).join(", ") || "—"} · prices in{" "}
          {s.currency}
        </p>
      </ReviewCard>
      <ReviewCard title="Menu & details" onEdit={() => onEdit("final")}>
        <p>
          {menuFiles.length} menu file{menuFiles.length === 1 ? "" : "s"}
          {a.extras.menuLink && " · menu link"} ·{" "}
          {a.extras.domain || "needs a domain"} ·{" "}
          {PLANS.find((p) => p.id === a.extras.plan)?.label}
        </p>
        <p className="text-[#6B5E54]">
          {a.person.name} · {a.person.phone}
        </p>
      </ReviewCard>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E4D9CD] p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          className="mt-1 size-5 accent-[#B4532A]"
        />
        <span className="text-sm text-[#3D332C]">
          I confirm these details are correct, and I agree that MESA uses them,
          the photos and the logo to build our website.
        </span>
      </label>
    </>
  );
}

/* ───────────── pieces ───────────── */

const INPUT =
  "h-12 w-full rounded-xl border border-[#E4D9CD] bg-white px-4 text-base text-[#1C1512] outline-none transition placeholder:text-[#B3A69A] focus-visible:border-[#1C1512] focus-visible:ring-4 focus-visible:ring-[#B4532A]/15 aria-[invalid=true]:border-red-600";

function Field({
  label,
  hint,
  error,
  id,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {hint && (
          <span className="text-right text-xs text-[#8A7D72]">{hint}</span>
        )}
      </div>
      {children}
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function Group({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-1 font-semibold">{label}</legend>
      {hint && <p className="mb-3 text-sm text-[#8A7D72]">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-[#1C1512] bg-[#1C1512] text-white" : "border-[#E4D9CD] bg-white hover:bg-[#F7F2EC]"}`}
    >
      {active && !icon ? <Check className="size-3.5" strokeWidth={3} /> : icon}
      {children}
    </button>
  );
}

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Colour ${color}`}
      title={color}
      className={`grid size-11 place-items-center rounded-full transition-transform hover:scale-105 ${active ? "ring-2 ring-[#1C1512] ring-offset-2" : "ring-1 ring-black/10"}`}
      style={{ background: color }}
    >
      {active && (
        <Check className="size-4 text-white drop-shadow" strokeWidth={3} />
      )}
    </button>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-[#B4532A]" : "bg-[#D6C9BB]"}`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

function ServiceCard({
  icon,
  title,
  hint,
  checked,
  onChange,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border transition-colors ${checked ? "border-[#1C1512]/20 bg-white" : "border-[#E4D9CD]"}`}
    >
      <div className="flex items-center gap-4 p-4">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${checked ? "bg-[#B4532A] text-white" : "bg-[#F7F2EC] text-[#6B5E54]"}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-[#6B5E54]">{hint}</span>
        </span>
        <Switch checked={checked} onChange={onChange} label={title} />
      </div>
      {checked && children && (
        <div className="space-y-4 border-t border-[#EFE7DE] p-4">
          {children}
        </div>
      )}
    </div>
  );
}

function MoneyField({
  label,
  hint,
  value,
  onChange,
  currency,
  error,
  id,
}: {
  label: string;
  hint?: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  currency: string;
  error?: string;
  id: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <div className="relative">
        <input
          id={id}
          value={text}
          inputMode="decimal"
          onChange={(e) => {
            const v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
            setText(v);
            onChange(
              v === "" || Number.isNaN(Number(v)) ? undefined : Number(v),
            );
          }}
          className={`${INPUT} pr-14`}
          aria-invalid={!!error}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-sm font-semibold text-[#8A7D72]">
          {currency}
        </span>
      </div>
    </Field>
  );
}

function DropZone({
  accept,
  multiple,
  onFiles,
  icon,
  title,
  hint,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (l: FileList | null) => void;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-6 text-left transition-colors ${over ? "border-[#B4532A] bg-[#B4532A]/5" : "border-[#D6C9BB] hover:border-[#1C1512] hover:bg-[#F7F2EC]"}`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#F7F2EC] text-[#B4532A]">
          {icon}
        </span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-[#6B5E54]">{hint}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E4D9CD] p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold tracking-[0.14em] text-[#8A7D72] uppercase">
          {title}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-[#B4532A] hover:bg-[#F7F2EC]"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      </div>
      {children}
    </section>
  );
}
