import { Bricolage_Grotesque, Instrument_Serif } from "next/font/google";
import { cn } from "@/lib/utils";
import "./hero.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-hero",
  display: "swap",
});
const accent = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-hero-accent",
  display: "swap",
});

export const displayFonts = cn(display.variable, accent.variable);

export type TitleWord = { text: string; accent: boolean };

export function parseTitle(title: string): { words: TitleWord[]; end: string } {
  let text = title.trim();
  const endMatch = /[.!]$/.exec(text.replace(/\*+$/, ""));
  const end = endMatch ? endMatch[0] : "";
  if (end) text = text.replace(/[.!](\**)$/, "$1");

  const words: TitleWord[] = [];
  if (text.includes("*")) {
    text.split("*").forEach((part, i) => {
      for (const word of part.trim().split(/\s+/).filter(Boolean))
        words.push({ text: word, accent: i % 2 === 1 });
    });
  } else {
    const all = text.split(/\s+/).filter(Boolean);
    all.forEach((word, i) =>
      words.push({
        text: word,
        accent: all.length > 1 && i === all.length - 1,
      }),
    );
  }
  return { words, end };
}

export const plainTitle = (title: string) => title.replace(/\*/g, "");

export function DisplayTitle({
  title,
  as: Tag = "h2",
  id,
  tone = "photo",
  className,
}: {
  title: string;
  as?: "h1" | "h2" | "h3";
  id?: string;
  tone?: "photo" | "light";
  className?: string;
}) {
  const { words, end } = parseTitle(title);
  return (
    <Tag
      id={id}
      aria-label={plainTitle(title)}
      className={cn(
        "hero-title text-balance",
        tone === "light" && "hero-title-light",
        className,
      )}
    >
      {words.map((word, i) => {
        const last = i === words.length - 1;
        return (
          <span key={i} aria-hidden="true">
            <span className={word.accent ? "hero-accent" : undefined}>
              {word.text}
              {last && end ? <span className="hero-end">{end}</span> : null}
            </span>
            {last ? null : " "}
          </span>
        );
      })}
    </Tag>
  );
}
