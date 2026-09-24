# Dados, ambiente e Supabase

Referência técnica da fundação de dados (Etapas 0 e 1). O passo a passo curto está no [README](../README.md).

## 1. Variáveis de ambiente

Só quatro. **Nenhuma é secreta e nenhuma chave privada (`service_role`) é usada em lugar algum.**

| Variável | Obrigatória em produção | Onde é lida | O que faz |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | `src/lib/supabase/{config,anon,server,proxy}.ts`, `next.config.ts` | URL do projeto. `next.config.ts` também deriva dela o hostname liberado para imagens do Storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | mesmos arquivos | chave pública `anon`. É pública por desenho: **quem protege os dados é a RLS**, não o sigilo da chave |
| `NEXT_PUBLIC_SITE_URL` | recomendada | `src/lib/site.ts` | canonical, sitemap, Open Graph, dados estruturados. Sem ela, apontam para `localhost` |
| `ADMIN_LOCAL_PASSWORD` | nunca | `src/lib/local-auth.ts` | só desenvolvimento sem Supabase (padrão `dev-admin`); ignorada em produção |

`isSupabaseConfigured` (URL **e** chave presentes) decide o modo: com Supabase → Postgres do Supabase; sem → em desenvolvimento, Postgres local (PGlite); em produção, somente-leitura do conteúdo público.

## 2. O que o código espera do Supabase

- **Postgres 15 ou superior** (as views usam `security_invoker`).
- **Extensão `btree_gist`** (a migração 2 faz `create extension if not exists btree_gist`), necessária para impedir sobreposição de agenda por profissional.
- **Auth:** e-mail + senha; cadastro público **desativado**. O login do painel usa `signInWithPassword` + `getUser()`.
- **Admin:** existir uma linha em `admin_profiles` com o `id` do usuário. Ter conta no Auth não dá acesso.
- **Storage:** bucket público `media` (criado pela migração 1) para fotos do site/galeria. Fotos de **evolução** (futuro) devem ir para um bucket **privado** separado; a coluna `evolutions.photos` já existe.
- **RPCs chamadas pelo app:** `create_booking` (pública) e, a partir da Etapa 3, `submit_screening` (pública) e as administrativas (`activate_treatment`, `schedule_session`…).
- **Sem** Realtime, Edge Functions, Webhooks ou `service_role`.

## 3. Alterações de banco (ordem obrigatória)

1. `supabase/migrations/20260924120000_schema_inicial.sql` — site, agenda, clientes, RLS, `create_booking`.
2. `supabase/migrations/20260925120000_fundacao_clinica.sql` — triagem, anamnese, pacotes, tratamentos, sessões, evolução, pagamentos, despesas, profissionais, consentimento.
3. `supabase/seed.sql` — **produção**: configurações, horários padrão, 12 serviços reais, categorias de despesa, placeholders de conteúdo. Nenhum cliente, triagem ou valor.
4. Criar o usuário no Auth e `insert into admin_profiles (user_id) values ('<uuid>')`.

Dados demonstrativos ficam em `supabase/demo/` e **nunca** entram no passo 3 (ver seção 6).

### O que a migração 2 muda no que já existe

| Objeto | Mudança | Compatível com o app atual |
|---|---|---|
| `services.category` | vira `facial_olhar` / `corporal_modelagem` / `terapias_bem_estar` (dados migrados) | sim (front atualizado) |
| `appointments` | + `kind`, `professional_id`, `screening_id`; `service_id` passa a aceitar nulo | sim |
| `appointments_no_overlap` | passa a ser **por profissional** | sim (hoje há uma só) |
| `blocked_slots` | + `professional_id` (nulo = todas) | sim |
| `busy_slots` (view) | + coluna `professional_id` | sim |
| `settings` | + `evaluation_duration_minutes` | sim |
| `create_booking` | nova assinatura (+ `p_kind`); avaliação/retorno sem serviço; **não sobrescreve o nome** de cliente existente | sim (a chamada usa parâmetros nomeados) |

## 4. Modelo de dados

`clients` é a fonte central da pessoa. `appointments` é a única agenda.

```
clients ─┬─ screenings (leads) ──┬─ anamneses
         │                       └─ appointments (kind = evaluation)
         ├─ treatments ── treatment_sessions ── appointments (kind = session)
         │        │              └─ evolutions
         │        ├─ package_id → treatment_packages ── package_services → services
         │        └─ payments (kind = treatment | session)
         ├─ appointments (kind = service | return | other) ── payments (kind = service)
         └─ payments (client_id)

expense_categories (fixed | variable) ── expenses
cash_flow  = VIEW sobre payments + expenses   (não é uma tabela)
professionals ── appointments / treatments / anamneses / blocked_slots
```

### Regras que vivem no banco (testadas em `tests/sql`)

