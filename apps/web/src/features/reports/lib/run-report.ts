import type { $Enums, Prisma } from "@nohub/db";
import { prisma } from "@nohub/db";
import type { ReportColumn, ReportConfig, ReportResult } from "../schemas";

/* ─────────────────────────────────────────────────────────────────────
   Engine de relatórios.
   Toda query é multi-tenant (organizationId obrigatório — RN-02).
   Agregação em JS após fetch escopado; índices em createdAt/org cobrem ranges.
   Relatórios pesados devem migrar para SQL agregado / views materializadas.
───────────────────────────────────────────────────────────────────── */

const REVENUE_STATUSES = ["PAID", "FULFILLED", "COMPLETED"] as const;

const CHANNEL_LABELS: Record<string, string> = {
  POS: "PDV",
  SELF_SERVICE: "Autônomo",
  IFOOD: "iFood",
  WHATSAPP: "WhatsApp",
  MERCADO_LIVRE: "Mercado Livre",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX_MANUAL: "Pix manual",
  PIX_DYNAMIC: "Pix QR",
  CARD_PRESENT: "Cartão presente",
  CARD_ONLINE: "Cartão online",
  VOUCHER: "Vale",
};

const REASON_LABELS: Record<string, string> = {
  DAMAGE: "Dano/quebra",
  EXPIRY: "Vencimento",
  THEFT: "Furto",
  INVENTORY_COUNT: "Acerto inventário",
};

function num(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : Number(d);
}

function dateRange(config: ReportConfig) {
  const gte = config.filters.from ? new Date(config.filters.from) : undefined;
  const lte = config.filters.to ? new Date(config.filters.to) : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

/* ── SALES ───────────────────────────────────────────────────────── */

async function runSales(orgId: string, config: ReportConfig): Promise<ReportResult> {
  const created = dateRange(config);
  const orderWhere: Prisma.OrderWhereInput = {
    organizationId: orgId,
    status: { in: REVENUE_STATUSES as unknown as $Enums.OrderStatus[] },
    ...(config.filters.locationId ? { locationId: config.filters.locationId } : {}),
    ...(config.filters.channel ? { channel: config.filters.channel } : {}),
    ...(created ? { createdAt: created } : {}),
  };

  // Dimensões que agregam por item exigem OrderItem.
  // OrderItem.productId é ref fraca (sem relation) — categoria via lookup à parte.
  if (config.dimension === "product" || config.dimension === "category") {
    const items = await prisma.orderItem.findMany({
      where: { order: orderWhere },
      select: { productId: true, productNameSnapshot: true, quantity: true, lineTotal: true },
    });

    let catMap = new Map<string, { categoryId: string | null; categoryName: string }>();
    if (config.dimension === "category") {
      const ids = [...new Set(items.map((i) => i.productId).filter((x): x is string => !!x))];
      if (ids.length > 0) {
        const products = await prisma.product.findMany({
          where: { id: { in: ids }, organizationId: orgId },
          select: { id: true, categoryId: true, category: { select: { name: true } } },
        });
        catMap = new Map(
          products.map((p) => [
            p.id,
            { categoryId: p.categoryId, categoryName: p.category?.name ?? "Sem categoria" },
          ]),
        );
      }
    }

    const buckets = new Map<string, { label: string; revenue: number; qty: number }>();
    for (const it of items) {
      let key: string;
      let label: string;
      if (config.dimension === "category") {
        const cat = it.productId ? catMap.get(it.productId) : undefined;
        key = cat?.categoryId ?? "__none__";
        label = cat?.categoryName ?? "Sem categoria";
        if (config.filters.categoryId && key !== config.filters.categoryId) continue;
      } else {
        key = it.productId ?? `name:${it.productNameSnapshot}`;
        label = it.productNameSnapshot;
      }
      const b = buckets.get(key) ?? { label, revenue: 0, qty: 0 };
      b.revenue += num(it.lineTotal);
      b.qty += num(it.quantity);
      buckets.set(key, b);
    }
    return finishSales(config, [...buckets.values()]);
  }

  // Dimensões por pedido.
  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: { total: true, channel: true, createdAt: true },
  });

  if (config.dimension === "paymentMethod") {
    const payments = await prisma.payment.findMany({
      where: { status: "CONFIRMED", order: orderWhere },
      select: { method: true, amount: true },
    });
    const buckets = new Map<string, { label: string; revenue: number; qty: number }>();
    for (const p of payments) {
      const b = buckets.get(p.method) ?? {
        label: PAYMENT_LABELS[p.method] ?? p.method,
        revenue: 0,
        qty: 0,
      };
      b.revenue += num(p.amount);
      b.qty += 1;
      buckets.set(p.method, b);
    }
    return finishSales(config, [...buckets.values()]);
  }

  const buckets = new Map<string, { label: string; revenue: number; qty: number }>();
  for (const o of orders) {
    let key: string;
    let label: string;
    if (config.dimension === "channel") {
      key = o.channel;
      label = CHANNEL_LABELS[o.channel] ?? o.channel;
    } else {
      // day
      key = o.createdAt.toISOString().slice(0, 10);
      label = key;
    }
    const b = buckets.get(key) ?? { label, revenue: 0, qty: 0 };
    b.revenue += num(o.total);
    b.qty += 1;
    buckets.set(key, b);
  }
  return finishSales(config, [...buckets.values()], config.dimension === "day");
}

