# Separação de Vozes — Análise e Incertezas

Uma conta de ChatGPT ≠ uma pessoa. No público do Second Soul (idoso/legado), a
conta compartilhada é a norma — é o filho/neto que ajuda o idoso a usar. Sem
separar as vozes, o gêmeo vira um Frankenstein. Este documento registra o que
foi validado, com que dados, e o que ainda é incerto.

## Como funciona (2 estágios)

1. **Super-agrupa por tema** (semântica: TF-IDF→SVD, ou embeddings neurais).
   Isso separa assunto com alta pureza, mas fragmenta uma pessoa em vários temas.
2. **Funde por estilo** (frase, gíria, código, pontuação = assinatura da pessoa).
   O nº de vozes vem do **maior salto** no dendrograma das assinaturas — estável,
   ao contrário do silhouette.
3. **Confiança por margem**: cada fala recebe uma margem (distância à própria voz
   vs. à rival). Falas neutras/curtas ficam com margem baixa → **ambíguas**.

## O que foi validado (conta sintética 2 pessoas: garoto codando + mãe estudiosa)

| Corte de confiança | Falas mantidas | Pureza |
|---|---|---|
| tudo | 71/80 | 89% |
| ≥ 0.05 | 66/80 | 94% |
| ≥ 0.10 | 62/80 | 97% |
| ≥ 0.15 | 54/80 | 98% |

**Conclusões validadas:**
- O nº de pessoas é detectado corretamente (2) pelo critério do maior salto.
- O estilo distingue as pessoas onde o tema falha (garoto: código 0.14, gíria 4.1;
  mãe: código 0.01, gíria 1.2).
- Existe um trade-off **precisão × recall** ajustável: subir o corte de confiança
  leva a pureza a ~98%, descartando as ambíguas. Para o gêmeo, **precisão importa
  mais** — melhor perder falas neutras do que contaminar a essência.

## Incertezas mapeadas

| # | Incerteza | Status | Mitigação |
|---|---|---|---|
| U1 | Clustering separa TEMA, não pessoa | **confirmada** | 2º estágio por estilo funde temas na pessoa |
| U2 | Nº de pessoas desconhecido | tratada | maior salto do dendrograma (não silhouette) |
| U3 | Falas neutras não têm assinatura | **confirmada** | marcadas ambíguas; corte de confiança |
| U4 | Duas pessoas com o MESMO tema E estilo | **em aberto** | só resolvível com metadados (horário/conversa) — ver abaixo |
| U5 | Escala (contas de 50k+ falas) | parcial | amostragem representativa; embeddings em lote |
| U6 | Peso do modelo neural (torch ~2GB) | tratada | TF-IDF offline como padrão; neural é opcional |
| U7 | Determinismo | tratada | seeds fixas; mesmo input → mesmo resultado |

**U4 é a incerteza mais séria e honesta:** se duas pessoas compartilham tema *e*
estilo (ex.: dois irmãos adultos, ambos formais, falando dos mesmos assuntos), o
texto sozinho não separa. Aí só metadados ajudam — agrupar por sessão/conversa
(uma conversa costuma ser de uma pessoa só) e por horário de uso. Isso é o próximo
reforço se o teste com dado real mostrar mistura dentro do mesmo estilo.

## Por que isto vira produto (operator-in-the-loop)

O algoritmo **propõe**, o humano **decide**. O app mostra as vozes com amostras e
estilo; o operador reconhece na hora ("essa é minha mãe, essa é meu filho"),
nomeia, e escolhe qual preservar. As ambíguas são descartadas por padrão (precisão).
Nenhum concorrente que começa "do zero com perguntas" enfrenta isso — o fosso está
justamente aqui.

## Próximo passo de validação

Rodar no `teste.jsonl` **real** (5.379 falas, garoto codando + mãe). Se as duas
vozes reais saírem separadas e reconhecíveis, a hipótese está validada em produção.
Se aparecer mistura dentro do mesmo estilo, ativamos o reforço de metadados (U4).
