import { z } from "zod";
import { isValidCEP, isValidCNPJ } from "./brazilian";

export const signUpSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo de 8 caracteres"),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "É obrigatório aceitar os Termos e a Política de Privacidade" }),
  }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const addressSchema = z.object({
  zipCode: z.string().refine(isValidCEP, "CEP inválido"),
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().optional(),
  district: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const organizationSchema = z.object({
  document: z.string().refine(isValidCNPJ, "CNPJ inválido"),
  legalName: z.string().min(2),
  tradeName: z.string().optional(),
  taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI"]).optional(),
  cnae: z.string().optional(),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

export const segmentTypeSchema = z.enum(["BEVERAGE_CONVENIENCE", "SUPERMARKET", "UNMANNED_MARKET"]);
export type SegmentTypeInput = z.infer<typeof segmentTypeSchema>;

export const stockStructureTypeSchema = z.enum(["LOCAL", "CENTRAL_DC", "HYBRID"]);
export type StockStructureTypeInput = z.infer<typeof stockStructureTypeSchema>;

export const locationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["STORE", "DC", "HYBRID"]).default("STORE"),
  isSelfService: z.boolean().default(false),
  is24h: z.boolean().default(false),
});
export type LocationInput = z.infer<typeof locationSchema>;

// Result discriminado — server actions não lançam exceções (decisão 15).
export type Result<T> = { success: true; data: T } | { success: false; error: string };
