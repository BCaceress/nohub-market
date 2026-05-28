/**
 * Cloudinary unsigned image upload.
 *
 * Required env vars (public — inlined at build time):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME      cloud name from the Cloudinary dashboard
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET   name of an *unsigned* upload preset
 *
 * Create the preset at: Settings → Upload → Upload presets → Add → Signing mode: Unsigned.
 * When the vars are absent the UI falls back to manual URL entry.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** 5 MB — keeps catalog images light. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/** Uploads a single image file to Cloudinary, returns the secure HTTPS URL. */
export async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Upload de imagem não configurado (Cloudinary).");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const detail = await res
      .json()
      .then((j: { error?: { message?: string } }) => j.error?.message)
      .catch(() => null);
    throw new Error(detail ?? `Falha no upload (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error("Resposta inválida do Cloudinary.");
  return json.secure_url;
}
