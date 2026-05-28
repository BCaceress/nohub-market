import { describe, expect, it } from "vitest";
import { deriveCapabilities } from "./capability-rules";

const keys = (...args: Parameters<typeof deriveCapabilities>) =>
  deriveCapabilities(...args).map((c) => c.key);

describe("deriveCapabilities", () => {
  it("conveniência de bebidas — PDV rápido, delivery, restrição idade, lei seca", () => {
    const caps = deriveCapabilities({
      segmentType: "BEVERAGE_CONVENIENCE",
      stockStructureType: "LOCAL",
      storeCount: 1,
    });
    const k = caps.map((c) => c.key);
    expect(k).toEqual(
      expect.arrayContaining([
        "operation.pos",
        "operation.fast_checkout",
        "operation.delivery",
        "catalog.whatsapp_share",
        "pricing.multi_price",
        "pricing.promotions",
        "product.age_restriction",
        "product.time_restriction",
      ]),
    );
    const age = caps.find((c) => c.key === "product.age_restriction");
    expect(age?.config).toEqual({ minAge: 18 });
  });

  it("supermercado — validade, fracionado, alertas estoque mínimo, reposição", () => {
    expect(
      keys({ segmentType: "SUPERMARKET", stockStructureType: "LOCAL", storeCount: 1 }),
    ).toEqual(
      expect.arrayContaining([
        "operation.pos",
        "operation.continuous_pos",
        "product.expiry_tracking",
        "product.fractioned_sale",
        "inventory.min_stock_alerts",
        "inventory.replenishment",
        "purchasing.suggestions",
      ]),
    );
  });

  it("mercado autônomo — unmanned, 24h, QR, app, controle de acesso", () => {
    expect(
      keys({ segmentType: "UNMANNED_MARKET", stockStructureType: "LOCAL", storeCount: 1 }),
    ).toEqual(
      expect.arrayContaining([
        "operation.unmanned",
        "operation.24h",
        "operation.qr_checkout",
        "operation.app_integration",
        "operation.access_control",
      ]),
    );
  });

  it("CD ativa fluxo central + recebimento centralizado", () => {
    expect(
      keys({ segmentType: "SUPERMARKET", stockStructureType: "CENTRAL_DC", storeCount: 3 }),
    ).toEqual(expect.arrayContaining(["operation.central_dc", "operation.central_receiving"]));
  });

  it("HYBRID combina CD + estoque local", () => {
    const k = keys({ segmentType: "SUPERMARKET", stockStructureType: "HYBRID", storeCount: 2 });
    expect(k).toEqual(
      expect.arrayContaining([
        "operation.central_dc",
        "operation.local_stock",
        "operation.multi_location",
      ]),
    );
  });

  it("conveniência não recebe capabilities de supermercado", () => {
    const k = keys({
      segmentType: "BEVERAGE_CONVENIENCE",
      stockStructureType: "LOCAL",
      storeCount: 1,
    });
    expect(k).not.toContain("inventory.replenishment");
    expect(k).not.toContain("purchasing.suggestions");
  });
});
