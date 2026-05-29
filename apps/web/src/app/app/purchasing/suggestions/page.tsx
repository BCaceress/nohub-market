/**
 * Sugestões de Compra — revisar, converter ou descartar.
 */

import { redirect } from "next/navigation";
import {
  listLocationsAction,
  listSuggestionsAction,
} from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { SuggestionsClient } from "./suggestions-client";

export const metadata = { title: "Sugestões de Compra — NoHub Market" };

export default async function SuggestionsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const [suggestions, locations] = await Promise.all([
    listSuggestionsAction(),
    listLocationsAction(),
  ]);

  return <SuggestionsClient suggestions={suggestions} locations={locations} />;
}
