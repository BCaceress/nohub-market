import { redirect } from "next/navigation";

export default function LegacyReturnsPage() {
  redirect("/app/purchasing?view=returns");
}
