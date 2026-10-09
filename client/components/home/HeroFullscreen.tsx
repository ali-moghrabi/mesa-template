import Image from "next/image";

export function HeroFullscreen({ ImageSrc }: { ImageSrc: string }) {
  return (
    <div className="absolute inset-0 -z-10 animate-settle motion-reduce:animate-none">
      <Image
        src={`/${ImageSrc}`}
        alt="hero image"
        preload
        fill
        sizes="100vw"
        className="object-cover"
      />
    </div>
  );
}
