// "cardForeground" -> "--card-foreground"
export function tokenKeyToCssVar(key: string): string {
  const kebab = key.replace(/[A-Z0-9]/g, (m) => `-${m.toLowerCase()}`);
  return `--${kebab}`;
}
