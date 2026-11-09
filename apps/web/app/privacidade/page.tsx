export const metadata = {
  title: "Privacidade — Second Soul",
  description: "O que guardamos, por quê, e como você controla.",
};

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl text-ink">{titulo}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export default function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <a href="/" className="text-sm text-soul underline underline-offset-4">
        ← Voltar
      </a>
      <h1 className="mt-6 font-display text-4xl leading-tight text-ink">
        Política de Privacidade
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        O Second Soul guarda memórias — coisas íntimas, escritas por pessoas que
        querem ser lembradas. Esta página diz, sem rodeios, o que acontece com
        elas e como você mantém o controle. Tratamos privacidade como a espinha
        do produto, não como letra miúda.
      </p>

      <section className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted">
        <Bloco titulo="Quem é o responsável">
          <p>
            O Second Soul é operado pela Hack Tech Farm. Para qualquer pedido
            sobre seus dados — acesso, correção, exclusão, portabilidade ou
            revogação de consentimento — fale pelo e-mail{" "}
            <b className="text-ink">hacktechfarm@proton.me</b>.
          </p>
        </Bloco>

        <Bloco titulo="O que guardamos">
          <p>
            Os dados da sua conta (e-mail e nome), o que você escreve no perfil e
            as memórias que adiciona (textos, documentos, imagens, gravações). Se
            você escolher importar conversas, também o conteúdo do arquivo
            enviado. Gravações de áudio e vídeo são transcritas em texto.
          </p>
        </Bloco>

        <Bloco titulo="Base legal">
          <p>
            Tratamos seus dados com base no seu <b className="text-ink">
            consentimento</b>, que você dá em itens separados antes de começar:
            para os dados sensíveis que as memórias possam revelar (art. 11 da
            LGPD), para a transferência internacional (art. 33) e para o
            processamento por inteligência artificial. Você pode revogar esse
            consentimento a qualquer momento, apagando seus dados.
          </p>
        </Bloco>

        <Bloco titulo="Onde isso fica, e a transferência internacional">
          <p>
            Os dados ficam em servidores nos <b className="text-ink">Estados
            Unidos</b>. Para gerar as respostas da conversa, trechos das suas
            memórias são enviados a um provedor de inteligência artificial
            (Groq). Isso configura transferência internacional de dados, e por
            isso pedimos seu consentimento específico para ela.
          </p>
        </Bloco>

        <Bloco titulo="Quem tem acesso">
          <p>
            O acesso é por conta, com e-mail e senha. Você é o dono da sua
            essência e decide quem acessa: pode convidar pessoas em vida, e
            designar herdeiros, que recebem acesso conforme você definir — em
            vida ou liberado depois. Ninguém além de quem você autorizar
            conversa com o seu gêmeo ou vê o seu acervo.
          </p>
        </Bloco>

        <Bloco titulo="Pagamento">
          <p>
            As cobranças são processadas pela Stripe. Os dados do seu cartão são
            tratados diretamente por ela — o Second Soul <b className="text-ink">
            não armazena número de cartão</b>. Guardamos apenas o registro do seu
            plano e da situação da assinatura.
          </p>
        </Bloco>

        <Bloco titulo="Por quanto tempo guardamos, e o que acontece se você parar de pagar">
          <p>
            Enquanto sua assinatura (plano Premium) estiver ativa, ou de forma
            perpétua no plano Herança, mantemos sua essência. Se um plano Premium
            deixar de ser pago, há um período de carência:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>após 3 meses sem pagamento, o acesso à conversa com o gêmeo é suspenso;</li>
            <li>por mais 6 meses, você ainda pode exportar todas as memórias;</li>
            <li>passado esse prazo, os dados são apagados em definitivo.</li>
          </ul>
        </Bloco>

        <Bloco titulo="Seus direitos">
          <p>
            A LGPD garante, e nós respeitamos: confirmação de que tratamos seus
            dados e acesso a eles; correção; anonimização ou exclusão;
            portabilidade; informação sobre com quem compartilhamos; e a
            revogação do consentimento. Na prática, você pode a qualquer momento{" "}
            <b className="text-ink">levar tudo embora</b> num arquivo (exportar) e{" "}
            <b className="text-ink">apagar tudo para sempre</b> — os botões ficam
            na sua essência, e apagar é imediato e não tem volta. Para qualquer
            outro pedido, use o e-mail de contato acima.
          </p>
        </Bloco>

        <Bloco titulo="Dados sensíveis na importação">
          <p>
            Ao importar conversas, um filtro remove CPF, cartões, senhas,
            telefones e e-mails antes de guardar. O filtro é bom, não é perfeito:
            confira o que enviar.
          </p>
        </Bloco>

        <Bloco titulo="Alterações">
          <p>
            Podemos atualizar esta política. Mudanças relevantes serão avisadas
            pelo e-mail da sua conta. Última atualização: novembro de 2026.
          </p>
        </Bloco>
      </section>
    </main>
  );
}
