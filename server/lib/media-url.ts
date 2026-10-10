const S3_FOLDERS = ['menu/', 'tmp/'];

export const keyPrefix = () => normalizePrefix(process.env.S3_KEY_PREFIX);

export function normalizePrefix(prefix: string | undefined): string {
  const clean = (prefix ?? '').trim().replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/` : '';
}

export function mediaUrl(image: string | undefined | null): string | undefined {
  if (!image) return undefined;
  if (/^https?:\/\//i.test(image)) return image;
  if (!S3_FOLDERS.some((folder) => image.startsWith(folder))) return image;
  const base = (process.env.MEDIA_BASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/${keyPrefix()}${image}`;
}
