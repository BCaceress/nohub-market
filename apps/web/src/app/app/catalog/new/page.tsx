import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getSession } from "@/lib/auth-server";
import { getCapabilities } from "@/lib/capabilities";
import { NewProductClient } from "./new-product-client";

export const metadata = { title: "Novo produto — NoHub Market" };

export default async function NewProductPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [suppliers, caps] = await Promise.all([
    getSuppliersAction(member.organizationId),
    getCapabilities(member.organizationId),
  ]);
  const capabilities = Array.from(caps.keys()).map((key) => ({ key }));

  return (
    <NewProductClient
      organizationId={member.organizationId}
      suppliers={suppliers}
      capabilities={capabilities}
    />
  );
}
