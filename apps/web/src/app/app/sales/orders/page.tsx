import { redirect } from "next/navigation";

/** Pedidos foi unificado na área Online. */
export default function OrdersRedirect() {
  redirect("/app/sales/online");
}
