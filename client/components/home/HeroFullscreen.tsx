import Image from "next/image";

export function HeroFullscreen({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <Image
      src={`/${src}`}
      alt="hero background"
      preload
      fill
      sizes="100vw"
      className="object-cover"
    />
  );
}
