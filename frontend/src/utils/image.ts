export function compressedSize(w: number, h: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export class ImageError extends Error {}

/**
 * Downscales and re-encodes a photo to JPEG before upload. A typical 4 MB phone
 * photo becomes ~150–350 KB, which matters on slow, metered connections.
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<{ blob: Blob; width: number; height: number; originalBytes: number }> {
  if (!ALLOWED.includes(file.type)) throw new ImageError('type');
  if (file.size > 15 * 1024 * 1024) throw new ImageError('size');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageError('decode'));
      el.src = url;
    });
    const { width, height } = compressedSize(img.naturalWidth, img.naturalHeight, maxEdge);
    if (width < 200 || height < 100) throw new ImageError('small');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('decode');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new ImageError('decode');
    return { blob, width, height, originalBytes: file.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
