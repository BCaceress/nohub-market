import { redirect } from "next/navigation";

export default async function LegacyReceivePage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  const { poId } = await searchParams;
  redirect(poId ? `/app/purchasing?receive=${poId}` : "/app/purchasing");
}
