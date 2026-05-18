import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import tokens from "./tokens";
import { tokenKeyToCssVar } from "./utils";

const GLOBALS = join(process.cwd(), "apps/web/src/app/globals.css");
const START = "/* === DESIGN TOKENS (gerado por design-system/generate-css.ts — não editar) === */";
const END = "/* === FIM DESIGN TOKENS === */";

function block(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([k, v]) => `  ${tokenKeyToCssVar(k)}: ${v};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

function buildCss(): string {
  const lightVars = {
    ...tokens.colors.light,
    ...prefix("sidebar", tokens.sidebar.light),
    ...prefix("radius", tokens.radius),
  };
  const darkVars = {
    ...tokens.colors.dark,
    ...prefix("sidebar", tokens.sidebar.dark),
  };
  return [START, block(":root", lightVars), block(".dark", darkVars), END].join("\n\n");
}

function prefix(p: string, obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [`${p}${k.charAt(0).toUpperCase()}${k.slice(1)}`, v]),
  );
}

function splice(source: string, generated: string): string {
  const s = source.indexOf(START);
  const e = source.indexOf(END);
  if (s === -1 || e === -1) {
    return `${generated}\n\n${source}`;
  }
  return source.slice(0, s) + generated + source.slice(e + END.length);
}

const css = buildCss();
const check = process.argv.includes("--check");

let current = "";
try {
  current = readFileSync(GLOBALS, "utf8");
} catch {
  if (check) {
    console.error("❌ globals.css não encontrado. Rode `pnpm tokens` primeiro.");
    process.exit(1);
  }
}

const next = splice(current, css);

if (check) {
  if (current.trim() !== next.trim()) {
    console.error("❌ Tokens fora de sincronia. Rode `pnpm tokens` e faça commit.");
    process.exit(1);
  }
  console.log("✅ Design tokens sincronizados.");
} else {
  writeFileSync(GLOBALS, next.endsWith("\n") ? next : `${next}\n`);
  console.log("✅ globals.css atualizado com os design tokens.");
}
