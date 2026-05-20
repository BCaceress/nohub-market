import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — NoHub Market",
  description: "Leia os Termos de Uso da plataforma NoHub Market.",
};

export default function TermsPage() {
  return (
    <article className="flex flex-col gap-6 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="mt-1 text-xs text-muted-foreground">Última atualização: maio de 2025</p>
      </div>

      <Section title="1. Aceitação dos Termos">
        <p>
          Ao acessar ou utilizar a plataforma <strong>NoHub Market</strong> ("Plataforma"), você concorda
          com estes Termos de Uso e com nossa{" "}
          <a href="/privacy" className="text-primary underline underline-offset-4 hover:opacity-80">
            Política de Privacidade
          </a>
          . Se você não concordar com qualquer disposição, não utilize a Plataforma.
        </p>
      </Section>

      <Section title="2. Descrição do Serviço">
        <p>
          O NoHub Market é um sistema de gestão para mercados autônomos, conveniências e vendas online.
          A Plataforma oferece funcionalidades de cadastro de produtos, gestão de canais de venda,
          controle de fornecedores, unidades e relatórios operacionais.
        </p>
      </Section>

      <Section title="3. Elegibilidade">
        <p>
          Para utilizar a Plataforma, você deve: (a) ter pelo menos 18 anos de idade; (b) ter
          capacidade legal para celebrar contratos; (c) representar uma pessoa jurídica ou atuar como
          profissional autônomo com CNPJ ou CPF válido.
        </p>
      </Section>

      <Section title="4. Cadastro e Conta">
        <p>
          Você é responsável por manter a confidencialidade de suas credenciais de acesso. Qualquer
          atividade realizada sob sua conta é de sua responsabilidade. Notifique-nos imediatamente em
          caso de acesso não autorizado.
        </p>
        <p>
          Ao se cadastrar, você fornece informações verdadeiras, precisas e completas. A criação de
          contas com dados falsos ou para fins fraudulentos é proibida e sujeita ao encerramento
          imediato.
        </p>
      </Section>

      <Section title="5. Planos e Pagamentos">
        <p>
          A Plataforma pode oferecer planos gratuitos e pagos. Os valores, periodicidade e condições
          de cada plano são exibidos no momento da contratação. Nos planos pagos:
        </p>
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>A cobrança é realizada antecipadamente pelo período contratado.</li>
          <li>Cancelamentos não geram reembolso proporcional, salvo disposição legal em contrário.</li>
          <li>O não pagamento pode resultar na suspensão do acesso.</li>
        </ul>
      </Section>

      <Section title="6. Uso Permitido">
        <p>
          É permitido utilizar a Plataforma para fins lícitos relacionados à sua atividade comercial.
          É expressamente proibido:
        </p>
        <ul className="list-disc list-inside flex flex-col gap-1 ml-2">
          <li>Realizar engenharia reversa, decompilação ou tentativa de obter o código-fonte.</li>
          <li>Utilizar a Plataforma para atividades ilegais, fraudulentas ou que violem direitos de terceiros.</li>
          <li>Revender ou sublicenciar o acesso à Plataforma sem autorização expressa.</li>
          <li>Introduzir vírus, malware ou qualquer código malicioso.</li>
          <li>Sobrecarregar deliberadamente a infraestrutura da Plataforma (DDoS, scraping abusivo etc.).</li>
        </ul>
      </Section>

      <Section title="7. Propriedade Intelectual">
        <p>
          Todo o conteúdo da Plataforma — software, marcas, logos, textos, gráficos e interfaces —
          é propriedade exclusiva do NoHub Market ou de seus licenciadores, protegido pelas leis
          brasileiras (Lei nº 9.279/1996 e Lei nº 9.610/1998).
        </p>
        <p>
          Os dados cadastrados por você permanecem de sua propriedade. Você concede ao NoHub Market
          licença limitada e não exclusiva para armazenar e processar esses dados para prestação dos
          serviços contratados.
        </p>
      </Section>

      <Section title="8. Disponibilidade e SLA">
        <p>
          Empenhamo-nos para manter a Plataforma disponível 99% do tempo mensal, excluídas
          manutenções programadas (comunicadas com 24 h de antecedência) e eventos de força maior.
          Não garantimos disponibilidade ininterrupta.
        </p>
      </Section>

      <Section title="9. Limitação de Responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, o NoHub Market não será responsável por danos
          indiretos, incidentais, especiais, punitivos ou consequentes, incluindo lucros cessantes
          ou perda de dados. Nossa responsabilidade total fica limitada ao valor pago pelos serviços
          nos 12 meses anteriores ao evento que originou a reclamação.
        </p>
      </Section>

      <Section title="10. Rescisão">
        <p>
          Qualquer parte pode rescindir o contrato a qualquer momento. O NoHub Market pode suspender
          ou encerrar seu acesso imediatamente em caso de violação destes Termos. Após a rescisão,
          você poderá exportar seus dados por até 30 dias, após os quais serão excluídos, salvo
          obrigação legal de retenção.
        </p>
      </Section>

      <Section title="11. Legislação Aplicável e Foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. As partes elegem o
          foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias, com renúncia expressa
          a qualquer outro.
        </p>
      </Section>

      <Section title="12. Alterações">
        <p>
          Podemos alterar estes Termos periodicamente. Publicaremos a versão atualizada nesta página
          e atualizaremos a data de "última atualização". O uso continuado da Plataforma após a
          publicação constitui aceitação das alterações.
        </p>
      </Section>

      <Section title="13. Contato">
        <p>
          Em caso de dúvidas:{" "}
          <a href="mailto:legal@nohub.com.br" className="text-primary underline underline-offset-4 hover:opacity-80">
            legal@nohub.com.br
          </a>
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
