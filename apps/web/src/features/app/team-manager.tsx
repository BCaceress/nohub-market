"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Trash2, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "./actions/team-actions";
import { sendInvitationAction, cancelInvitationAction } from "./actions/invite-actions";

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Gerente",
  operator: "Operador",
  viewer: "Visualizador",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  owner: "default",
  admin: "secondary",
  manager: "secondary",
  operator: "outline",
  viewer: "outline",
};

export function TeamManager({
  organizationId,
  currentUserId,
  initialMembers,
  initialInvitations = [],
}: {
  organizationId: string;
  currentUserId: string;
  initialMembers: Member[];
  initialInvitations?: Invitation[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [pendingInvitations, setPendingInvitations] = useState(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "operator" | "viewer">("operator");
  const [inviteByEmail, setInviteByEmail] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const res = inviteByEmail
      ? await sendInvitationAction(organizationId, inviteEmail.trim(), inviteRole)
      : await inviteMemberAction(organizationId, inviteEmail.trim(), inviteRole);
    setInviting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(inviteByEmail ? "Convite enviado por e-mail!" : "Membro adicionado!");
    setInviteOpen(false);
    setInviteEmail("");
    window.location.reload();
  }

  async function handleRoleChange(memberId: string, role: string) {
    const res = await updateMemberRoleAction(
      organizationId,
      memberId,
      role as "admin" | "manager" | "operator" | "viewer",
    );
    if (!res.success) {
      toast.error(res.error);
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
      );
    }
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    const res = await removeMemberAction(organizationId, memberId);
    setRemoving(null);
    if (!res.success) {
      toast.error(res.error);
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Membro removido");
    }
  }

  async function handleCancelInvite(id: string) {
    const res = await cancelInvitationAction(organizationId, id);
    if (!res.success) { toast.error(res.error); return; }
    setPendingInvitations((prev) => prev.filter((i) => i.id !== id));
    toast.success("Convite cancelado");
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{members.length} membro(s)</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setInviteByEmail(true); setInviteOpen(true); }}>
            <Mail className="mr-2 h-4 w-4" />
            Convidar por e-mail
          </Button>
          <Button size="sm" onClick={() => { setInviteByEmail(false); setInviteOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar existente
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border">
        {members.map((m, i) => (
          <div
            key={m.id}
            className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
            </div>
            <Badge variant={ROLE_VARIANTS[m.role] ?? "outline"}>
              {ROLE_LABELS[m.role] ?? m.role}
            </Badge>
            {m.role !== "owner" && m.user.id !== currentUserId && (
              <div className="flex items-center gap-2">
                <Select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  className="h-8 w-36 text-xs"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(m.id)}
                  disabled={removing === m.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Convites pendentes */}
      {pendingInvitations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Convites pendentes</p>
          <div className="rounded-lg border">
            {pendingInvitations.map((inv, i) => (
              <div key={inv.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t" : ""}`}>
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role] ?? inv.role} · expira {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="warning">Pendente</Badge>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCancelInvite(inv.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent onClose={() => setInviteOpen(false)}>
          <DialogHeader>
            <DialogTitle>{inviteByEmail ? "Convidar por e-mail" : "Adicionar membro"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="colaborador@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <p className="text-xs text-muted-foreground">
                {inviteByEmail
                  ? "Um e-mail com link de convite será enviado. O usuário não precisa ter conta ainda."
                  : "O usuário deve ter conta no NoHub Market."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Papel</Label>
              <Select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as typeof inviteRole)
                }
              >
                <option value="admin">Admin</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
