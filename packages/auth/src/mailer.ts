import { getEnv } from "@nohub/shared/env";
import { Resend } from "resend";

const env = getEnv();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  // Sem RESEND_API_KEY (dev): loga no console em vez de falhar (decisão 14 análoga).
  if (!resend) {
    console.log(`\n📧 [DEV EMAIL] → ${opts.to}\n   ${opts.subject}\n   ${opts.html}\n`);
    return;
  }
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export function link(label: string, url: string) {
  return `<p><a href="${url}">${label}</a></p><p style="color:#71717A;font-size:12px">${url}</p>`;
}
