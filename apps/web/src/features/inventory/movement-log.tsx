"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Movement = {
  id: string;
  type: string;
  quantity: number | string;
  previousQty: number | string;
  newQty: number | string;
  notes: string | null;
  userName: string | null;
  createdAt: Date | string;
  product: { id: string; name: string; unit: string };
  location: { id: string; name: string };
};

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    variant: "success" | "destructive" | "info" | "warning" | "secondary";
    icon: React.ReactNode;
  }
> = {
  IN: {
    label: "Entrada",
    variant: "success",
    icon: <ArrowDownToLine className="h-3 w-3" />,
  },
  OUT: {
    label: "Saída",
    variant: "secondary",
    icon: <ArrowUpFromLine className="h-3 w-3" />,
  },
  LOSS: {
    label: "Perda",
    variant: "destructive",
    icon: <Trash2 className="h-3 w-3" />,
  },
  TRANSFER_IN: {
    label: "Transferência entrada",
    variant: "info",
    icon: <ArrowLeftRight className="h-3 w-3" />,
  },
  TRANSFER_OUT: {
    label: "Transferência saída",
    variant: "info",
    icon: <ArrowLeftRight className="h-3 w-3" />,
  },
  ADJUSTMENT: {
    label: "Inventário",
    variant: "warning",
    icon: <ClipboardList className="h-3 w-3" />,
  },
};

function formatQty(n: number | string, unit: string) {
  return `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit}`;
}

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "há poucos segundos";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function MovementLog({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Anterior → Novo</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty
            icon={<TrendingDown className="h-5 w-5 text-muted-foreground" />}
            title="Nenhuma movimentação"
            description="As movimentações de estoque aparecerão aqui."
          />
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead className="text-right">Quantidade</TableHead>
          <TableHead className="text-right">Anterior → Novo</TableHead>
          <TableHead>Observação</TableHead>
          <TableHead>Por</TableHead>
          <TableHead>Quando</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((m) => {
          const cfg = TYPE_CONFIG[m.type] ?? {
            label: m.type,
            variant: "secondary" as const,
            icon: null,
          };
          return (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.product.name}</TableCell>
              <TableCell>
                <Badge variant={cfg.variant} className="gap-1">
                  {cfg.icon}
                  {cfg.label}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{m.location.name}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatQty(m.quantity, m.product.unit)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {Number(m.previousQty).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                {" → "}
                {Number(m.newQty).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs max-w-[140px] truncate">
                {m.notes ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">{m.userName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {timeAgo(m.createdAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
