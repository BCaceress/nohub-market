// Validadores e máscaras BR. PII helpers para logs (RN-12).

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCNPJ(input: string): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (slice: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(slice[i]) * w, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 13), w2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

export function isValidCPF(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (count: number) => {
    let sum = 0;
    for (let i = 0; i < count; i++) sum += Number(cpf[i]) * (count + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidCEP(input: string): boolean {
  return /^\d{8}$/.test(onlyDigits(input));
}

export function formatCNPJ(input: string): string {
  const d = onlyDigits(input).slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatCPF(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function formatCEP(input: string): string {
  const d = onlyDigits(input).slice(0, 8);
  return d.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

// ── PII masking para logs (RN-12) ──────────────────────────────────
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

export function maskDocument(doc: string): string {
  const d = onlyDigits(doc);
  if (d.length < 4) return "***";
  return `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
}

export function maskPhone(phone: string): string {
  const d = onlyDigits(phone);
  if (d.length < 4) return "***";
  return `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
}