function finishSales(
  config: ReportConfig,
  raw: { label: string; revenue: number; qty: number }[],
  chronological = false,
): ReportResult {
  let rows = raw.map((r) => ({
    label: r.label,
    revenue: round2(r.revenue),
    orders: r.qty,
    ticket: r.qty > 0 ? round2(r.revenue / r.qty) : 0,
  }));

  const sortKey =
    config.metric === "ticket" ? "ticket" : config.metric === "orders" ? "orders" : "revenue";
  if (chronological) rows.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  else rows.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  rows = rows.slice(0, config.limit);

  const columns: ReportColumn[] = [
    { key: "label", label: dimensionLabel(config.dimension), type: "text" },
    { key: "revenue", label: "Receita", type: "currency" },
    { key: "orders", label: "Pedidos", type: "number" },
    { key: "ticket", label: "Ticket médio", type: "currency" },
  ];

  const totalRevenue = round2(raw.reduce((s, r) => s + r.revenue, 0));
  const totalOrders = raw.reduce((s, r) => s + r.qty, 0);

  return {
    title: titleFor(config),
    columns,
    rows,
    labelKey: "label",
    valueKey: sortKey,
    totals: {
      revenue: totalRevenue,
      orders: totalOrders,
      ticket: totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0,
    },
  };
}

/* ── INVENTORY ───────────────────────────────────────────────────── */

async function runInventory(orgId: string, config: ReportConfig): Promise<ReportResult> {
  const balances = await prisma.stockBalance.findMany({
    where: {
      organizationId: orgId,
      ...(config.filters.locationId ? { locationId: config.filters.locationId } : {}),
      ...(config.filters.categoryId ? { product: { categoryId: config.filters.categoryId } } : {}),
    },
    select: {
      quantityOnHand: true,
      averageCost: true,
      productId: true,
      product: { select: { name: true } },
      location: { select: { id: true, name: true } },
    },
  });

  const byLocation = config.dimension === "location";
  const buckets = new Map<string, { label: string; qty: number; value: number }>();
  for (const b of balances) {
    const key = byLocation ? (b.location?.id ?? "__none__") : b.productId;
    const label = byLocation ? (b.location?.name ?? "—") : (b.product?.name ?? "—");
    const qty = num(b.quantityOnHand);
    const value = qty * num(b.averageCost);
    const cur = buckets.get(key) ?? { label, qty: 0, value: 0 };
    cur.qty += qty;
    cur.value += value;
    buckets.set(key, cur);
  }

  let rows = [...buckets.values()].map((r) => ({
    label: r.label,
    qty: round2(r.qty),
    stockValue: round2(r.value),
  }));
  const sortKey = config.metric === "qty" ? "qty" : "stockValue";
  rows.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  rows = rows.slice(0, config.limit);

  return {
    title: titleFor(config),
    columns: [
      { key: "label", label: dimensionLabel(config.dimension), type: "text" },
      { key: "qty", label: "Qtd em estoque", type: "number" },
      { key: "stockValue", label: "Valor (custo)", type: "currency" },
    ],
    rows,
    labelKey: "label",
    valueKey: sortKey,
    totals: {
      qty: round2([...buckets.values()].reduce((s, r) => s + r.qty, 0)),
      stockValue: round2([...buckets.values()].reduce((s, r) => s + r.value, 0)),
    },
  };
}

