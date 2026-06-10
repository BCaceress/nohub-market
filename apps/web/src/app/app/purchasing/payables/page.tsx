import { redirect } from "next/navigation";

export default function LegacyPayablesPage() {
  redirect("/app/financeiro#pagar");
}
