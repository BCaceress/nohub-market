import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — NoHub Market",
  description: "Saiba como o NoHub Market coleta, usa e protege seus dados pessoais.",
};

export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-6 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-1 text-xs text-muted-foreground">Última atualização: maio de 2025</p>
      </div>

      <p className="text-muted-foreground">
        Esta Política descreve como o <strong className="text-foreground">NoHub Market</strong>{" "}
        coleta, utiliza, armazena e compartilha seus dados pessoais, em conformidade com a{" "}
        <strong className="text-foreground">
          Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)
        </strong>{" "}
        e o{" "}
        <strong className="text-foreground">Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
      </p>

      <Section title="1. Controlador dos Dados">
        <p>
          O controlador responsável pelo tratamento de seus dados é o NoHub Market, com sede no
          Brasil. Para exercer seus direitos, contate nosso DPO:{" "}
          <a
            href="mailto:privacidade@nohub.com.br"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            privacidade@nohub.com.br
          </a>
          .
        </p>
      </Section>

      <Section title="2. Dados que Coletamos">
        <p className="font-medium text-foreground">2.1 Fornecidos por você</p>
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>
            <strong>Cadastro:</strong> nome, e-mail, senha (hash bcrypt), CNPJ/CPF, razão social e
            endereço.
          </li>
          <li>
            <strong>Perfil:</strong> foto de perfil (opcional), nome de exibição.
          </li>
          <li>
            <strong>Dados de negócio:</strong> produtos, fornecedores, canais de venda, unidades e
            demais registros.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.2 Coletados automaticamente</p>
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>Endereço IP, navegador, sistema operacional e dispositivo.</li>
          <li>Páginas visitadas, tempo de sessão e logs de auditoria.</li>
          <li>Cookies de sessão e preferências de tema (localStorage).</li>
        </ul>
      </Section>

      <Section title="3. Finalidades e Bases Legais (Art. 7º LGPD)">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-foreground">Finalidade</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground">Base legal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Prestação dos serviços contratados", "Execução de contrato (Art. 7º, V)"],
                [
                  "Autenticação e segurança da conta",
                  "Execução de contrato / Legítimo interesse (Art. 7º, IX)",
                ],
                [
                  "E-mails transacionais (convites, notificações)",
                  "Execução de contrato (Art. 7º, V)",
                ],
                ["Cumprimento de obrigações legais e fiscais", "Obrigação legal (Art. 7º, II)"],
                ["Melhoria contínua da Plataforma (analytics)", "Legítimo interesse (Art. 7º, IX)"],
                ["Comunicações de marketing (opt-in)", "Consentimento (Art. 7º, I)"],
              ].map(([fin, base]) => (
                <tr key={fin} className="hover:bg-muted/50">
                  <td className="px-3 py-2">{fin}</td>
                  <td className="px-3 py-2 text-muted-foreground">{base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. Compartilhamento de Dados">
        <p>Não vendemos seus dados pessoais. Podemos compartilhá-los com:</p>
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>
            <strong>Infraestrutura:</strong> provedores de nuvem (ex.: Neon, Vercel) vinculados por
            DPA.
          </li>
          <li>
            <strong>E-mail transacional:</strong> para envio de convites e notificações
            operacionais.
          </li>
          <li>
            <strong>Autoridades públicas:</strong> quando exigido por lei ou ordem judicial.
          </li>
        </ul>
      </Section>

      <Section title="5. Transferência Internacional">
        <p>
          Alguns provedores podem processar dados fora do Brasil. Garantimos que essas
          transferências ocorrem para países com proteção adequada ou com cláusulas contratuais
          aprovadas pela ANPD (Art. 33, LGPD).
        </p>
      </Section>

      <Section title="6. Retenção de Dados">
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>Conta ativa: mantidos durante a vigência do contrato.</li>
          <li>Logs de auditoria: 12 meses, salvo obrigação legal diversa.</li>
          <li>
            Pós-encerramento: 30 dias para exportação; após isso, exclusão segura (exceto dados com
            obrigação fiscal).
          </li>
        </ul>
      </Section>

      <Section title="7. Segurança">
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>Senhas armazenadas com hash bcrypt.</li>
          <li>Comunicações criptografadas via TLS/HTTPS.</li>
          <li>Controle de acesso baseado em funções (RBAC).</li>
          <li>Autenticação de dois fatores (TOTP) disponível para todos os usuários.</li>
          <li>Logs de auditoria para rastreabilidade de ações.</li>
          <li>Revisões periódicas de segurança.</li>
        </ul>
      </Section>

      <Section title="8. Seus Direitos (Art. 18 LGPD)">
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>
            <strong>Confirmação e acesso:</strong> saber se tratamos seus dados e obter uma cópia.
          </li>
          <li>
            <strong>Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados.
          </li>
          <li>
            <strong>Anonimização ou eliminação:</strong> de dados desnecessários ou em
            desconformidade.
          </li>
          <li>
            <strong>Portabilidade:</strong> receber seus dados em formato estruturado e
            interoperável.
          </li>
          <li>
            <strong>Revogação do consentimento:</strong> retirar o consentimento a qualquer momento.
          </li>
          <li>
            <strong>Oposição:</strong> opor-se a tratamentos baseados em legítimo interesse.
          </li>
          <li>
            <strong>Revisão de decisões automatizadas:</strong> solicitar revisão humana.
          </li>
        </ul>
        <p>
          Solicitações:{" "}
          <a
            href="mailto:privacidade@nohub.com.br"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            privacidade@nohub.com.br
          </a>
          . Respondemos em até 15 dias úteis.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>Utilizamos apenas cookies estritamente necessários:</p>
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>Manutenção da sessão autenticada.</li>
          <li>Preferências de tema (localStorage — não é cookie de rastreamento).</li>
        </ul>
        <p>
          Não usamos cookies de rastreamento de terceiros para publicidade. Você pode limpar cookies
          pelo navegador a qualquer momento (pode afetar o funcionamento da Plataforma).
        </p>
      </Section>

      <Section title="10. Menores de Idade">
        <p>
          A Plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente dados de
          menores. Caso identificado, os dados serão excluídos imediatamente.
        </p>
      </Section>

      <Section title="11. Alterações desta Política">
        <p>
          Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas por
          e-mail e/ou notificação na Plataforma com pelo menos 15 dias de antecedência. O uso
          continuado implica aceitação.
        </p>
      </Section>

      <Section title="12. Contato e DPO">
        <p>
          Dúvidas ou reclamações:{" "}
          <a
            href="mailto:privacidade@nohub.com.br"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            privacidade@nohub.com.br
          </a>
        </p>
        <p>
          Você também pode acionar a{" "}
          <strong className="text-foreground">
            Autoridade Nacional de Proteção de Dados (ANPD)
          </strong>
          :{" "}
          <a
            href="https://www.gov.br/anpd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            www.gov.br/anpd
          </a>
          .
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-muted-foreground">{children}</div>
    </section>
  );
}
