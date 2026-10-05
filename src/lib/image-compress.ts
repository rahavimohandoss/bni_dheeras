/**
 * Shrinks a picked image in the browser before upload: longest side capped at
 * `maxSide`, encoded as WebP (or JPEG where the browser can't encode WebP,
 * e.g. older Safari). Typical phone photos go from 3–5 MB to ~100–250 KB.
 */
export async function compressImage(file: File, maxSide = 800, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("This image format isn't supported. Use JPG or PNG.");
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Couldn't process this image.");
  return jpeg;
}
