import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("RBAC", () => {
  it("owner pode tudo", () => {
    expect(can("owner", "billing", "delete")).toBe(true);
    expect(can("owner", "audit", "manage")).toBe(true);
  });

  it("viewer só lê", () => {
    expect(can("viewer", "product", "read")).toBe(true);
    expect(can("viewer", "product", "update")).toBe(false);
  });

  it("operator opera estoque e pedidos, não mexe em billing", () => {
    expect(can("operator", "inventory", "update")).toBe(true);
    expect(can("operator", "order", "create")).toBe(true);
    expect(can("operator", "billing", "read")).toBe(false);
  });

  it("manager não acessa billing nem audit", () => {
    expect(can("manager", "product", "delete")).toBe(true);
    expect(can("manager", "billing", "read")).toBe(false);
    expect(can("manager", "audit", "read")).toBe(false);
  });
});
