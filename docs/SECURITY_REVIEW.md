# Revisão de Segurança — Julho/2026

Este documento registra a avaliação de segurança realizada no repositório e as
correções aplicadas no branch `claude/github-code-review-acveb2`.

## Escopo da avaliação

- **Frontend** (`src/`): XSS, segredos hardcoded, autenticação/RBAC,
  armazenamento local, uso de APIs perigosas (`eval`, `window.open`), CSP.
- **Backend Supabase** (`supabase/`): edge functions (autenticação, CORS,
  uso da service role key, segredos), políticas RLS nas 396 migrações,
  `config.toml` (`verify_jwt`).
- **Infraestrutura**: Dockerfile, nginx.conf, docker-compose, arquivos
  versionados (`.env`).

## Resumo dos achados

| Severidade | Achado | Status |
|---|---|---|
| **Alto** | `google-maps-key` entregava a Google Maps API key de qualquer tenant a chamadores anônimos | ✅ Corrigido |
| Médio | `worktime-sign-entry` derivava a chave HMAC da service role key quando `WORKTIME_SIGNING_KEY` não estava configurada | ✅ Corrigido |
| Médio | Fallback de geolocalização via `http://ip-api.com` (texto claro) | ✅ Corrigido |
| Médio | Ausência de CSP e headers de segurança | ✅ Corrigido (nginx) |
| Médio | `.env` versionado no git | ✅ Corrigido |
| Baixo | 10 chamadas `window.open(_blank)` sem `noopener` (reverse tabnabbing) | ✅ Corrigido |
| Médio | CORS `Access-Control-Allow-Origin: *` em todas as edge functions | ⏳ Pendente |
| Médio | Middleware compartilhado (`_shared/middleware.ts`) usado por apenas 1 das 69 functions | ⏳ Pendente |
| Médio | Políticas RLS históricas `USING (true) TO authenticated` — estado final não confirmado tabela a tabela | ⏳ Pendente (auditar `pg_policies` no banco) |
| Médio | `public-api`: "public token" sem assinatura criptográfica (só valida `expiresAt`) | ⏳ Pendente |
| Médio | Tokens de sessão em `localStorage` (padrão do SDK Supabase) | ⏳ Aceito (limitação do SDK; mitigado pela CSP) |

Pontos fortes confirmados na avaliação: RLS habilitado em ~1:1 com
`CREATE TABLE` (394/393), zero `GRANT TO anon`, `SECURITY DEFINER` sempre com
`SET search_path`, nenhum segredo hardcoded, service role key nunca exposta ao
frontend, HTML dinâmico sanitizado via `SafeHtml` (DOMPurify), `DevConsole` e
`lovable-tagger` restritos a builds de desenvolvimento.

## Correções aplicadas

### 1. Autenticação na `google-maps-key` (Alto)

**Arquivo:** `supabase/functions/google-maps-key/index.ts`

Antes, a função tinha `verify_jwt = false` e nenhuma checagem interna:
qualquer chamador anônimo que informasse um `tenantId` recebia a Google Maps
API key daquele tenant (lida com a service role key).

Agora a função:
1. Exige header `Authorization: Bearer <jwt>` e valida o usuário com
   `auth.getUser()`.
2. Verifica vínculo com o tenant: o usuário precisa ter uma linha em
   `user_roles` para o `tenant_id` informado **ou** ser um usuário de
   plataforma ativo (`platform_users.status = 'active'`).
3. Retorna `401` sem token válido e `403` sem vínculo com o tenant.
4. Não vaza mais detalhes de erro interno na resposta (antes retornava
   `String(err)`).

Nenhuma mudança foi necessária no frontend: o hook `useGoogleMapsKey`
(`src/modules/traccar/ui/useGoogleMapsKey.ts`) usa
`supabase.functions.invoke`, que já envia o JWT da sessão automaticamente.

### 2. Chave HMAC do ledger de ponto (Médio)

**Arquivo:** `supabase/functions/worktime-sign-entry/index.ts`

O fallback `WORKTIME_SIGNING_KEY || serviceRoleKey.slice(0, 64)` acoplava o
segredo de integridade do ledger à credencial mais privilegiada do sistema.
Agora a função **falha fechada** (HTTP 500) se `WORKTIME_SIGNING_KEY` não
estiver configurada.

> ⚠️ **Ação operacional obrigatória:** configure o segredo antes do deploy:
> `supabase secrets set WORKTIME_SIGNING_KEY=<valor aleatório de 64+ chars>`.
> Sem isso, a assinatura de registros de ponto deixa de funcionar (por
> design). Se registros antigos foram assinados com a chave derivada, a
> verificação de assinatura deles exigirá a chave antiga — os hashes de
> integridade (SHA-256) não são afetados.