/* ── LOSSES ──────────────────────────────────────────────────────── */

async function runLosses(orgId: string, config: ReportConfig): Promise<ReportResult> {
  const created = dateRange(config);
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId: orgId,
      reason: { in: ["DAMAGE", "EXPIRY", "THEFT"] },
      ...(config.filters.locationId ? { locationId: config.filters.locationId } : {}),
      ...(created ? { createdAt: created } : {}),
    },
    select: {
      reason: true,
      quantity: true,
      unitCost: true,
      productId: true,
      product: { select: { name: true } },
    },
  });

  const byProduct = config.dimension === "product";
  const buckets = new Map<string, { label: string; qty: number; value: number }>();
  for (const m of movements) {
    const key = byProduct ? m.productId : (m.reason ?? "—");
    const label = byProduct
      ? (m.product?.name ?? "—")
      : (REASON_LABELS[m.reason ?? ""] ?? m.reason ?? "—");
    const qty = Math.abs(num(m.quantity));
    const value = qty * num(m.unitCost);
    const cur = buckets.get(key) ?? { label, qty: 0, value: 0 };
    cur.qty += qty;
    cur.value += value;
    buckets.set(key, cur);
  }

  let rows = [...buckets.values()].map((r) => ({
    label: r.label,
    qty: round2(r.qty),
    lossValue: round2(r.value),
  }));
  rows.sort((a, b) => (b.lossValue as number) - (a.lossValue as number));
  rows = rows.slice(0, config.limit);

  return {
    title: titleFor(config),
    columns: [
      { key: "label", label: dimensionLabel(config.dimension), type: "text" },
      { key: "qty", label: "Qtd perdida", type: "number" },
      { key: "lossValue", label: "Perda (R$)", type: "currency" },
    ],
    rows,
    labelKey: "label",
    valueKey: "lossValue",
    totals: {
      qty: round2([...buckets.values()].reduce((s, r) => s + r.qty, 0)),
      lossValue: round2([...buckets.values()].reduce((s, r) => s + r.value, 0)),
    },
  };
}

/* ── FINANCE ─────────────────────────────────────────────────────── */

function agingBucket(dueDate: Date, now: Date): { key: string; label: string } {
  const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  if (days < 0) return { key: "0", label: "A vencer" };
  if (days <= 30) return { key: "1", label: "Vencido 1–30 dias" };
  if (days <= 60) return { key: "2", label: "Vencido 31–60 dias" };
  return { key: "3", label: "Vencido 60+ dias" };
}

type FinanceBucket = { sortKey: string; label: string; value: number };

function finishFinance(
  config: ReportConfig,
  buckets: Map<string, FinanceBucket>,
  valueLabel: string,
  chronological = false,
): ReportResult {
  let rows = [...buckets.values()].map((b) => ({ label: b.label, value: round2(b.value) }));
  if (chronological) {
    const order = [...buckets.values()];
    rows = order
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((b) => ({ label: b.label, value: round2(b.value) }));
  } else {
    rows.sort((a, b) => b.value - a.value);
  }
  rows = rows.slice(0, config.limit);

  return {
    title: titleFor(config),
    columns: [
      { key: "label", label: dimensionLabel(config.dimension), type: "text" },
      { key: "value", label: valueLabel, type: "currency" },
    ],
    rows,
    labelKey: "label",
    valueKey: "value",
    totals: { value: round2([...buckets.values()].reduce((s, b) => s + b.value, 0)) },
  };
}

