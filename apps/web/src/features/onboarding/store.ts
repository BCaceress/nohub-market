"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SegmentType, StockStructureType } from "@/lib/capabilities";

export interface StoreDraft {
  name: string;
}

export interface OnboardingState {
  step: number;
  organizationId: string | null;

  // Passo 1 — segmento
  segmentType: SegmentType | "";

  // Passo 2 — quantidade lojas
  storeCount: number;

  // Passo 3 — nomes lojas
  stores: StoreDraft[];

  // Passo 4 — estrutura estoque
  stockStructureType: StockStructureType | "";
  centralDcName: string;

  set: (patch: Partial<OnboardingState>) => void;
  reset: () => void;
}

const initial = {
  step: 1,
  organizationId: null,
  segmentType: "" as const,
  storeCount: 1,
  stores: [] as StoreDraft[],
  stockStructureType: "" as const,
  centralDcName: "Centro de Distribuição",
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      reset: () => set(initial),
    }),
    {
      name: "nohub-onboarding-v2",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
