"use client";

import type { ProductCategory } from "@/lib/capabilities";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface LocationDraft {
  name: string;
  type: "STORE" | "DC" | "HYBRID";
  isSelfService: boolean;
  is24h: boolean;
}

export interface OnboardingState {
  step: number;
  organizationId: string | null;

  // Passo 1/2 — negócio
  document: string;
  legalName: string;
  tradeName: string;
  cnae: string;
  taxRegime: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;

  // Passo 3 — operação
  businessType: "UNMANNED_MARKET" | "CONVENIENCE" | "BEVERAGE" | "HYBRID" | "";
  salesChannels: string[];
  productCategories: ProductCategory[];

  // Passo 4 — estrutura
  locations: LocationDraft[];

  // Passo 5 — catálogo
  catalogMethod: "template" | "spreadsheet" | "manual" | "";

  // Passo 6 — finalizar
  nfceEnabled: boolean;
  paymentMethods: string[];

  set: (patch: Partial<OnboardingState>) => void;
  reset: () => void;
}

const initial = {
  step: 1,
  organizationId: null,
  document: "",
  legalName: "",
  tradeName: "",
  cnae: "",
  taxRegime: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  businessType: "" as const,
  salesChannels: [] as string[],
  productCategories: [] as ProductCategory[],
  locations: [] as LocationDraft[],
  catalogMethod: "" as const,
  nfceEnabled: false,
  paymentMethods: [] as string[],
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      reset: () => set(initial),
    }),
    {
      name: "nohub-onboarding",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
