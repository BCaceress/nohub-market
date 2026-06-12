import { redirect } from "next/navigation";

/** Canais de venda foram unificados na área Online (side panel). */
export default function ChannelsRedirect() {
  redirect("/app/sales/online");
}
