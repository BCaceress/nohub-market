"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateChannelConfigAction } from "./actions/channel-actions";

type ChannelType = "WHATSAPP" | "IFOOD" | "MERCADO_LIVRE" | "RAPPI" | "OWN_ECOMMERCE" | "OTHER";

const CONFIG_FIELDS: Record<ChannelType, { key: string; label: string; placeholder: string }[]> = {
  WHATSAPP: [
    { key: "phone", label: "Número do WhatsApp", placeholder: "+55 11 91234-5678" },
    { key: "catalogUrl", label: "Link do catálogo (opcional)", placeholder: "https://wa.me/c/..." },
  ],
  IFOOD: [
    { key: "storeId", label: "ID da loja no iFood", placeholder: "00000000-0000-0000-0000-000000000000" },
    { key: "storeUrl", label: "URL da loja", placeholder: "https://www.ifood.com.br/delivery/..." },
  ],
  MERCADO_LIVRE: [
    { key: "sellerId", label: "ID do vendedor", placeholder: "123456789" },
    { key: "storeUrl", label: "URL da loja", placeholder: "https://www.mercadolivre.com.br/perfil/..." },
  ],
  RAPPI: [
    { key: "storeId", label: "ID da loja no Rappi", placeholder: "rappi123" },
  ],
  OWN_ECOMMERCE: [
    { key: "domain", label: "Domínio do e-commerce", placeholder: "loja.suaempresa.com.br" },
    { key: "platform", label: "Plataforma (ex: Shopify, WooCommerce)", placeholder: "Shopify" },
  ],
  OTHER: [
    { key: "webhookUrl", label: "URL de integração (webhook)", placeholder: "https://..." },
    { key: "notes", label: "Observações", placeholder: "Ex: integração com ERP..." },
  ],
};

export function ChannelConfigDialog({
  organizationId,
  channelId,
  channelType,
  currentConfig,
}: {
  organizationId: string;
  channelId: string;
  channelType: string;
  currentConfig?: Record<string, string> | null;
}) {
  const [open, setOpen] = useState(false);
  const fields = CONFIG_FIELDS[channelType as ChannelType] ?? CONFIG_FIELDS.OTHER;
  const [form, setForm] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.key, currentConfig?.[f.key] ?? ""])),
  );
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const res = await updateChannelConfigAction(organizationId, channelId, form);
    setSaving(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Configuração salva!");
    setOpen(false);
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        <span className="sr-only">Configurar</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Configurar canal</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label>{f.label}</Label>
                <Input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
