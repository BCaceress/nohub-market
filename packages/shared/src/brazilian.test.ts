import { describe, expect, it } from "vitest";
import {
  formatCNPJ,
  isValidCEP,
  isValidCNPJ,
  isValidCPF,
  maskDocument,
  maskEmail,
} from "./brazilian";

describe("validadores BR", () => {
  it("aceita CNPJ válido e rejeita inválido (RN-01)", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-00")).toBe(false);
    expect(isValidCNPJ("00000000000000")).toBe(false);
  });

  it("formatCNPJ aplica máscara progressiva", () => {
    expect(formatCNPJ("11")).toBe("11");
    expect(formatCNPJ("11222")).toBe("11.222");
    expect(formatCNPJ("11222333")).toBe("11.222.333");
    expect(formatCNPJ("112223330001")).toBe("11.222.333/0001");
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCNPJ("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("valida CPF", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("valida CEP", () => {
    expect(isValidCEP("01001-000")).toBe(true);
    expect(isValidCEP("123")).toBe(false);
  });
});

describe("máscaras PII (RN-12)", () => {
  it("mascara email mantendo domínio", () => {
    expect(maskEmail("bruno@nohub.com")).toBe("br***@nohub.com");
  });

  it("mascara documento deixando 4 dígitos", () => {
    expect(maskDocument("11.222.333/0001-81")).toBe("**********0181");
  });
});
