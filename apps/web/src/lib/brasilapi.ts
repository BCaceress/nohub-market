import "server-only";
import { onlyDigits } from "@nohub/shared/brazilian";
import { getEnv } from "@nohub/shared/env";

const { BRASILAPI_URL } = getEnv();

export interface CnpjData {
  legalName: string;
  tradeName?: string;
  cnae?: string;
  taxRegime?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
}

export interface CepData {
  street?: string;
  district?: string;
  city?: string;
  state?: string;
}

// Falha de consulta NÃO bloqueia (fallback manual — decisão 14).
export async function lookupCnpj(raw: string): Promise<CnpjData | null> {
  const cnpj = onlyDigits(raw);
  try {
    const res = await fetch(`${BRASILAPI_URL}/cnpj/v1/${cnpj}`, {
      next: { revalidate: 60 * 60 * 24 }, // cache 24h
    });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      legalName: d.razao_social ?? "",
      tradeName: d.nome_fantasia || undefined,
      cnae: d.cnae_fiscal ? String(d.cnae_fiscal) : undefined,
      zipCode: d.cep ? onlyDigits(String(d.cep)) : undefined,
      street: d.logradouro || undefined,
      number: d.numero || undefined,
      district: d.bairro || undefined,
      city: d.municipio || undefined,
      state: d.uf || undefined,
    };
  } catch {
    return null;
  }
}

export async function lookupCep(raw: string): Promise<CepData | null> {
  const cep = onlyDigits(raw);
  try {
    const res = await fetch(`${BRASILAPI_URL}/cep/v2/${cep}`, {
      next: { revalidate: 60 * 60 * 24 * 7 }, // cache 7 dias
    });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      street: d.street || undefined,
      district: d.neighborhood || undefined,
      city: d.city || undefined,
      state: d.state || undefined,
    };
  } catch {
    return null;
  }
}
