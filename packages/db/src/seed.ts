import { prisma } from "./index";

// Seed mínimo da Etapa 1. Dados de demonstração só em ambiente local.
async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Seed ignorado em produção.");
    return;
  }
  console.log("Seed: nada a popular na Etapa 1 (onboarding cria os dados reais).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
