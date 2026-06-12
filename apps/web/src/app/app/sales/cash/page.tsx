import { redirect } from "next/navigation";

/** Caixa passou a ser acessado pelo painel lateral do PDV. */
export default function CashRedirect() {
  redirect("/app/sales/pos");
}
