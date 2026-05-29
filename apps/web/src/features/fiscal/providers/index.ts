/**
 * Registry de providers fiscais.
 * Retorna o provider correto dado o enum FiscalProviderEnum.
 */

import type { FiscalProvider } from "./fiscal-provider";
import { focusNfeProvider } from "./focus-nfe-provider";

export type { FiscalProvider };
export { focusNfeProvider };

export function getProvider(provider: "FOCUS_NFE" | "TECNOSPEED"): FiscalProvider {
  switch (provider) {
    case "FOCUS_NFE":
      return focusNfeProvider;
    case "TECNOSPEED":
      return focusNfeProvider; // TODO: TecnospeedProvider
    default:
      return focusNfeProvider;
  }
}
