/**
 * Importação de NFe — upload de XML, mapeamento de itens e confirmação.
 */

import {
  listLocationsAction,
  listNfeImportsAction,
} from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { NfeImportClient } from "./nfe-import-client";

export const metadata = { title: "Importar NFe — NoHub Market" };

export default async function NfeImportPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const [imports, locations] = await Promise.all([listNfeImportsAction(), listLocationsAction()]);

  return <NfeImportClient imports={imports} locations={locations} />;
}