### 3. Geolocalização sem HTTP em texto claro (Médio)

**Arquivo:** `src/domains/session/session-tracker.ts`

Removido o terceiro provedor de geolocalização por IP (`http://ip-api.com`),
que trafegava o IP do usuário sem TLS e seria bloqueado como mixed content em
páginas HTTPS. Permanecem os dois provedores HTTPS (`ipapi.co`, `ipwho.is`);
se ambos falharem, a sessão é registrada sem coordenadas.

### 4. Headers de segurança no Nginx (Médio)

**Arquivo:** `nginx.conf`

Adicionados a todas as respostas (incluindo os blocos `location`, pois
`add_header` em um location descarta os headers herdados do `server`):

- `Content-Security-Policy` — `default-src 'self'`; scripts só do próprio
  domínio e do Google Maps; `connect-src https:/wss:` amplos porque o app fala
  com endpoints configuráveis por tenant (Supabase, Traccar, Slack,
  geolocalização); `blob:` para workers do Mapbox GL; `object-src 'none'`;
  `frame-ancestors 'self'`.
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()`
- HSTS deixado comentado — habilitar quando o TLS estiver terminado à frente
  deste nginx.

> Se o deploy de produção não usa este nginx (ex.: hospedagem Lovable/CDN),
> os mesmos headers devem ser configurados na plataforma de hospedagem.

### 5. `.env` fora do versionamento (Médio)

**Arquivos:** `.gitignore`, remoção de `.env` do índice do git

O `.env` continha apenas a chave anon/publishable do Supabase (pública por
design — a segurança real vem do RLS), então **não houve vazamento de
segredo**. Ainda assim, versionar `.env` é convite a acidente futuro:

- `git rm --cached .env` (o arquivo permanece no disco para o docker-compose).
- `.gitignore` agora ignora `.env` e `.env.*`, mantendo `.env.example`.

> O `.env` permanece no histórico do git. Como só contém chaves públicas, não
> é necessário reescrever o histórico; se algum dia um segredo real for
> commitado, será preciso rotacioná-lo e usar `git filter-repo`.

### 6. `noopener` em links externos (Baixo)

Adicionado `'noopener,noreferrer'` às 10 chamadas `window.open(url, '_blank')`
que abriam URLs vindas do banco de dados (links de assinatura externa,
`action_url` de anúncios, discovery URLs de IdP, documentos assinados):

- `src/components/announcements/AnnouncementBanner.tsx`
- `src/components/announcements/SystemAlertCard.tsx`
- `src/components/employee/DocumentosTab.tsx`
- `src/components/employee/TermosDocumentosTab.tsx` (2 ocorrências)
- `src/components/sso/SsoIdpTab.tsx`
- `src/pages/documents/AgreementManagement.tsx`
- `src/pages/epi/EpiDelivery.tsx`
- `src/pages/platform/integrations/PlatformDocumentSignature.tsx`
- `src/pages/tenant/TenantAnnouncements.tsx`

## Recomendações pendentes (não aplicadas nesta rodada)

1. **Auditar o estado final do RLS no banco** — as migrações são append-only;
   o lote `20260317000000–5` corrigiu as políticas mais permissivas, mas vale
   confirmar com `SELECT * FROM pg_policies WHERE qual = 'true'` que nenhuma
   política `USING (true)` para `authenticated` sobreviveu.
2. **Padronizar as edge functions no `_shared/middleware.ts`** — o pipeline
   compartilhado (auth, tenant scope, rate limit, audit, injeção de
   `tenant_id`) é robusto, mas só a função `health` o utiliza. A adoção
   gradual elimina a classe de bug "função esqueceu a auth" (origem do achado
   alto desta revisão).
3. **CORS com allowlist de origens** em vez de `*`, ao menos nas funções que
   devolvem tokens/chaves (`mapbox-token`, `google-maps-key`).
4. **Assinar o "public token" da `public-api`** (HMAC) em vez de confiar em um
   JSON não assinado com `expiresAt`.
5. **Cobertura de testes e CI** — 13 arquivos de teste para ~1.500 arquivos de
   código; montar pipeline mínimo (lint + test + build) no GitHub Actions.
6. **Higiene do repositório** — remover lockfiles duplicados (`bun.lock`,
   `bun.lockb` e `package-lock.json` convivem; o Dockerfile usa Bun) e
   reescrever o README (ainda é o boilerplate do Lovable).
