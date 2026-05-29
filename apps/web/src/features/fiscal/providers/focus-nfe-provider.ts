/**
 * FocusNfeProvider — adapter para Focus NFe (https://focusnfe.com.br).
 * Anti-corruption: payload Focus morre aqui (RN-F07).
 *
 * Focus NFe API:
 * - Sandbox: https://homologacao.focusnfe.com.br
 * - Produção: https://api.focusnfe.com.br
 * - Auth: Basic com token como usuário, senha vazia
 * - NFCe: POST /v2/nfce
 *
 * ATENÇÃO: Esta implementação é placeholder — substitua as chamadas HTTP
 * pelo SDK ou cliente HTTP real quando integrar com o Focus NFe.
 */

import type {
  FiscalProvider,
  FiscalResult,
  InvoiceDraft,
  InvoiceUpdate,
  ProviderCancelResult,
  ProviderCertificate,
  ProviderConfig,
  ProviderInutilizeResult,
  ProviderIssueResult,
  ProviderStatus,
} from "./fiscal-provider";

/* ── Mapeamento de formas de pagamento interno → Focus ─────────── */

const PAYMENT_METHOD_MAP: Record<string, string> = {
  CASH: "01", // Dinheiro
  PIX_MANUAL: "17", // Pix
  PIX_DYNAMIC: "17", // Pix
  CARD_PRESENT: "03", // Cartão de Crédito (simplificado — usar método real)
  CARD_ONLINE: "03",
  VOUCHER: "99", // Outros
};

/* ── Mapeamento NCM/CFOP simples (produção requer tabela completa) */

function mapTaxRegime(regime: string): string {
  // Focus NFe usa CRT (Código de Regime Tributário)
  const map: Record<string, string> = {
    simples_nacional: "1",
    lucro_presumido: "3",
    lucro_real: "3",
    SIMPLES_NACIONAL: "1",
    LUCRO_PRESUMIDO: "3",
  };
  return map[regime] ?? "1";
}

/* ── Provider ─────────────────────────────────────────────────── */

export class FocusNfeProvider implements FiscalProvider {
  private getBaseUrl(environment: "homologation" | "production"): string {
    return environment === "production"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";
  }

  /**
   * Monta o payload Focus NFe a partir do InvoiceDraft interno.
   * Anti-corruption: payload Focus é construído aqui e nunca sai deste arquivo.
   */
  private buildFocusPayload(draft: InvoiceDraft): Record<string, unknown> {
    const { issuer, recipient, items, payments, series } = draft;
    const crt = mapTaxRegime(issuer.taxRegime);

    return {
      natureza_operacao: "VENDA AO CONSUMIDOR",
      forma_pagamento: "0",
      serie: String(series),
      // referencia é preenchida pelo Focus automaticamente

      emitente: {
        cnpj: issuer.cnpj,
        nome: issuer.legalName,
        nome_fantasia: issuer.tradeName ?? issuer.legalName,
        logradouro: issuer.address.street,
        numero: issuer.address.number,
        complemento: issuer.address.complement ?? "",
        bairro: issuer.address.district,
        municipio: issuer.address.city,
        uf: issuer.address.state,
        cep: issuer.address.zipCode.replace(/\D/g, ""),
        telefone: "",
        inscricao_estadual: issuer.ie ?? "",
        codigo_regime_tributario: crt,
      },

      destinatario: recipient?.document
        ? {
            cpf: recipient.document.replace(/\D/g, ""),
            nome: recipient.name ?? "CONSUMIDOR",
            ...(recipient.email ? { email: recipient.email } : {}),
          }
        : undefined,

      itens: items.map((item, idx) => ({
        numero_item: String(idx + 1),
        codigo_produto: item.productCode,
        descricao: item.description,
        codigo_ncm: item.ncm.replace(/\D/g, ""),
        cfop: item.cfop,
        unidade_comercial: item.unit,
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: item.unitPrice,
        valor_bruto: item.totalPrice,
        valor_desconto: item.discountAmount || undefined,
        icms_origem: item.icmsOrigin,
        icms_modalidade: item.icmsCsosn ? "400" : (item.icmsCst ?? "40"),
        // Simples Nacional usa CSOSN
        ...(item.icmsCsosn && { icms_csosn: item.icmsCsosn }),
        ...(item.icmsCst && { icms_cst: item.icmsCst }),
        ...(item.icmsRate && { icms_aliquota: item.icmsRate }),
        // PIS
        pis_modalidade: item.pisCst ?? "07",
        ...(item.pisRate && { pis_aliquota: item.pisRate }),
        // COFINS
        cofins_modalidade: item.cofinsCst ?? "07",
        ...(item.cofinsRate && { cofins_aliquota: item.cofinsRate }),
      })),

      formas_pagamento: payments.map((p) => ({
        forma_pagamento: PAYMENT_METHOD_MAP[p.method] ?? "99",
        valor: p.amount,
      })),

      informacoes_adicionais_contribuinte: `Emitido por MarketOS | Ref: ${draft.referenceId}`,
    };
  }