async function runFinance(orgId: string, config: ReportConfig): Promise<ReportResult> {
  const now = new Date();
  const buckets = new Map<string, FinanceBucket>();
  const add = (key: string, label: string, value: number, sortKey?: string) => {
    const cur = buckets.get(key) ?? { sortKey: sortKey ?? label, label, value: 0 };
    cur.value += value;
    buckets.set(key, cur);
  };

  // ── A pagar / a receber em aberto ──────────────────────────────
  if (config.metric === "payableOpen" || config.metric === "receivableOpen") {
    const byCategory = config.dimension === "financeCategory";
    if (config.metric === "payableOpen") {
      const rows = await prisma.accountPayable.findMany({
        where: { organizationId: orgId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
        select: {
          amount: true,
          paidAmount: true,
          dueDate: true,
          category: { select: { name: true } },
        },
      });
      for (const r of rows) {
        const remaining = num(r.amount) - num(r.paidAmount);
        if (byCategory)
          add(r.category?.name ?? "__none__", r.category?.name ?? "Sem categoria", remaining);
        else {
          const b = agingBucket(r.dueDate, now);
          add(b.key, b.label, remaining, b.key);
        }
      }
      return finishFinance(config, buckets, "Em aberto", !byCategory);
    }
    const rows = await prisma.accountReceivable.findMany({
      where: { organizationId: orgId, status: { in: ["PENDING", "PARTIALLY_RECEIVED"] } },
      select: {
        amount: true,
        receivedAmount: true,
        dueDate: true,
        category: { select: { name: true } },
      },
    });
    for (const r of rows) {
      const remaining = num(r.amount) - num(r.receivedAmount);
      if (byCategory)
        add(r.category?.name ?? "__none__", r.category?.name ?? "Sem categoria", remaining);
      else {
        const b = agingBucket(r.dueDate, now);
        add(b.key, b.label, remaining, b.key);
      }
    }
    return finishFinance(config, buckets, "Em aberto", !byCategory);
  }

  // ── Conciliação de cartão (líquido / taxa) ─────────────────────
  if (config.metric === "settlementNet" || config.metric === "feeTotal") {
    const created = dateRange(config);
    const rows = await prisma.paymentSettlement.findMany({
      where: { organizationId: orgId, ...(created ? { expectedDate: created } : {}) },
      select: {
        netAmount: true,
        feeAmount: true,
        expectedDate: true,
        payment: { select: { method: true } },
      },
    });
    const byMethod = config.dimension === "paymentMethod";
    for (const r of rows) {
      const value = config.metric === "feeTotal" ? num(r.feeAmount) : num(r.netAmount);
      if (byMethod) {
        const m = r.payment?.method ?? "—";
        add(m, PAYMENT_LABELS[m] ?? m, value);
      } else {
        const month = r.expectedDate.toISOString().slice(0, 7);
        add(month, month, value, month);
      }
    }
    return finishFinance(
      config,
      buckets,
      config.metric === "feeTotal" ? "Taxa (R$)" : "Líquido (R$)",
      !byMethod,
    );
  }

  // ── DRE simplificado (resultado realizado por categoria) ───────
  const created = dateRange(config);
  const [payables, receivables] = await Promise.all([
    prisma.accountPayable.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["PAID", "PARTIALLY_PAID"] },
        ...(created ? { paidAt: created } : {}),
      },
      select: { paidAmount: true, category: { select: { name: true } } },
    }),
    prisma.accountReceivable.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
        ...(created ? { receivedAt: created } : {}),
      },
      select: { receivedAmount: true, category: { select: { name: true } } },
    }),
  ]);
  for (const r of receivables) {
    const name = r.category?.name ?? "Sem categoria";
    add(name, name, num(r.receivedAmount));
  }
  for (const p of payables) {
    const name = p.category?.name ?? "Sem categoria";
    add(name, name, -num(p.paidAmount));
  }
  return finishFinance(config, buckets, "Resultado (R$)");
}

/* ── Dispatch ────────────────────────────────────────────────────── */

export async function runReport(orgId: string, config: ReportConfig): Promise<ReportResult> {
  switch (config.source) {
    case "sales":
      return runSales(orgId, config);
    case "inventory":
      return runInventory(orgId, config);
    case "losses":
      return runLosses(orgId, config);
    case "finance":
      return runFinance(orgId, config);
  }
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dimensionLabel(d: ReportConfig["dimension"]): string {
  const map: Record<string, string> = {
    day: "Data",
    channel: "Canal",
    paymentMethod: "Forma de pagamento",
    product: "Produto",
    category: "Categoria",
    location: "Unidade",
    reason: "Motivo",
    agingBucket: "Faixa de vencimento",
    settlementMonth: "Mês de liquidação",
    financeCategory: "Categoria financeira",
  };
  return map[d] ?? d;
}

function titleFor(config: ReportConfig): string {
  return `${sourceLabel(config.source)} por ${dimensionLabel(config.dimension).toLowerCase()}`;
}

function sourceLabel(s: ReportConfig["source"]): string {
  const map: Record<string, string> = {
    sales: "Vendas",
    inventory: "Estoque",
    losses: "Perdas",
    finance: "Financeiro",
  };
  return map[s] ?? s;
}
