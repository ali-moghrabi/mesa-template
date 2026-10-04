import type { SiteConfig } from "@/config/./schema";

type Theme = SiteConfig["theme"];
type Colors = Theme["colors"]["light"];

const mix = (a: string, b: string, pct: number) =>
  `color-mix(in srgb, ${a}, ${b} ${pct}%)`;

function colorVars(c: Colors): Record<string, string> {
  const border = c.border ?? mix(c.background, c.text, 12);

  return {
    "--background": c.background,
    "--primary": c.primary,
    "--secondary": c.secondary ?? mix(c.background, c.text, 6),
    "--muted": mix(c.background, c.text, 6),
    "--accent": c.accent,
    "--border": border,
    "--text": c.text,
  };
}

const toDecls = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");

export function generateThemeCss(theme: Theme): string {
  let css = `:root{${toDecls(colorVars(theme.colors.light))}}`;
  if (theme.colors.dark)
    css += `.dark{${toDecls(colorVars(theme.colors.dark))}}`;
  return css;
}