| Função | O que garante |
|---|---|
| `create_booking` | serviço ativo, antecedência, expediente, pausa, bloqueios; conflito pelo `EXCLUDE` |
| `submit_screening` | consentimento obrigatório, validações, no máx. 3 por telefone/24 h, não sobrescreve cliente existente |
| `create_treatment_from_package` | copia o pacote para um tratamento **proposto** |
| `activate_treatment` | ativa e gera as N sessões (alternando os serviços do pacote); idempotente |
| `create_payment_plan` | parcelas que somam **exatamente** o valor (última absorve centavos); recusa segundo plano |
| `schedule_session` | cria/remarca o `appointment` da sessão; remarcar libera o horário antigo |
| `complete_session` / `finish_session` | conclui a sessão, registra evolução, gera cobrança se `per_session`, encerra o tratamento na última sessão |
| gatilho em `appointments` | confirmar → sessão confirmada; cancelar → sessão volta a "a agendar"; concluir na agenda → conclui a sessão |

Financeiro integrado: um pagamento sempre aponta para cliente e, quando existe, para tratamento, sessão e agendamento. Pacote = parcelas vinculadas ao tratamento. Cobrança por sessão = uma cobrança pendente gerada quando a sessão é realizada (no máximo uma por sessão, garantido por índice único). `cash_flow` separa entradas/saídas e **realizado** × **previsto**.

Status de sessão: `unscheduled`, `scheduled`, `confirmed`, `completed`, `cancelled`, `rescheduled` (remarcada). `unscheduled` é o "a agendar", necessário porque as sessões nascem antes de terem horário.

## 5. Segurança

- RLS ligada em **todas** as tabelas. Sensíveis (triagens, anamneses, tratamentos, sessões, evolução, pagamentos, despesas, clientes, agenda): só `is_admin()`. O público lê apenas conteúdo do site, o termo de consentimento **ativo** e a view `busy_slots` (sem dados pessoais).
- O público **escreve** só por `create_booking` e `submit_screening` (`SECURITY DEFINER`); funções administrativas têm `EXECUTE` revogado de `anon`.
- Consentimento: tabela `consent_terms` pronta; **o texto oficial ainda não existe**. A triagem grava a versão vigente do termo e a data do aceite. Não coletar dados reais de saúde em produção antes de publicar o termo.
- Coleta mínima: a triagem guarda contato (em `clients`), objetivo, queixa e respostas; nada além.
- Não usamos `service_role`; nada privado vai ao navegador.

### Checklist para rodar no Supabase logo após as migrações

```sql
-- 1) RLS ligada em tudo que é do schema public
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;   -- esperado: nenhuma linha

-- 2) anon NÃO executa funções administrativas (esperado: false em todas)
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_executa
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('activate_treatment','complete_session','finish_session','schedule_session','create_payment_plan','create_treatment_from_package');

-- 3) anon executa as duas públicas (esperado: true)
select p.proname, has_function_privilege('anon', p.oid, 'execute') from pg_proc p
where p.proname in ('create_booking','submit_screening');

-- 4) extensão instalada
select extname from pg_extension where extname = 'btree_gist';
```

## 6. Ambientes e dados demonstrativos

| Ambiente | Banco | Dados |
|---|---|---|
| Produção | Supabase | só o `seed.sql`; **sem dados fictícios** |
| Demonstração (opcional) | Supabase separado | `seed.sql` + `supabase/demo/seed-demo.sql` |
| Desenvolvimento local | PGlite (Postgres real em `.data/pgdata`) | `seed.sql`; `npm run demo:load` adiciona o demo |

O demo usa nomes claramente fictícios (sobrenomes "Exemplo", "Modelo", "Fictícia"…), telefones `009…` (DDD inexistente), marca `Dado demonstrativo.` e valores em reais inventados só para dashboard e financeiro. `supabase/demo/clear-demo.sql` remove tudo e preserva clientes reais.

Comandos locais: `npm run demo:load`, `npm run demo:clear`, `npm run db:reset`. **Pare o `npm run dev` antes**: o PGlite aceita um processo por vez (há um lock que recusa a execução simultânea).

## 7. Testes

`npm run test:sql` executa 47 testes em Postgres real (PGlite com as migrações verdadeiras e as permissões padrão do Supabase reproduzidas): RLS por papel (anônimo, autenticado sem perfil, admin), conflito de agenda, triagem, `create_booking`, fluxo pacote → sessões → agenda → financeiro, cobrança por sessão, `cash_flow` e o seed demo. Cobrem regras de banco; **não substituem** validar num Supabase real (seção 5).

## 8. Riscos conhecidos

1. **Nunca rodou em um Supabase real.** Diferenças possíveis: schema da extensão, permissões padrão. O checklist da seção 5 detecta as mais prováveis.
2. **Sem texto de consentimento** — bloqueio de conformidade, não técnico.
3. **Spam na triagem pública:** há limite por telefone, mas não por IP nem captcha. Reavaliar antes de divulgar o link amplamente.
4. **Duração dos 12 serviços é provisória (60 min)**: o sistema exige um valor para calcular horários. Confirmar cada uma em `/admin/servicos`.
5. **Horários de atendimento** do seed são um ponto de partida, não o expediente real.
6. **Disponibilidade global:** `availability` ainda não é por profissional (a agenda já é). Ao incluir a segunda profissional, adicionar `professional_id` nessa tabela.
7. **Backups e retenção** de dados de saúde: definir no Supabase (plano/PITR) e com a Jennifer.
