"use client";

import { createContext, useContext } from "react";

// Mapa de capabilities ativas, injetado pelo layout autenticado.
export const CapabilitiesContext = createContext<Record<string, unknown>>({});

export function useCapability(key: string): boolean {
  const caps = useContext(CapabilitiesContext);
  return key in caps;
}

export function useCapabilityConfig<T = unknown>(key: string): T | null {
  const caps = useContext(CapabilitiesContext);
  return (caps[key] as T) ?? null;
}
