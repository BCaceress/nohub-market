import { cookies } from "next/headers";
import {
  ALL_LOCATIONS,
  SELECTED_LOCATION_COOKIE,
  type SelectedLocation,
} from "./selected-location";

export async function readSelectedLocation(
  validIds: string[],
  fallback: string = ALL_LOCATIONS,
): Promise<SelectedLocation> {
  const store = await cookies();
  const raw = store.get(SELECTED_LOCATION_COOKIE)?.value;
  if (!raw) return fallback;
  if (raw === ALL_LOCATIONS) return ALL_LOCATIONS;
  if (validIds.includes(raw)) return raw;
  return fallback;
}
