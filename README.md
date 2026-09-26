# Jennifer Camila — Estética facial e corporal

Site + agendamento online + painel administrativo. Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Supabase (Postgres, Auth, Storage), pronto para Vercel.

A direção de arte está em [DESIGN-DIRECTION.md](DESIGN-DIRECTION.md). Ela é a fonte de verdade para qualquer mudança visual.

## Requisitos

- Node.js 20 ou superior
- Conta no [Supabase](https://supabase.com) (produção) e na [Vercel](https://vercel.com) (deploy)

## Instalação e desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencha se for usar o Supabase
npm run dev                   # http://localhost:3000
```

### Modo local (sem Supabase)

Se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem vazias, o app usa um **Postgres local real** (PGlite, em `.data/pgdata`, ignorado pelo git) que roda as **mesmas migrações** do Supabase. Assim as regras de agenda, triagem, tratamentos e financeiro são idênticas às de produção.

- Painel: `/admin/login`, senha `ADMIN_LOCAL_PASSWORD` (padrão `dev-admin`).
- Uploads vão para `public/uploads` (ignorado pelo git).
- Dados demonstrativos (nomes fictícios, telefones inválidos): `npm run demo:load` / `npm run demo:clear`. Zerar tudo: `npm run db:reset`. **Pare o `npm run dev` antes**: o banco local aceita um processo por vez.
- **Em produção o modo local não existe**: sem as variáveis do Supabase o site mostra só o conteúdo público de exemplo, e agendamento, triagem e painel recusam qualquer escrita.

## Variáveis de ambiente

| Variável | Onde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | chave pública (`anon`); a segurança vem das políticas RLS |
| `NEXT_PUBLIC_SITE_URL` | você | URL final (canonical, sitemap, Open Graph) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | opcionais | Cloudflare Turnstile (gratuito) contra spam na triagem; sem as chaves, desligado |
| `ADMIN_LOCAL_PASSWORD` | só desenvolvimento | senha do painel no modo local |

Nenhuma chave secreta é usada no código. **Não use a `service_role` neste projeto.**

## Configurar o Supabase

1. Crie o projeto.
2. No **SQL Editor**, rode na ordem:
   1. [supabase/migrations/20260924120000_schema_inicial.sql](supabase/migrations/20260924120000_schema_inicial.sql) (site, agenda, clientes, RLS, `create_booking`, bucket `media`)
   2. [supabase/migrations/20260925120000_fundacao_clinica.sql](supabase/migrations/20260925120000_fundacao_clinica.sql) (triagem, anamnese, tratamentos, sessões, evolução, financeiro; requer a extensão `btree_gist`)
   3. [supabase/migrations/20260925130000_servicos_exibicao.sql](supabase/migrations/20260925130000_servicos_exibicao.sql) (só exibe duração confirmada)
   4. [supabase/migrations/20260925140000_triagem_publica.sql](supabase/migrations/20260925140000_triagem_publica.sql) (trava do termo de consentimento e estado da triagem comandado pela agenda)
   5. [supabase/migrations/20260926100000_anamnese.sql](supabase/migrations/20260926100000_anamnese.sql) (integridade da anamnese: um rascunho por cliente, conclusão exige data e conteúdo)
   6. [supabase/migrations/20260927100000_financeiro.sql](supabase/migrations/20260927100000_financeiro.sql) (financeiro: `create_receivable`, `change_payment_status`, `generate_recurring_expenses` e o caixa `cash_flow` com descrição, forma e categoria)
   7. [supabase/migrations/20260928100000_tratamentos_acoes.sql](supabase/migrations/20260928100000_tratamentos_acoes.sql) (tratamentos: `cancel_treatment`, `pause_treatment` e `save_package_services`; sem tabela nova)
   8. [supabase/seed.sql](supabase/seed.sql) (**produção**: configurações, horários padrão, os 12 serviços reais, categorias de despesa e placeholders de conteúdo; sem dados fictícios)
   Atalho: `npm run db:bundle` gera **um único arquivo** (`supabase/setup-completo.sql`) com tudo isso, para um projeto vazio. Em um projeto que já tem as migrações anteriores, rode só a nova.
   (Ou, com a CLI: `supabase link` + `supabase db push`, depois rode o seed.)
3. **Authentication → Users → Add user**: crie o login da Jennifer (e-mail + senha).
4. Torne essa conta administradora. No SQL Editor, com o `id` do usuário criado:
   ```sql
   insert into public.admin_profiles (user_id, display_name)
   values ('<UUID-DO-USUARIO>', 'Jennifer Camila');
   ```
   Ter conta no Auth não basta: sem esta linha o painel recusa o acesso.
5. **Authentication → Providers**: deixe só e-mail/senha; desative o cadastro público (*Allow new users to sign up*).

### Como o banco protege a agenda

- `appointments` tem uma restrição `EXCLUDE` (`tstzrange &&`): dois agendamentos não cancelados **não podem** se sobrepor, mesmo com dois cliques simultâneos. O segundo recebe "esse horário acabou de ser reservado".
- O público **não escreve** nas tabelas. O único caminho é a função `create_booking`, que revalida serviço ativo, antecedência, expediente, pausa e bloqueios, e faz upsert do cliente por telefone.
- O site calcula horários livres a partir da view `busy_slots`, que expõe só intervalos, sem nome nem telefone.
- Administração exige `is_admin()` em todas as tabelas; leitura pública só do que é conteúdo do site.

### Tabelas

Site e agenda: `admin_profiles`, `settings`, `availability`, `services`, `clients`, `appointments`, `blocked_slots`, `gallery`, `faq`, `site_content`.
Clínica e financeiro: `professionals`, `screenings`, `consent_terms`, `anamneses`, `treatment_packages`, `package_services`, `treatments`, `treatment_sessions`, `evolutions`, `payments`, `expense_categories`, `expenses` (+ views `treatment_progress` e `cash_flow`).

Modelo completo, regras, checklist de segurança para rodar no Supabase e riscos: [docs/DADOS-E-AMBIENTE.md](docs/DADOS-E-AMBIENTE.md).

## Testes

`npm test` roda os testes unitários (79: triagem, etapa da cliente, anamnese, regras do financeiro, de tratamentos e do dashboard) e os de SQL num Postgres real (104: RLS, conflito de agenda, triagem, anamnese, pacote → sessões → financeiro, recebimentos, recorrentes, cancelar e pausar tratamento). Os unitários importam arquivos `.ts` direto, o que exige Node 22.18 ou superior. Antes de publicar: `npm run lint && npm run typecheck && npm test && npm run build`.

## Triagem pública (`/triagem`)

Cinco passos curtos (queixa, objetivo, contexto, rotina, contato), resumo e confirmação. O rascunho fica só na aba do navegador (`sessionStorage`) e some ao enviar. Cada envio vira uma **triagem** (lead) em `/admin/triagens` e cria o cliente na hora, com nome e telefone só em `clients`.

- **Origem:** use `https://SEU-SITE/triagem?origem=instagram` no link da bio (`&campanha=reels-setembro` para detalhar). A origem é lembrada mesmo que a pessoa passe pela home antes.
- **Consentimento:** o texto oficial se cadastra em `/admin/consentimento`. **Em produção a triagem não recebe envios enquanto não houver um termo publicado** (o banco recusa). O ambiente local relaxa essa trava só para desenvolvimento.
- **Anti-spam:** campo-isca, tempo mínimo de preenchimento, limite por IP (melhor esforço), limite por telefone no banco (3 em 24 h) e, opcionalmente, Turnstile. Antes de divulgar o link, ative o Turnstile.

## Ficha da cliente e anamnese (`/admin/clientes/[id]`)

- **Resumo:** próximo agendamento, último atendimento, triagem, anamnese, dados de contato e **linha do tempo** (cadastro, triagens, anamneses, agenda, tratamentos).
- **Anamnese:** de um lado o que a cliente informou na triagem (pré-anamnese, somente leitura); do outro o registro profissional (avaliação, histórico, contraindicações, informações adicionais, observações). Tem rascunho, conclusão (fica somente leitura), reabertura e reavaliação (nova anamnese; a anterior fica no histórico). **Não há campo de diagnóstico.** Concluir a anamnese de uma triagem move a triagem para "Avaliada".
- **Etapa (calculada, nada gravado):** *Lead* enviou triagem e ainda não foi atendida; *Cliente* já foi atendida ou tem agendamento de serviço; *Em tratamento* tem tratamento ativo ou pausado. Tratamentos e financeiro têm abas próprias na ficha (ver as seções abaixo).

## Dashboard (`/admin/dashboard`)

A primeira tela responde "o que precisa da minha atenção agora?".

- **Precisa de atenção:** só o que é maior que zero, do mais urgente ao menos. Recebimentos atrasados (com o valor), sessões que passaram sem serem marcadas como realizadas, triagens novas esperando retorno, agendamentos aguardando confirmação, tratamentos em andamento sem sessão marcada e despesas atrasadas. Cada linha leva à lista já filtrada. Sem nada pendente: "Tudo em dia". A regra é pura e testada em `src/lib/dashboard.ts`.
- **Números do dia:** atendimentos de hoje, próximos 7 dias e tratamentos em andamento.
- **Agenda de hoje** e **próximos agendamentos** (14 dias).
- **Financeiro do mês:** resultado, recebido, a receber e a pagar, com atalho para o financeiro.
- **Tratamentos em andamento:** progresso e a próxima sessão; a que já passou aparece em vermelho.

## Tratamentos e pacotes (`/admin/tratamentos`, `/admin/pacotes`)

- **Pacotes** (catálogo): nome, objetivo, nº de sessões, valor, intervalo, validade e os **serviços do pacote em ordem**. Com mais de um serviço, eles se alternam nas sessões. Ao propor, o pacote é **copiado** para a cliente: mudar o pacote depois não altera tratamentos já criados.
- **Propor** (ficha da cliente, aba Tratamentos): a partir de um pacote ou **personalizado** (sem pacote; na cobrança por sessão o valor da sessão é obrigatório). Se a cliente tem triagem, o tratamento se liga a ela e o estado do lead avança sozinho.
- **Página do tratamento:** proposto → **Iniciar** (gera as sessões a agendar) → em andamento; **Pausar** e **Retomar** (não duplica sessões); **Cancelar** (cancela as sessões em aberto e libera os horários na agenda; sessões realizadas e cobranças ficam como estão). Só uma proposta pode ser excluída.
- **Sessões:** cada uma se agenda e se remarca pela agenda única (o conflito de horário é barrado pelo banco), pode trocar o serviço só naquela sessão e é **marcada como realizada** com uma nota opcional que vira evolução. Sessão realizada não volta atrás; a última encerra o tratamento.
- **Evolução:** notas de acompanhamento, com data e sessão. Não há campo de diagnóstico.
- **Financeiro do tratamento:** parcelas do pacote (`Gerar parcelas`) ou cobrança por sessão (gerada quando a sessão é realizada); ver [Financeiro](#financeiro-adminfinanceiro).
- **Lista geral** (`/admin/tratamentos`): em aberto por padrão, com progresso e a próxima sessão. Uma sessão marcada cujo horário já passou sem ser concluída aparece em vermelho.

## Financeiro (`/admin/financeiro`)

Quatro abas: **Visão geral** (resultado do mês em um número grande, recebido, pago, a receber, a pagar, atrasados e extrato por dia), **Recebimentos**, **Despesas** e **Relatórios**. Todas têm troca de mês pela URL (`?mes=2026-09`).

- **Recebimentos:** à vista ou parcelado (1 a 36; a última parcela absorve os centavos), avulso ou ligado a cliente, tratamento e atendimento. Filtros A receber, Recebidos, Atrasados e Cancelados. **Receber** abre o formulário na própria linha e exige a forma de pagamento. Recebido pode ser desfeito; cobrança cancelada pode ser restaurada; recebimento já pago não é apagado (desfaça antes). Cobrança por WhatsApp em pendentes e atrasados.
- **Despesas:** categorias fixas e variáveis, pagar e desfazer, e **Repetir despesas recorrentes** (cria as do mês, já a pagar; não duplica).
- **Relatórios:** resultado, série de 6 meses, recebido por forma e por tipo, despesas por categoria e fixas × variáveis, pendências e atividade (atendimentos, sessões, clientes novas, origem das triagens).
- **Planilha:** `Baixar planilha (CSV)` na visão geral (`;` como separador e vírgula decimal; abre direto no Excel). Só administradora.
- **Ficha da cliente:** aba **Financeiro** (resumo, cobranças, gerar parcelas de um tratamento, novo recebimento) e evento "Recebimento" na linha do tempo. No detalhe de um agendamento, **Registrar pagamento** abre o formulário já ligado ao atendimento.
- **Caixa:** recebido conta na data do pagamento; previsto, no vencimento; cancelado não entra. Ver `cash_flow` em [docs/DADOS-E-AMBIENTE.md](docs/DADOS-E-AMBIENTE.md).

## Painel (`/admin`)

Dashboard, **Triagens** (lista com filtros, detalhe, estado, observações internas e agendamento de avaliação), Agenda (dia, semana, mês), Agendamentos (criar, confirmar, concluir, cancelar, remarcar, excluir), Clientes (**ficha** com Resumo e linha do tempo, Triagem, Anamnese, Tratamentos, Agenda e Financeiro; etapa Lead, Cliente ou Em tratamento calculada), **Tratamentos**, **Financeiro**, Serviços, **Pacotes**, Horários, Bloqueios, Galeria (upload), Conteúdo (textos e fotos do site), FAQ, Consentimento (texto oficial da triagem) e Configurações (WhatsApp, Instagram, endereço, regras de agendamento).

## Conteúdo que ainda precisa ser informado

Nada abaixo foi inventado; tudo aparece no site como `[placeholder]` até ser preenchido pelo painel:

- Fotos: hero, filosofia (2), retrato profissional, espaço, galeria e resultados (**nenhuma foto real ainda**)
- Descrição, indicação e valor dos 12 tratamentos, e a **duração real** de cada um (`/admin/servicos`; o seed usa 60 min provisórios e o site **não os exibe** até você marcar "Duração confirmada")
- Texto do consentimento da triagem (a página `/triagem` é provisória até a Etapa 3)
- Formação, trajetória, abordagem e experiência da Jennifer (`/admin/conteudo`)
- Filosofia de atendimento: o texto atual é um **rascunho** derivado do briefing
- WhatsApp, Instagram, e-mail, endereço e cidade (`/admin/configuracoes`)
- Respostas do FAQ marcadas com `[…]`
- Horários de atendimento reais (o seed usa seg–sex 9h–18h com pausa 12h–13h e sáb 9h–13h só como ponto de partida)
- Logo: o ícone `src/app/icon.svg` é um monograma provisório

## Build e deploy na Vercel

```bash
npm run lint && npm run typecheck && npm run build
```

1. Suba o repositório para o GitHub e importe na Vercel (framework detectado: Next.js).
2. Em **Settings → Environment Variables**, defina `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL`.
3. Deploy. Depois de alterar textos no painel o site se atualiza sozinho (as páginas são revalidadas ao salvar; o agendamento é sempre dinâmico).
4. Em **Supabase → Authentication → URL Configuration**, coloque a URL da Vercel como *Site URL*.

Fuso horário: o cálculo de horários assume `America/Sao_Paulo` (UTC-3, sem horário de verão).

## Estrutura

```
src/app/(site)/        páginas públicas (início, tratamentos, triagem, agendamento, sobre, galeria, faq, contato)
src/app/admin/         login e painel (rotas protegidas por src/proxy.ts + requireAdmin)
src/components/        site/, booking/, admin/
src/lib/data/          camada de dados: Supabase e banco local, mesma interface (Db)
src/lib/scheduling.ts  cálculo de horários livres (regras espelhadas em create_booking)
supabase/              migração e seed
```
