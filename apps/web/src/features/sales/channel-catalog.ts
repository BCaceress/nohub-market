/**
 * Catálogo de canais de venda online — fonte única para a área Online.
 * Marca renderizada via <ChannelLogo>: logo de marca (simple-icons) quando
 * disponível, senão lettermark (iniciais na cor da marca) ou ícone genérico.
 */

export type ChannelFieldDef = {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
};

/** Chaves de logo disponíveis no pacote simple-icons. */
export type ChannelSiKey = "siIfood" | "siWhatsapp" | "siShopee";

export type ChannelDef = {
  /** Valor do enum OrderChannel quando real; slug quando placeholder. */
  key: string;
  name: string;
  description: string;
  /** Cor da marca (hex sem #) — fundo do tile do logo. */
  hex: string;
  /** Cor do glifo/iniciais (default branco). */
  fg?: string;
  /** Iniciais para lettermark quando não há logo de marca. */
  initials: string;
  /** Logo de marca (simple-icons) quando existir. */
  siKey?: ChannelSiKey;
  /** Ícone genérico (lucide) quando não há marca — ex: Loja Virtual. */
  lucide?: "globe";
  comingSoon?: boolean;
  fields?: ChannelFieldDef[];
};

export const CHANNEL_CATALOG: ChannelDef[] = [
  {
    key: "IFOOD",
    name: "iFood",
    description: "Receba pedidos do iFood automaticamente. Requer homologação junto ao iFood.",
    hex: "EA1D2C",
    initials: "iF",
    siKey: "siIfood",
    comingSoon: true,
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
    hex: "25D366",
    initials: "Wa",
    siKey: "siWhatsapp",
    comingSoon: true,
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
    hex: "FFE600",
    fg: "#2D3277",
    initials: "ML",
    comingSoon: true,
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
    hex: "232F3E",
    fg: "#FF9900",
    initials: "az",
    comingSoon: true,
  },
  {
    key: "OWN_ECOMMERCE",
    name: "Loja Virtual",
    description: "Conecte sua loja virtual própria. Integração em desenvolvimento.",
    hex: "6366F1",
    initials: "LV",
    lucide: "globe",
    comingSoon: true,
  },
  {
    key: "SHOPEE",
    name: "Shopee",
    description: "Receba pedidos da Shopee. Integração em desenvolvimento.",
    hex: "EE4D2D",
    initials: "Sh",
    siKey: "siShopee",
    comingSoon: true,
  },
];

/** Canais com integração funcional (conectáveis hoje). */
export const CONNECTABLE_CHANNELS = CHANNEL_CATALOG.filter((c) => !c.comingSoon);

export function findChannel(key: string): ChannelDef | undefined {
  return CHANNEL_CATALOG.find((c) => c.key === key);
}
