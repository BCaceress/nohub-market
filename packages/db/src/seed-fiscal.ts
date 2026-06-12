/**
 * Seed global de FiscalTemplate — top SKUs por segmento com NCM/CEST/CFOP corretos.
 * Fonte: Tabela NCM SEFAZ + Tabela CEST (Convênio ICMS 92/2015 e atualizações).
 *
 * Executar: pnpm --filter @nohub/db seed:fiscal
 * Ou junto ao seed principal via: pnpm --filter @nohub/db seed
 */

import type { FiscalSegment } from "@prisma/client";
import { prisma } from "./index";

interface TemplateRow {
  segment: FiscalSegment;
  productName: string;
  barcode?: string;
  suggestedNcm: string;
  suggestedCest?: string;
  defaultCfopInternal: string;
  defaultCfopInterstate: string;
  icmsCst?: string; // regime normal
  icmsCsosn?: string; // simples nacional
  pisCst?: string;
  cofinsCst?: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────
// BEBIDAS — NCM 2202 (refrigerantes), 2203 (cervejas), 2208 (destilados)
// ─────────────────────────────────────────────────────────────────────
const beverages: TemplateRow[] = [
  {
    segment: "BEVERAGE",
    productName: "Coca-Cola 350ml Lata",
    barcode: "7894900011517",
    suggestedNcm: "22021000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Refrigerante de cola com substituição tributária",
  },
  {
    segment: "BEVERAGE",
    productName: "Coca-Cola 600ml PET",
    barcode: "7894900700015",
    suggestedNcm: "22021000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Coca-Cola 2L PET",
    barcode: "7894900011043",
    suggestedNcm: "22021000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Pepsi 350ml Lata",
    barcode: "7892840805016",
    suggestedNcm: "22021000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Guaraná Antarctica 350ml Lata",
    barcode: "7891991010023",
    suggestedNcm: "22021000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Heineken 350ml Lata",
    barcode: "7896045500197",
    suggestedNcm: "22030000",
    suggestedCest: "0300100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Cerveja com substituição tributária",
  },
  {
    segment: "BEVERAGE",
    productName: "Skol 350ml Lata",
    barcode: "7891149410036",
    suggestedNcm: "22030000",
    suggestedCest: "0300100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Brahma 350ml Lata",
    barcode: "7891149101032",
    suggestedNcm: "22030000",
    suggestedCest: "0300100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Itaipava 350ml Lata",
    barcode: "7896010600044",
    suggestedNcm: "22030000",
    suggestedCest: "0300100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Red Bull 250ml Lata",
    barcode: "9002490200070",
    suggestedNcm: "22029000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Energético com substituição tributária",
  },
  {
    segment: "BEVERAGE",
    productName: "Monster Energy 473ml",
    barcode: "7898959252017",
    suggestedNcm: "22029000",
    suggestedCest: "0300400",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "BEVERAGE",
    productName: "Água Mineral 500ml",
    barcode: "7896065800018",
    suggestedNcm: "22011000",
    suggestedCest: undefined,
    defaultCfopInternal: "5102",
    defaultCfopInterstate: "6102",
    icmsCst: "40",
    icmsCsosn: "400",
    pisCst: "07",
    cofinsCst: "07",
    description: "Água mineral — geralmente isenta",
  },
  {
    segment: "BEVERAGE",
    productName: "Suco Del Valle 290ml",
    barcode: "7894900700077",
    suggestedNcm: "20099000",
    suggestedCest: "0300200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
];

// ─────────────────────────────────────────────────────────────────────
// SNACKS / SALGADINHOS — NCM 1905 (biscoitos), 2106 (preparações alimentícias)
// ─────────────────────────────────────────────────────────────────────
const snacks: TemplateRow[] = [
  {
    segment: "SNACK",
    productName: "Lay's Original 45g",
    barcode: "7892840236817",
    suggestedNcm: "19059090",
    suggestedCest: "1700200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Salgadinho com substituição tributária",
  },
  {
    segment: "SNACK",
    productName: "Cheetos 51g",
    barcode: "7892840225125",
    suggestedNcm: "19059090",
    suggestedCest: "1700200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "SNACK",
    productName: "Doritos 54g",
    barcode: "7892840232467",
    suggestedNcm: "19059090",
    suggestedCest: "1700200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "SNACK",
    productName: "Oreo Original 90g",
    barcode: "7622300489854",
    suggestedNcm: "19053100",
    suggestedCest: "1700200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Biscoito recheado com substituição tributária",
  },
  {
    segment: "SNACK",
    productName: "Bis Chocolate 45g",
    barcode: "7622210693587",
    suggestedNcm: "18069000",
    suggestedCest: "2300200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Chocolate com substituição tributária",
  },
  {
    segment: "SNACK",
    productName: "Kit Kat 45g",
    barcode: "7613035110465",
    suggestedNcm: "18069000",
    suggestedCest: "2300200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "SNACK",
    productName: "M&M's 80g",
    barcode: "7896423421017",
    suggestedNcm: "18069000",
    suggestedCest: "2300200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
];

// ─────────────────────────────────────────────────────────────────────
// HIGIENE PESSOAL — NCM 3305 (cabelo), 3401 (sabonete), 3304 (cosméticos)
// ─────────────────────────────────────────────────────────────────────
const hygiene: TemplateRow[] = [
  {
    segment: "PERSONAL_HYGIENE",
    productName: "Sabonete Dove 90g",
    barcode: "7891150021985",
    suggestedNcm: "34011100",
    suggestedCest: "2000100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Sabonete — normalmente com ST",
  },
  {
    segment: "PERSONAL_HYGIENE",
    productName: "Shampoo Pantene 200ml",
    barcode: "7500435107334",
    suggestedNcm: "33051000",
    suggestedCest: "2000200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "PERSONAL_HYGIENE",
    productName: "Desodorante Rexona 150ml",
    barcode: "7891150051678",
    suggestedNcm: "33072000",
    suggestedCest: "2000600",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "PERSONAL_HYGIENE",
    productName: "Creme Dental Colgate 90g",
    barcode: "7891024033004",
    suggestedNcm: "33061000",
    suggestedCest: "2000500",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
];

// ─────────────────────────────────────────────────────────────────────
// LIMPEZA — NCM 3402 (detergente), 3808 (desinfetante)
// ─────────────────────────────────────────────────────────────────────
const cleaning: TemplateRow[] = [
  {
    segment: "CLEANING",
    productName: "Detergente Ypê 500ml",
    barcode: "7896098900016",
    suggestedNcm: "34022000",
    suggestedCest: "2400200",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "CLEANING",
    productName: "Água Sanitária Q'boa 1L",
    barcode: "7896098300020",
    suggestedNcm: "28281000",
    suggestedCest: "2400100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "CLEANING",
    productName: "Desinfetante Pinho Sol 500ml",
    barcode: "7891035600058",
    suggestedNcm: "38089400",
    suggestedCest: "2400300",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "CLEANING",
    productName: "Papel Higiênico Personal 4 rolos",
    barcode: "7896110013106",
    suggestedNcm: "48181000",
    suggestedCest: undefined,
    defaultCfopInternal: "5102",
    defaultCfopInterstate: "6102",
    icmsCst: "00",
    icmsCsosn: "102",
    pisCst: "01",
    cofinsCst: "01",
    description: "Papel higiênico — sem ST na maioria dos estados",
  },
];

// ─────────────────────────────────────────────────────────────────────
// LATICÍNIOS — NCM 0401 (leite), 0406 (queijo), 2105 (sorvete)
// ─────────────────────────────────────────────────────────────────────
const dairy: TemplateRow[] = [
  {
    segment: "DAIRY",
    productName: "Leite Integral Italac 1L",
    barcode: "7898080640412",
    suggestedNcm: "04012000",
    suggestedCest: undefined,
    defaultCfopInternal: "5102",
    defaultCfopInterstate: "6102",
    icmsCst: "40",
    icmsCsosn: "400",
    pisCst: "07",
    cofinsCst: "07",
    description: "Leite — isento/imune em muitos estados",
  },
  {
    segment: "DAIRY",
    productName: "Iogurte Nestlé Natural 170g",
    barcode: "7891000073681",
    suggestedNcm: "04031000",
    suggestedCest: undefined,
    defaultCfopInternal: "5102",
    defaultCfopInterstate: "6102",
    icmsCst: "40",
    icmsCsosn: "400",
    pisCst: "07",
    cofinsCst: "07",
  },
  {
    segment: "DAIRY",
    productName: "Queijo Mussarela Sadia 500g",
    barcode: "7896045507196",
    suggestedNcm: "04061000",
    suggestedCest: undefined,
    defaultCfopInternal: "5102",
    defaultCfopInterstate: "6102",
    icmsCst: "00",
    icmsCsosn: "102",
    pisCst: "01",
    cofinsCst: "01",
  },
];

// ─────────────────────────────────────────────────────────────────────
// CONVENIÊNCIA GERAL
// ─────────────────────────────────────────────────────────────────────
const convenience: TemplateRow[] = [
  {
    segment: "CONVENIENCE",
    productName: "Macarrão Instantâneo Maruchan 98g",
    barcode: "4902885506013",
    suggestedNcm: "19023000",
    suggestedCest: "1700100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
  {
    segment: "CONVENIENCE",
    productName: "Cigarro Marlboro Box 20un",
    barcode: "7891290000014",
    suggestedNcm: "24022000",
    suggestedCest: "2600100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
    description: "Cigarro — requer controle de restrição por idade",
  },
  {
    segment: "CONVENIENCE",
    productName: "Isqueiro BIC Maxi",
    barcode: "7011700006009",
    suggestedNcm: "96131000",
    suggestedCest: undefined,
    defaultCfopInternal: "5102",
    defaultCfopInterstate: "6102",
    icmsCst: "00",
    icmsCsosn: "102",
    pisCst: "01",
    cofinsCst: "01",
  },
  {
    segment: "CONVENIENCE",
    productName: "Bala Butter Toffees 100g",
    barcode: "7622210021557",
    suggestedNcm: "17041000",
    suggestedCest: "2300100",
    defaultCfopInternal: "5405",
    defaultCfopInterstate: "6405",
    icmsCst: "60",
    icmsCsosn: "500",
    pisCst: "02",
    cofinsCst: "02",
  },
];

const ALL_TEMPLATES: TemplateRow[] = [
  ...beverages,
  ...snacks,
  ...hygiene,
  ...cleaning,
  ...dairy,
  ...convenience,
];

async function seedFiscalTemplates() {
  console.log(`🌱 Seeding ${ALL_TEMPLATES.length} fiscal templates…`);

  let created = 0;
  let skipped = 0;

  for (const tpl of ALL_TEMPLATES) {
    const existing = await prisma.fiscalTemplate.findFirst({
      where: { segment: tpl.segment, productName: tpl.productName },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.fiscalTemplate.create({
      data: {
        segment: tpl.segment,
        productName: tpl.productName,
        barcode: tpl.barcode ?? null,
        suggestedNcm: tpl.suggestedNcm,
        suggestedCest: tpl.suggestedCest ?? null,
        defaultCfopInternal: tpl.defaultCfopInternal,
        defaultCfopInterstate: tpl.defaultCfopInterstate,
        icmsCst: tpl.icmsCst ?? null,
        icmsCsosn: tpl.icmsCsosn ?? null,
        pisCst: tpl.pisCst ?? null,
        cofinsCst: tpl.cofinsCst ?? null,
        origin: "NACIONAL",
        description: tpl.description ?? null,
      },
    });
    created++;
  }

  console.log(`✅ Fiscal templates: ${created} created, ${skipped} skipped`);
}

seedFiscalTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
