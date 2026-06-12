import { redirect } from "next/navigation";

export default function LegacyOrdersPage() {
  redirect("/app/purchasing?view=orders");
}
