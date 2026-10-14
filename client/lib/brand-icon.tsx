import { ImageResponse } from "next/og";
import { getConfig } from "@/config/loader";

type Colors = {
  primary: string;
  accent: string;
  background: string;
  text: string;
};

function brand(): { initial: string; colors: Colors } {
  const config = getConfig() as unknown as {
    brand: { name: string; monogram?: string };
    theme?: { colors?: { light?: Partial<Colors> } };
  };
  const light = config.theme?.colors?.light ?? {};
  const hex = (v: string | undefined, fallback: string) =>
    v && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  const initial = (
    config.brand.monogram?.trim() ||
    config.brand.name.trim().charAt(0) ||
    "R"
  )
    .slice(0, 2)
    .toUpperCase();
  return {
    initial,
    colors: {
      primary: hex(light.primary, "#B4532A"),
      accent: hex(light.accent, "#E0A458"),
      background: hex(light.background, "#FBF7F2"),
      text: hex(light.text, "#1F1B16"),
    },
  };
}

export function brandIcon(size: number, variant: "site" | "admin" = "site") {
  const { initial, colors } = brand();
  const s = (n: number) => Math.round((n / 64) * size);
  const admin = variant === "admin";
  const two = initial.length > 1;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: admin ? colors.text : colors.primary,
        borderRadius: s(15),
      }}
    >
      <div
        style={{
          width: s(48),
          height: s(48),
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: admin ? "transparent" : colors.background,
          border: admin
            ? `${s(4)}px solid ${colors.primary}`
            : `${s(3)}px solid rgba(255,255,255,0.35)`,
          color: admin ? colors.background : colors.primary,
          fontSize: s(two ? (admin ? 18 : 21) : 30),
          fontWeight: 800,
          letterSpacing: two ? -s(1) : 0,
          lineHeight: 1,
        }}
      >
        {initial}
      </div>
      {admin && (
        <div
          style={{
            position: "absolute",
            top: s(5),
            right: s(5),
            width: s(16),
            height: s(16),
            borderRadius: "50%",
            background: colors.accent,
            border: `${s(3)}px solid ${colors.text}`,
            display: "flex",
          }}
        />
      )}
    </div>,
    { width: size, height: size },
  );
}
