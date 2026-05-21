import { getTagsAction } from "@/features/catalog/actions/tag-actions";
import { TagEditor } from "@/features/catalog/components/tag-editor";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { ArrowLeft, Tag } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Tags — NoHub Market" };

export default async function TagsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const tags = await getTagsAction(member.organizationId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Biblioteca de Tags</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Crie e organize tags para classificar e filtrar produtos com precisão.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <TagEditor
        organizationId={member.organizationId}
        tags={
          tags as {
            id: string;
            name: string;
            slug: string;
            group: string;
            color: string | null;
            description: string | null;
            _count: { products: number };
          }[]
        }
      />
    </div>
  );
}
