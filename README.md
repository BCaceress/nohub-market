# NoHub Market

> O sistema que cresce com seu negócio — mercados autônomos, conveniências e vendas online em uma só plataforma.

SaaS B2B multi-tenant para varejo de proximidade. Este repositório contém a **Etapa 1**: fundação de autenticação, multi-tenancy e wizard de onboarding configurável.

## Stack

Turborepo · pnpm · Next.js 15 (App Router) · TypeScript strict · Tailwind CSS 4 · Prisma (PostgreSQL/Neon) · Better Auth · Zod · shadcn/ui · Biome · Lefthook.

## Estrutura

```
nohub-market/
├── apps/web              # Next.js (app principal)
└── packages/
    ├── db                # Prisma schema + client
    ├── auth              # Better Auth + RBAC
    ├── shared            # Zod, env, validadores BR
    └── config            # tsconfig compartilhado
└── design-system/        # tokens (single source of truth)
```

## Setup

```bash
# 1. Pré-requisitos: Node 22+, pnpm 9+, git
pnpm install

# 2. Variáveis de ambiente
cp .env.example .env        # preencha DATABASE_URL etc.

# 3. Banco (Neon)
pnpm db:generate
pnpm db:push                # ou: pnpm db:migrate

# 4. Design tokens → CSS vars
pnpm tokens

# 5. Dev
pnpm dev                    # http://localhost:3000
```

## Scripts

| Script | Função |
| --- | --- |
| `pnpm dev` | Sobe o app em modo dev |
| `pnpm build` | Build de produção (Turborepo) |
| `pnpm lint` | Biome check |
| `pnpm typecheck` | TS strict em todo o monorepo |
| `pnpm tokens` | Gera CSS vars a partir de `design-system/tokens.ts` |
| `pnpm tokens:check` | Verifica sincronização dos tokens (CI) |
| `pnpm db:push` | Aplica o schema Prisma no banco |

## Status da Etapa 1

- [x] Monorepo + tooling (Turborepo, Biome, Lefthook)
- [x] Schema Prisma (Organization, Member, Capability, Location, AuditLog, ...)
- [x] Design system (tokens → CSS)
- [x] Esqueleto Better Auth + RBAC
- [ ] Páginas de auth e wizard de onboarding (próxima rodada)

Veja o boilerplate manual para o roadmap completo das Etapas 2–8.
