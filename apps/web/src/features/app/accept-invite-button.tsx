"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "./actions/invite-actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    const res = await acceptInvitationAction(token);
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Bem-vindo à ${res.data.orgName}!`);
    router.push("/app");
  }

  return (
    <Button className="w-full" onClick={accept} disabled={loading}>
      {loading ? "Aceitando..." : "Aceitar convite"}
    </Button>
  );
}
