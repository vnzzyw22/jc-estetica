# Jennifer Camila — Direção de arte

Documento de referência do projeto. Toda decisão de componente volta aqui. Se o código
contradiz este arquivo, o código está errado (ou este arquivo precisa ser atualizado de
propósito).

## 1. Pesquisa e o que ela mostrou

Referências analisadas (por princípio, sem copiar nada): sites de estética/skincare
listados em rankings de 2026 (Colorlib, CreateToday, 99designs, Awwwards "editorial
layout" e "serif + sans"), mais o padrão do Lkas Locs apenas como referência *funcional*
(estrutura de agendamento e painel).

Padrões dominantes do nicho — os que este projeto **não** usa:

| Padrão do nicho | Por que evitar |
|---|---|
| Burgundy + creme, ou rosa pastel + branco | É a "cor de clínica de estética" de qualquer cidade |
| Serifada empilhada com uma palavra em itálico no hero | Tell de template gerado por IA |
| Cards de tratamento com nome sobre foto full-bleed | É o grid de "serviços" que o briefing proíbe |
| Faixas/marquees dourados, polaroids inclinadas | "Luxo" de prateleira |
| Instrument Serif / Fraunces / Inter / Manrope / Playfair | As fontes que todo mundo escolhe para "elegante" |
| Mulher sorrindo + texto centralizado | Stock photo com legenda |

O que a pesquisa deixou como princípio aproveitável: fotografia como protagonista,
tipografia grande com respiro, animação com sensação de spa (lenta, sem quique).

## 2. Conceito: "A leitura"

Uma esteticista **lê** um rosto ou um corpo antes de tocar. Observa, mede, marca zonas,
decide. A marca Jennifer Camila é essa leitura atenta: precisão clínica (medida, marca,
registro) com o toque de quem cuida (calor de pele, escala humana, voz direta).

Traduzido em linguagem visual:

- **Precisão clínica** → uma régua fina de escala na margem esquerda que acompanha o
  scroll (função real: indica onde você está na página); cruzes de registro (`+`) nos
  cantos das fotografias, como marcas de corte de uma prova de gráfica; números
  tabulares para duração, preço e horário.
- **Editorial de beleza** → nome grande como elemento de marca, composição assimétrica,
  fotografia em escalas diferentes, texto que atravessa a imagem.
- **Toque humano** → paleta de pele (não de "feminilidade"), texto em primeira pessoa,
  linhas pequenas de voz ("Jennifer responde no mesmo dia" só quando for verdade e
  editável), nenhum ícone genérico.

Estruturas gráficas só existem quando carregam informação: numeração só em sequências
reais (passos do agendamento); régua só como indicador de posição; marcas de registro só
em molduras de imagem.

## 3. Paleta — "Pele e bisturi"

Não é rosa. É a família de tons de pele, um marrom de café e **um** verde clínico
dessaturado usado como sinal (foco, status, links, marcas).

| Token | Hex | Papel |
|---|---|---|
| `porcelana` | `#EFE9E3` | fundo principal (cinza-rosado, não creme amarelado) |
| `seda` | `#E4D8CF` | superfície secundária, faixas de seção |
| `nude` | `#D3B9A9` | placeholders de foto, blocos de cor |
| `rose` | `#B98A7E` | rosé discreto — só decorativo/hover, nunca texto |
| `espresso` | `#241A18` | texto principal e seção escura (agendamento) |
| `cafe` | `#5A4A44` | texto secundário (contraste 7,0:1 sobre porcelana, 6,0:1 sobre seda) |
| `bisturi` | `#3E5B4F` | acento controlado: foco, links, status, marcas (6,2:1 sobre porcelana) |
| `alerta` | `#9B2C2C` | erro |

Justificativa: o verde-bisturi é a "precisão clínica" dentro de uma paleta que, sem ele,
seria só "nude bonito". Aparece em quantidade mínima (menos de 5% da superfície).
Risco reconhecido: fundo quente + serifada é o cluster mais comum de IA; a saída é o
verde (em vez de terracota/dourado), a régua e a estrutura assimétrica — não a paleta
isolada.

## 4. Tipografia

- **Display: Newsreader** (variável, eixo óptico `opsz`), pesos 300–400, itálico
  reservado a citações e ênfase de frase inteira (nunca uma palavra solta destacada).
  Em tamanhos grandes o eixo óptico dá contraste fino; em corpo médio, robustez. Tracking
  negativo (-0.02em) só acima de 48px.
- **Texto e UI: Hanken Grotesk**, pesos 400/500/600. Numerais tabulares
  (`font-variant-numeric: tabular-nums`) em horário, preço e duração.
- Nada de caixa-alta espaçada como rótulo. Rótulos pequenos são sentence case, 13px,
  `cafe`. Máximo de 3 pesos em uso.
- Escala (fluida, `clamp`): `nome 5,25–13rem`, `h1 2,6–6rem`, `h2 2,1–4,4rem`,
  `h3 1,5–2rem`, corpo `1.0625rem/1.65`, legenda `0.8125rem/1.5`.
- Subsets `latin` + `latin-ext` (para não perder Ç/Ã).

## 5. Layout

Grid de 12 colunas, margem lateral 20px (mobile) a 64px (desktop). A **régua** ocupa uma
coluna de 40px à esquerda no desktop (oculta no mobile, onde vira uma barra de progresso
de 2px no topo). Alinhamento à esquerda por padrão; centralização só em confirmações.

```
HERO (desktop)
┌──┬──────────────────────────────────────────────┐
│r │ Jennifer                     ┌───────────────┤
│é │        Camila ───────────────┼──▶ +         + │
│g │                              │   [foto]      │
│u │ Estética facial e corporal   │   4:5, sangra │
│a │ [Localidade]                 │   à direita   │
│  │ Próximo horário: qua 14:30 ↗ │   +         + │
└──┴──────────────────────────────┴───────────────┘
```

Ritmo entre seções: alternância deliberada de densidade — hero pesado, filosofia
respirada (uma frase enorme), procedimentos densos e interativos, galeria horizontal,
sobre editorial, agendamento escuro, FAQ estreito, fechamento com o nome.

## 6. Estrutura narrativa da home

1. **Introdução** — nome, foto, próximo horário livre (dado real do sistema).
2. **Filosofia** — uma declaração longa em serifada + duas imagens em escalas diferentes.
3. **Procedimentos** — índice lateral (Facial / Corporal / Protocolos); a categoria
   escolhida abre uma lista grande: nome, indicação, duração, preço, "agendar este".
4. **Resultados/galeria** — faixa horizontal com escalas mistas; fotos reais só do admin.
5. **Profissional e espaço** — composição editorial; conteúdo real via admin.
6. **Agendamento** — seção escura: os 4 passos (sequência real) + próximos horários.
7. **FAQ** — accordion editorial de linhas finas.
8. **Fechamento** — o nome de novo, grande; contatos; rodapé sem "missão/valores".

## 7. Imagem

- Nenhuma imagem inventada ou de banco de imagens. **Não há fotos da Jennifer nesta
  entrega.** Geração por IA foi avaliada e descartada: não há chave de API de imagem
  configurada no ambiente, e fotos de resultados (antes/depois) ou da própria
  profissional geradas por IA seriam enganosas num site de serviço de saúde/estética.
- Todo espaço de foto é um **slot nomeado** (`hero`, `filosofia-1`, `filosofia-2`,
  `sobre`, `espaco`…). Sem imagem, o slot renderiza um bloco `nude` com marcas de
  registro e a legenda `[Foto profissional da Jennifer]`. Com imagem (upload no admin,
  bucket `media`), o mesmo slot passa a renderizar `next/image` com o crop definido.
- Proporções: hero 4:5; filosofia 3:4 e 1:1; sobre 4:5; galeria mista (3:4, 4:5, 1:1, 5:4).

## 8. Motion

- **Um** momento orquestrado: na carga do hero, as duas linhas do nome sobem de dentro
  de uma máscara (`clip-path`), em sequência, uma vez.
- Scroll: foto do hero com escala 1.08→1 e deslocamento vertical de poucos pixels;
  a régua acompanha a posição. Nada mais é parallax.
- Reveal de seções: apenas opacidade em blocos de texto longos (sem slide-up
  generalizado). Sem bounce, sem blur, sem neon.
- Respostas a ação: abertura de FAQ (altura), troca de categoria em Procedimentos
  (opacidade + deslocamento 8px), seleção de horário, avanço de passo.
- Duração 240–700ms; easing `cubic-bezier(.22,.61,.36,1)` (saída suave).
- `prefers-reduced-motion`: tudo vira estado final imediato.

## 9. Componentes (decisões)

- **Botões**: retangulares com cantos de 2px; primário = espresso preenchido; secundário
  = texto com sublinhado que se desenha. Nenhum pill. Sem seta `→` automática.
- **Raio**: 2px em controles, 0 em imagens. **Sombra**: nenhuma (profundidade por cor).
- **Linhas**: 1px `rgba(espresso, .18)`. Usadas para separar itens de lista, não para
  encaixotar tudo.
- **Serviços**: lista editorial, não cards.
- **FAQ**: linhas com título serifado e `+`/`−` tipográfico.
- **Galeria**: faixa horizontal com scroll-snap, escalas mistas, lightbox simples.
- **Agendamento**: passos verticais, ficha-resumo lateral (desktop) / barra fixa inferior
  (mobile). Calendário de mês com células de 44px.
- **Ícones**: nenhum decorativo. Só glifos tipográficos (`+`, `−`, `×`) e SVG funcional
  (setas do calendário, fechar).
- **WhatsApp**: link textual dentro do fluxo (confirmação, contato, rodapé). Sem botão
  flutuante verde.

## 10. Revisão do plano contra o briefing (crítica antes de codar)

Perguntas do briefing aplicadas ao plano:

- *"Se eu remover o logo, ainda parece template?"* → A régua, as marcas de registro e a
  assimetria do hero não existem em template de estética. Mantido.
- Primeira versão do plano usava numeração (01–08) nas seções → **removida**: as seções
  não são uma sequência; numeração ficou só nos passos do agendamento.
- Primeira versão usava seta `→` nos CTAs e rótulos em caixa-alta → **removidos**
  (regras de anti-tell do fluxo global).
- Primeira versão tinha o verde como cor de fundo de uma seção → **rebaixado** para
  sinal pontual; a seção escura é espresso.
- Risco remanescente: paleta quente + serifada. Mitigação: verde, régua, estrutura.
  Reavaliar em revisão visual com screenshots reais.

## 11. Conteúdo: regras

- Nada de formação, certificados, anos de experiência ou números inventados.
- Nomes de procedimentos, preços e durações do seed são **placeholders entre colchetes**
  (`[Procedimento facial 1]`). Preço vazio exibe "sob avaliação".
- Frases de voz da marca (hero, filosofia) vêm de `site_content`, com rascunho derivado
  do briefing ("beauty editorial + clinical precision + human touch") e marcadas como
  editáveis; textos factuais (sobre, endereço, WhatsApp) são placeholders explícitos.
- Localidade: `[Localidade]` até o cliente informar.

## 12. Revisão visual pós-implementação (screenshots reais, desktop e mobile)

Ajustes feitos depois de ver o resultado renderizado:

- Grade do hero corrigida (título com `col-start` explícito); máscara do nome ganhou folga superior (cortava o topo do "J" e do "C").
- Marcas de registro e legenda dos slots ficam fixas; só a imagem sofre o parallax (antes a escala empurrava as marcas para fora do quadro).
- Hero no mobile: foto 1:1 (era 4:5) para o CTA aparecer sem rolar; nome maior (mínimo 5,25rem).
- Galeria da home sem fotos mostra 3 molduras (eram 5, virava parede de placeholder).
- Tells removidos na checagem do quality-gate: travessão espaçado em label ("A — B"), pontos médios em textos meta, `→` no painel.
- Auditoria de interface: ARIA de grid/radio incorreta trocada por `group` + `aria-pressed`; menu mobile virou `<dialog>` (focus trap, Esc); hierarquia de títulos da /faq; `touch-action`, `color-scheme`, `text-wrap: balance`, `scroll-padding` (barra fixa não cobre foco).
- Risco que permanece: sem fotos reais, a home é majoritariamente tipografia e blocos nude. A identidade depende das fotografias da Jennifer; reavaliar quando existirem.

## 13. Etapa 2: tratamentos reais e a porta de entrada (triagem)

O site passa a conduzir para **descobrir o tratamento**, e não para escolher um procedimento avulso.

- **CTAs:** principal "Descobrir meu tratamento" (triagem), secundário "Conhecer os tratamentos". Agendar direto continua existindo (avaliação, retorno, tratamento específico), como caminho secundário: botão no menu só para a triagem; "Agendar" aparece nas linhas de tratamento, na seção escura e no fechamento.
- **Nova seção "Como começa"** (logo após a filosofia): linha do tempo vertical com o modelo de atendimento (Triagem, Avaliação, Plano de tratamento, Sessões e acompanhamento). A linha ecoa a régua do site e a ordem é uma sequência real, então não precisa de numeração.
- **Tratamentos** (antes "Procedimentos", rota `/tratamentos`, com redirecionamento permanente de `/servicos`): três categorias reais (Estética facial & olhar; corporal & modelagem; terapias integradas & bem-estar). As abas usam rótulos curtos. Linhas editoriais grandes; nada de cards.
- **Só o que é conhecido:** duração provisória (60 min, exigida pelo sistema para calcular horários) **não aparece**; só a duração marcada como confirmada no painel. Valor vazio não mostra "sob avaliação" repetido. Sem descrição, a linha fica só com o nome. Nenhum "R$ 0,00".
- **Página do tratamento:** título e ações alinhados às bordas da foto (título no topo, CTAs na base), para o vazio ser composição e não sobra de conteúdo ausente.
- **/triagem** é provisória até a Etapa 3: explica que a triagem está sendo preparada e oferece agendar ou conversar no WhatsApp.

## 14. Etapa 3: a triagem (mobile primeiro)

- **Um assunto por tela.** Pergunta em serifada grande, opções como linhas com fio fino (nunca cartões), controle de escolha única em círculo e o consentimento em caixa de marcar: a forma diz o que o controle faz.
- **Progresso discreto:** cinco traços finos (eco da régua) e "Passo 2 de 5". Sem barra chamativa, sem porcentagem.
- **Ações:** barra fixa na base no celular (Voltar / Continuar) e inline no desktop, alinhada à coluna do formulário. Enter avança; setas trocam a opção; o foco vai ao título a cada passo.
- **Resumo antes de enviar,** com "Alterar" por linha, e confirmação em tela própria.
- **Linguagem:** sem jargão médico. Perguntas de saúde detalhadas ficam fora; há um campo opcional dizendo que isso é conversado na avaliação.
