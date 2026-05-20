"use client";

import { useState } from "react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Step = "idle" | "show-qr" | "confirm" | "disable";

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Better Auth 2FA client (cast para contornar divergências de tipo entre versões)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tfa = (authClient as any).twoFactor as {
    getTotpUri: (p: { password: string }) => Promise<{ data?: { totpURI?: string }; error?: { message?: string } }>;
    enable: (p: { code: string }) => Promise<{ data?: { backupCodes?: string[] }; error?: { message?: string } }>;
    disable: (p: { password: string }) => Promise<{ error?: { message?: string } }>;
  };

  async function handleEnable() {
    if (!password) { toast.error("Digite sua senha"); return; }
    setLoading(true);
    const res = await tfa.getTotpUri({ password });
    setLoading(false);
    if (res.error) { toast.error(res.error.message ?? "Erro ao gerar QR"); return; }
    setTotpUri(res.data?.totpURI ?? "");
    setStep("show-qr");
  }

  async function handleConfirmEnable() {
    if (code.length < 6) { toast.error("Digite o código de 6 dígitos"); return; }
    setLoading(true);
    const res = await tfa.enable({ code });
    setLoading(false);
    if (res.error) { toast.error(res.error.message ?? "Código inválido"); return; }
    setBackupCodes(res.data?.backupCodes ?? []);
    toast.success("Autenticação de dois fatores ativada!");
    setStep("idle");
    setPassword("");
    setCode("");
    window.location.reload();
  }

  async function handleDisable() {
    if (!password) { toast.error("Digite sua senha"); return; }
    setLoading(true);
    const res = await tfa.disable({ password });
    setLoading(false);
    if (res.error) { toast.error(res.error.message ?? "Erro ao desativar"); return; }
    toast.success("2FA desativado.");
    setStep("idle");
    setPassword("");
    window.location.reload();
  }

  function reset() {
    setStep("idle");
    setPassword("");
    setCode("");
    setTotpUri("");
    setBackupCodes([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {enabled ? (
          <ShieldCheck className="h-5 w-5 text-green-600" />
        ) : (
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div className="flex-1">
          <p className="font-medium text-sm">Autenticação de dois fatores</p>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Sua conta está protegida com 2FA (TOTP)."
              : "Adicione uma camada extra de segurança ao fazer login."}
          </p>
        </div>
        <Badge variant={enabled ? "success" : "outline"}>
          {enabled ? "Ativo" : "Inativo"}
        </Badge>
        <Button
          size="sm"
          variant={enabled ? "outline" : "default"}
          onClick={() => setStep(enabled ? "disable" : "show-qr")}
        >
          {enabled ? "Desativar" : "Ativar 2FA"}
        </Button>
      </div>

      {/* Ativar — passo 1: senha + QR code */}
      <Dialog open={step === "show-qr"} onOpenChange={(v) => !v && reset()}>
        <DialogContent onClose={reset}>
          <DialogHeader>
            <DialogTitle>Ativar autenticação de dois fatores</DialogTitle>
            <DialogDescription>
              {totpUri
                ? "Escaneie o QR code com o Google Authenticator ou Authy."
                : "Digite sua senha para gerar o QR code."}
            </DialogDescription>
          </DialogHeader>

          {!totpUri ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEnable()}
                  placeholder="••••••••"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={reset}>Cancelar</Button>
                <Button onClick={handleEnable} disabled={loading || !password}>
                  {loading ? "Gerando..." : "Gerar QR code"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-lg border p-3 bg-white">
                <QRCode value={totpUri} size={180} />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Após escanear, o aplicativo exibirá um código de 6 dígitos renovado a cada 30 segundos.
              </p>
              <div className="w-full flex flex-col gap-2">
                <Label>Código de verificação</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmEnable()}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              <DialogFooter className="w-full">
                <Button variant="outline" onClick={reset}>Cancelar</Button>
                <Button onClick={handleConfirmEnable} disabled={loading || code.length < 6}>
                  {loading ? "Verificando..." : "Confirmar e ativar"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {backupCodes.length > 0 && (
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="font-medium mb-1">Códigos de backup (guarde em local seguro):</p>
              <div className="grid grid-cols-2 gap-1 font-mono">
                {backupCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Desativar */}
      <Dialog open={step === "disable"} onOpenChange={(v) => !v && reset()}>
        <DialogContent onClose={reset}>
          <DialogHeader>
            <DialogTitle>Desativar autenticação de dois fatores</DialogTitle>
            <DialogDescription>
              Confirme sua senha para desativar o 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Senha atual</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDisable()}
                placeholder="••••••••"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={loading || !password}
              >
                {loading ? "Desativando..." : "Desativar 2FA"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
