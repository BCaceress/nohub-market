"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { MovementLog } from "@/features/inventory/movement-log";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

type Location = { id: string; name: string };

const MOVEMENT_TYPES = [
  { value: "", label: "Todos os tipos" },
  { value: "IN", label: "Entradas" },
  { value: "OUT", label: "Saídas" },
  { value: "LOSS", label: "Perdas" },
  { value: "TRANSFER_IN", label: "Transf. recebidas" },
  { value: "TRANSFER_OUT", label: "Transf. enviadas" },
  { value: "ADJUSTMENT", label: "Inventários" },
];

interface Props {
  movements: Movement[];
  locations: Location[];
  total: number;
  page: number;
  take: number;
  defaultLocationId?: string;
  defaultType?: string;
}

export function MovementsClient({
  movements,
  locations,
  total,
  page,
  take,
  defaultLocationId = "",
  defaultType = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset to page 1 on filter change
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const totalPages = Math.ceil(total / take);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={searchParams.get("locationId") ?? ""}
          onChange={(e) => updateParam("locationId", e.target.value)}
          className="flex h-9 rounded-lg border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring"
        >
          <option value="">Todas as unidades</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          className="flex h-9 rounded-lg border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring"
        >
          {MOVEMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <span className="flex items-center text-sm text-muted-foreground ml-auto">
          {total} movimentaç{total !== 1 ? "ões" : "ão"}
        </span>
      </div>

      {/* Log */}
      <MovementLog movements={movements} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
