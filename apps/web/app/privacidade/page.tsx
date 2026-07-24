export const metadata = {
  title: "Privacidade — Second Soul",
  description: "O que guardamos, por quê, e como apagar.",
};

export default function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <a href="/" className="text-sm text-soul underline underline-offset-4">
        ← Voltar
      </a>
      <h1 className="mt-6 font-display text-4xl leading-tight text-ink">
        O que fazemos com o que você guarda
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-muted">
        O Second Soul guarda memórias — coisas íntimas, escritas por pessoas que
        querem ser lembradas. Esta página diz, sem rodeios, o que acontece com
        elas.
      </p>

      <section className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted">
        <div>
          <h2 className="font-display text-xl text-ink">O que guardamos</h2>
          <p className="mt-2">
            O que você escreve no perfil, as memórias que adiciona (textos,
            documentos, imagens, gravações), e — se você escolher importar — as
            conversas do arquivo que enviar. Gravações de áudio e vídeo são
            transcritas em texto.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">Onde isso fica</h2>
          <p className="mt-2">
            Em servidores nos Estados Unidos. Para gerar as respostas da
            conversa, trechos das suas memórias são enviados a um provedor de
            inteligência artificial (Groq). Isso significa transferência
            internacional de dados — você precisa saber disso antes de decidir.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">
            Dados sensíveis são removidos
          </h2>
          <p className="mt-2">
            Ao importar conversas, um filtro remove CPF, cartões, senhas,
            telefones e e-mails antes de guardar. O filtro é bom, não é
            perfeito: confira o que enviar.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">Quem tem acesso</h2>
          <p className="mt-2">
            Quem tiver o link do acervo. Não há senha ainda — o link é a chave.
            Guarde-o como guardaria uma chave de casa, e não o compartilhe com
            quem não deve entrar.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">Seus direitos</h2>
          <p className="mt-2">
            Você pode <b className="text-ink">levar tudo embora</b> num arquivo, a
            qualquer momento, e pode{" "}
            <b className="text-ink">apagar tudo para sempre</b>. Os dois botões
            ficam na tela do seu acervo. Apagar é imediato e não tem volta.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl text-ink">
            Isto é uma versão de testes
          </h2>
          <p className="mt-2">
            O Second Soul está em fase de testes. Coisas podem falhar. Não use
            como único lugar de guarda do que é insubstituível — mantenha os
            originais com você.
          </p>
        </div>
      </section>
    </main>
  );
}
