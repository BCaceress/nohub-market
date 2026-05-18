"use client";

import { CapabilitiesContext } from "@/lib/use-capability";

export function CapabilitiesProvider({
  value,
  children,
}: {
  value: Record<string, unknown>;
  children: React.ReactNode;
}) {
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
}
