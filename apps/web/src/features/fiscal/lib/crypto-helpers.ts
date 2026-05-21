/**
 * crypto-helpers — cifra/decifra certificados A1, senhas e credenciais.
 *
 * Algoritmo: AES-256-GCM (autenticado — detecta adulteração).
 * Chave: derivada de FISCAL_ENCRYPTION_KEY (env, 32 bytes hex).
 *
 * SEGURANÇA (RN-F08):
 * - Senha do certificado NUNCA aparece em log/response.
 * - Cada cifra tem IV aleatório de 12 bytes armazenado junto.
 * - Em produção, FISCAL_ENCRYPTION_KEY deve ser gerenciada por KMS.
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // bytes — recomendado para GCM
const TAG_LENGTH = 16; // bytes — auth tag GCM

function getKey(): Buffer {
  const hexKey = process.env.FISCAL_ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    // Dev fallback: chave derivada de NEXTAUTH_SECRET (nunca em produção)
    const secret = process.env.BETTER_AUTH_SECRET ?? "dev-fallback-fiscal-key-insecure";
    return crypto.createHash("sha256").update(secret).digest();
  }
  return Buffer.from(hexKey, "hex");
}

/* ── Cifra genérica (bytes) ───────────────────────────────────── */

export function encryptBytes(plaintext: Buffer): { encrypted: Buffer; iv: Buffer } {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: [encrypted][tag (16 bytes)]
  return { encrypted: Buffer.concat([encrypted, tag]), iv };
}

export function decryptBytes(encrypted: Buffer, iv: Buffer): Buffer {
  const key = getKey();
  const tag = encrypted.slice(encrypted.length - TAG_LENGTH);
  const data = encrypted.slice(0, encrypted.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Cifra bytes com IV explícito (para cifrar múltiplos payloads com o mesmo IV,
 * como pfx + senha do certificado).
 */
export function encryptBytesWithIv(plaintext: Buffer, iv: Buffer): Buffer {
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([encrypted, tag]);
}

/* ── Cifra de string (JSON de credenciais) ───────────────────── */

export function encryptString(plaintext: string): { encrypted: Buffer; iv: Buffer } {
  return encryptBytes(Buffer.from(plaintext, "utf8"));
}

export function decryptString(encrypted: Buffer, iv: Buffer): string {
  return decryptBytes(encrypted, iv).toString("utf8");
}

/* ── Helpers específicos do domínio fiscal ───────────────────── */

export type DecryptCertificateResult =
  | { success: true; pfxBase64: string; password: string }
  | { success: false; error: string };

export function decryptCertificate(
  encryptedPfx: Buffer,
  encryptedPassword: Buffer,
  iv: Buffer,
): DecryptCertificateResult {
  try {
    const pfxBytes = decryptBytes(encryptedPfx, iv);
    const passwordBytes = decryptBytes(encryptedPassword, iv);
    return {
      success: true,
      pfxBase64: pfxBytes.toString("base64"),
      password: passwordBytes.toString("utf8"),
    };
  } catch (err) {
    return { success: false, error: `Falha ao decifrar certificado: ${String(err)}` };
  }
}

export function decryptCredentials(
  encryptedCredentials: Buffer,
  iv?: Buffer,
): Record<string, unknown> | null {
  try {
    // Se IV for fornecido separadamente, usa; senão assume que está embutido
    // Para FiscalConfig.providerCredentials, IV é salvo no mesmo campo (primeiros 12 bytes)
    let ivBuf: Buffer;
    let dataBuf: Buffer;
    if (iv) {
      ivBuf = iv;
      dataBuf = encryptedCredentials;
    } else {
      // IV embutido: primeiros IV_LENGTH bytes
      ivBuf = encryptedCredentials.slice(0, IV_LENGTH);
      dataBuf = encryptedCredentials.slice(IV_LENGTH);
    }
    const json = decryptString(dataBuf, ivBuf);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function encryptCredentials(credentials: Record<string, unknown>): Buffer {
  const json = JSON.stringify(credentials);
  const { encrypted, iv } = encryptString(json);
  // Embutir IV no início para simplificar armazenamento em campo único
  return Buffer.concat([iv, encrypted]);
}
