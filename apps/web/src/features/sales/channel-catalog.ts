/**
 * Catálogo de canais de venda online — fonte única para a área Online.
 * Canais "reais" possuem integração funcional (conectar via credenciais).
 * Canais `comingSoon` são placeholders de roadmap (cards desabilitados).
 */

export type ChannelFieldDef = {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
};

export type ChannelDef = {
  /** Valor do enum OrderChannel quando real; slug quando placeholder. */
  key: string;
  name: string;
  description: string;
  /** Ícone visual simples (emoji) para os cards. */
  emoji: string;
  comingSoon?: boolean;
  fields?: ChannelFieldDef[];
};

export const CHANNEL_CATALOG: ChannelDef[] = [
  {
    key: "IFOOD",
    name: "iFood",
    description: "Receba pedidos do iFood automaticamente. Requer homologação junto ao iFood.",
    emoji: "🍔",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Token OAuth iFood",
      },
      { key: "merchantId", label: "Merchant ID", type: "text", placeholder: "ID do restaurante" },
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        type: "password",
        placeholder: "Segredo do webhook",
      },
    ],
  },
  {
    key: "WHATSAPP",
    name: "WhatsApp Business",
    description: "Receba pedidos via WhatsApp (Meta Cloud API). Catálogo de produtos integrado.",
    emoji: "💬",
    fields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Token da Meta" },
      { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "ID do número" },
      { key: "catalogId", label: "Catalog ID", type: "text", placeholder: "ID do catálogo" },
      { key: "appSecret", label: "App Secret", type: "password", placeholder: "Segredo do app" },
    ],
  },
  {
    key: "MERCADO_LIVRE",
    name: "Mercado Livre",
    description: "Sincronize produtos e receba pedidos do ML. Suporta FLEX e CLASSIC.",
    emoji: "🛍️",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Token OAuth ML",
      },
      { key: "sellerId", label: "Seller ID", type: "text", placeholder: "ID do vendedor" },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Segredo do app",
      },
    ],
  },
  {
    key: "AMAZON",
    name: "Amazon",
    description: "Venda no marketplace da Amazon. Integração em desenvolvimento.",
    emoji: "📦",
    comingSoon: true,
  },
  {
    key: "OWN_ECOMMERCE",
    name: "Loja Virtual",
    description: "Conecte sua loja virtual própria. Integração em desenvolvimento.",
    emoji: "🌐",
    comingSoon: true,
  },
  {
    key: "SHOPEE",
    name: "Shopee",
    description: "Receba pedidos da Shopee. Integração em desenvolvimento.",
    emoji: "🧡",
    comingSoon: true,
  },
];

/** Canais com integração funcional (conectáveis hoje). */
export const CONNECTABLE_CHANNELS = CHANNEL_CATALOG.filter((c) => !c.comingSoon);

export function findChannel(key: string): ChannelDef | undefined {
  return CHANNEL_CATALOG.find((c) => c.key === key);
}
