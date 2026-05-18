import { describe, expect, it } from "vitest";
import { deriveCapabilities } from "./capability-rules";

const keys = (...args: Parameters<typeof deriveCapabilities>) =>
  deriveCapabilities(...args).map((c) => c.key);

describe("deriveCapabilities", () => {
  it("álcool ativa idade (18) e lei seca (RN-06)", () => {
    const caps = deriveCapabilities({
      businessType: "CONVENIENCE",
      productCategories: ["alcohol"],
    });
    const age = caps.find((c) => c.key === "product.age_restriction");
    expect(age?.config).toEqual({ minAge: 18 });
    expect(caps.map((c) => c.key)).toContain("product.time_restriction");
  });

  it("hortifruti ativa validade e venda fracionada (RN-07)", () => {
    expect(keys({ businessType: "HYBRID", productCategories: ["hortifruti"] })).toEqual(
      expect.arrayContaining(["product.expiry_tracking", "product.fractioned_sale"]),
    );
  });

  it("mercado autônomo ativa unmanned + 24h (RN-08)", () => {
    expect(keys({ businessType: "UNMANNED_MARKET", productCategories: [] })).toEqual(
      expect.arrayContaining(["operation.unmanned", "operation.24h"]),
    );
  });

  it("conveniência ativa PDV", () => {
    expect(keys({ businessType: "CONVENIENCE", productCategories: [] })).toContain("operation.pos");
  });

  it("sem categorias sensíveis não deriva restrições", () => {
    expect(keys({ businessType: "HYBRID", productCategories: ["general"] })).not.toContain(
      "product.age_restriction",
    );
  });
});
