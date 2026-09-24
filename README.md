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

Se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem vazias, o app usa um banco em arquivo (`.data/db.json`, ignorado pelo git), com os mesmos dados do `supabase/seed.sql`. Serve para desenvolver e testar o fluxo completo sem internet.

- Painel: `/admin/login`, senha definida em `ADMIN_LOCAL_PASSWORD` (padrão `dev-admin`).
- Uploads vão para `public/uploads` (ignorado pelo git).
- **Em produção o modo local não persiste nada nem autentica ninguém**: se as variáveis do Supabase faltarem, o site aparece com o seed em memória, o agendamento e o painel recusam escrita.
- Apagar `.data/db.json` restaura o seed.

## Variáveis de ambiente

| Variável | Onde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | chave pública (`anon`); a segurança vem das políticas RLS |
| `NEXT_PUBLIC_SITE_URL` | você | URL final (canonical, sitemap, Open Graph) |
| `ADMIN_LOCAL_PASSWORD` | só desenvolvimento | senha do painel no modo local |

Nenhuma chave secreta é usada no código. **Não use a `service_role` neste projeto.**

## Configurar o Supabase

1. Crie o projeto.
2. No **SQL Editor**, rode na ordem:
   1. [supabase/migrations/20260924120000_schema_inicial.sql](supabase/migrations/20260924120000_schema_inicial.sql) (tabelas, RLS, função `create_booking`, view `busy_slots`, bucket `media`)
   2. [supabase/seed.sql](supabase/seed.sql) (configurações, horários padrão, serviços e FAQ **placeholders**)
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

`admin_profiles`, `settings` (linha única), `availability` (semana), `services`, `clients`, `appointments`, `blocked_slots`, `gallery`, `faq`, `site_content` (chave/valor de textos e fotos).

## Painel (`/admin`)

Dashboard, Agenda (dia, semana, mês), Agendamentos (criar, confirmar, concluir, cancelar, remarcar, excluir), Clientes (histórico e observações), Serviços, Horários, Bloqueios, Galeria (upload), Conteúdo (textos e fotos do site), FAQ, Configurações (WhatsApp, Instagram, endereço, regras de agendamento).

## Conteúdo que ainda precisa ser informado

Nada abaixo foi inventado; tudo aparece no site como `[placeholder]` até ser preenchido pelo painel:

- Fotos: hero, filosofia (2), retrato profissional, espaço, galeria e resultados (**nenhuma foto real ainda**)
- Nomes, descrições, indicações, durações e valores dos procedimentos (`/admin/servicos`; os 6 do seed são exemplos)
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
src/app/(site)/        páginas públicas (início, servicos, agendamento, sobre, galeria, faq, contato)
src/app/admin/         login e painel (rotas protegidas por src/proxy.ts + requireAdmin)
src/components/        site/, booking/, admin/
src/lib/data/          camada de dados: Supabase e banco local, mesma interface (Db)
src/lib/scheduling.ts  cálculo de horários livres (regras espelhadas em create_booking)
supabase/              migração e seed
```
