"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Order = {
  id: string;
  channel: string;
  status: string;
  total: number;
  externalId: string | null;
  createdAt: Date | string;
  customer: { name: string | null; phone: string | null } | null;
  payments: Array<{ method: string; amount: number; status: string }>;
  items: Array<{ productNameSnapshot: string; quantity: number; lineTotal: number }>;
  _count: { items: number };
};

type Props = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  organizationId: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PAID: "default",
  FULFILLED: "outline",
  COMPLETED: "default",
  CANCELED: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  PAID: "Pago",
  FULFILLED: "Despachado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

const CHANNEL_LABELS: Record<string, string> = {
  POS: "PDV",
  SELF_SERVICE: "Self-service",
  IFOOD: "iFood",
  WHATSAPP: "WhatsApp",
  MERCADO_LIVRE: "Mercado Livre",
};

const ALL_STATUSES = ["DRAFT", "CONFIRMED", "PAID", "FULFILLED", "COMPLETED", "CANCELED"];
const ALL_CHANNELS = ["POS", "SELF_SERVICE", "IFOOD", "WHATSAPP", "MERCADO_LIVRE"];

export function OrdersClient({ orders, total, page, pageSize, totalPages }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const pushParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const currentStatus = searchParams.get("status") ?? "";
  const currentChannel = searchParams.get("channel") ?? "";

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por ID ou cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushParams({ search: search || undefined, page: undefined });
            }}
          />
        </div>

        <Select
          className="w-40"
          value={currentStatus || ""}
          onChange={(e) => pushParams({ status: e.target.value || undefined, page: undefined })}
        >
          <option value="">Todos os status</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </Select>

        <Select
          className="w-44"
          value={currentChannel || ""}
          onChange={(e) => pushParams({ channel: e.target.value || undefined, page: undefined })}
        >
          <option value="">Todos os canais</option>
          {ALL_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c] ?? c}
            </option>
          ))}
        </Select>

        {(currentStatus || currentChannel || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              pushParams({
                status: undefined,
                channel: undefined,
                search: undefined,
                page: undefined,
              });
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/app/sales/orders/${order.id}`)}
                >
                  <TableCell className="font-mono text-xs">
                    {order.id.slice(0, 8)}
                    {order.externalId && (
                      <span className="ml-1 text-muted-foreground">
                        #{order.externalId.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CHANNEL_LABELS[order.channel] ?? order.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.customer?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span title={order.items.map((i) => i.productNameSnapshot).join(", ")}>
                      {order._count.items} item{order._count.items !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {order.total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={(STATUS_COLORS[order.status] as never) ?? "secondary"}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => pushParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => pushParams({ page: String(page + 1) })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
