const UPLOAD_MAX_SIDE = 2400;
const SEND_AS_IS_BYTES = 1.5 * 1024 * 1024;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PICK_BYTES = 40 * 1024 * 1024;

export async function prepareImage(file: File): Promise<File> {
  const webFriendly = ["image/jpeg", "image/png", "image/webp"].includes(
    file.type,
  );
  if (webFriendly && file.size <= SEND_AS_IS_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(
    1,
    UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const mayHaveAlpha =
    file.type === "image/png" ||
    file.type === "image/webp" ||
    file.type === "image/gif";
  const encode = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );

  let blob = mayHaveAlpha
    ? await encode("image/webp", 0.92)
    : await encode("image/jpeg", 0.9);
  if (mayHaveAlpha && blob?.type !== "image/webp")
    blob = await encode("image/png");
  if (!blob || (webFriendly && blob.size >= file.size)) return file;

  const extension = blob.type.split("/")[1] ?? "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