  async issueNfce(
    draft: InvoiceDraft,
    _certificate: ProviderCertificate,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderIssueResult>> {
    const baseUrl = this.getBaseUrl(config.environment);
    const payload = this.buildFocusPayload(draft);

    // TODO: substituir por fetch real
    // const response = await fetch(`${baseUrl}/v2/nfce`, {
    //   method:  "POST",
    //   headers: {
    //     Authorization:  this.getAuthHeader(config.token),
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({ ref: draft.referenceId, ...payload }),
    // });
    // const data = await response.json();
    // ... mapear data → ProviderIssueResult

    console.warn(`[FocusNfeProvider.issueNfce] SIMULADO — ${baseUrl}/v2/nfce`);
    console.warn("  payload keys:", Object.keys(payload).join(", "));

    // Simulação: retorna resultado de sucesso
    const fakeAccessKey = `35${new Date().getFullYear()}${config.cnpj.replace(/\D/g, "")}65${String(draft.series).padStart(3, "0")}${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 9)).padStart(8, "0")}`;

    return {
      success: true,
      data: {
        accessKey: fakeAccessKey.slice(0, 44),
        protocol: `141${Date.now()}`,
        providerInvoiceId: `FOCUS_${draft.referenceId}`,
        xml: `<?xml version="1.0" encoding="UTF-8"?><nfeProc><!-- SIMULADO --></nfeProc>`,
        qrCode: `${baseUrl}/nfce/qrcode/${draft.referenceId}`,
        danfeUrl: `${baseUrl}/nfce/danfce/${draft.referenceId}`,
        issuedAt: new Date(),
        isSynchronous: true,
      },
    };
  }

  async cancelNfce(
    accessKey: string,
    _reason: string,
    _certificate: ProviderCertificate,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderCancelResult>> {
    const _baseUrl = this.getBaseUrl(config.environment);

    // TODO: POST ${baseUrl}/v2/nfce/${providerRef}/cancelamento
    console.warn(`[FocusNfeProvider.cancelNfce] SIMULADO — chave ${accessKey}`);

    return {
      success: true,
      data: {
        protocol: `155${Date.now()}`,
        xml: `<?xml version="1.0" encoding="UTF-8"?><retEvento><!-- CANCELAMENTO SIMULADO --></retEvento>`,
        canceledAt: new Date(),
      },
    };
  }

  async consultStatus(
    providerInvoiceId: string,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderStatus>> {
    const _baseUrl = this.getBaseUrl(config.environment);

    // TODO: GET ${baseUrl}/v2/nfce/${providerRef}
    console.warn(`[FocusNfeProvider.consultStatus] SIMULADO — ${providerInvoiceId}`);

    return {
      success: true,
      data: { status: "pending" },
    };
  }

  async inutilizeNumbers(
    series: number,
    from: number,
    to: number,
    _reason: string,
    _certificate: ProviderCertificate,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderInutilizeResult>> {
    const _baseUrl = this.getBaseUrl(config.environment);

    // TODO: POST ${baseUrl}/v2/nfce/inutilizacao
    console.warn(`[FocusNfeProvider.inutilizeNumbers] SIMULADO — série ${series} / ${from}→${to}`);

    return {
      success: true,
      data: {
        protocol: `165${Date.now()}`,
        processedAt: new Date(),
      },
    };
  }

  verifyWebhookSignature(
    _payload: string,
    headers: Record<string, string>,
    config: ProviderConfig,
  ): boolean {
    // Focus NFe não usa assinatura de webhook — verifica por IP ou token de URL
    // Em produção, verificar pela lista de IPs autorizados do Focus
    const webhookToken = headers["x-webhook-token"] ?? headers["X-Webhook-Token"];
    if (!webhookToken) return true; // Focus pode não enviar token — logar e permitir
    return webhookToken === config.token;
  }

  parseWebhook(payload: unknown): FiscalResult<InvoiceUpdate> {
    // Anti-corruption: payload Focus morre aqui
    try {
      const raw = payload as Record<string, unknown>;

      // Focus envia: { ref, status, numero, chave, protocolo, xml, qrcode_url, danfe_url, ... }
      const ref = String(raw.ref ?? "");
      const status = String(raw.status ?? "");
      const chave = String(raw.chave ?? raw.chave_nfe ?? "");
      const protocolo = String(raw.protocolo ?? "");
      const xml = String(raw.xml_nfe ?? raw.xml ?? "");

      // Mapear status Focus → interno
      const statusMap: Record<string, "authorized" | "rejected" | "denied"> = {
        autorizado: "authorized",
        cancelado: "authorized", // cancelado é tratado separadamente
        erro_autorizacao: "rejected",
        denegado: "denied",
      };

      const mappedStatus = statusMap[status];
      if (!mappedStatus) {
        return { success: false, error: `Status Focus desconhecido: ${status}` };
      }

      return {
        success: true,
        data: {
          providerInvoiceId: `FOCUS_${ref}`,
          status: mappedStatus,
          accessKey: chave || undefined,
          protocol: protocolo || undefined,
          xml: xml || undefined,
          qrCode: String(raw.qrcode_url ?? "") || undefined,
          danfeUrl: String(raw.danfce_url ?? "") || undefined,
          rejectionCode: String(raw.codigo ?? "") || undefined,
          rejectionReason: String(raw.mensagem ?? "") || undefined,
          processedAt: new Date(),
        },
      };
    } catch (err) {
      return { success: false, error: `Erro ao parsear webhook Focus: ${String(err)}` };
    }
  }
}

export const focusNfeProvider = new FocusNfeProvider();
