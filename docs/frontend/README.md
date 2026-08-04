# Monorepo Frontend - Viver & Saúde

## Visão Geral

Monorepo principal do projeto Viver & Saúde, contendo o app do usuário, painel admin e API principal.

**Gerenciador de pacotes:** npm workspaces  
**Node:** >= 22.0.0

---

## Estrutura

```
viver/
├── apps/
│   ├── web/                    # App do usuário (React)
│   ├── admin/                  # Painel administrativo (React)
│   └── api/                    # API Express (TypeScript)
│
├── packages/
│   └── shared/                 # Código compartilhado
│
├── package.json                # Configuração raiz
└── package-lock.json
```

---

## Início Rápido

```bash
# Instalar dependências
npm install

# Rodar app do usuário
npm run dev:web

# Rodar painel admin
npm run dev:admin

# Rodar API
npm run dev:api

# Build completo
npm run build

# Lint
npm run lint
```

---

## Apps

### 1. Web (`apps/web`)

App do usuário final - Progressive Web App.

| Detalhe | Valor |
|---------|-------|
| **Porta** | 5173 (dev) |
| **Framework** | React 19 |
| **Build Tool** | Vite 8 |
| **Estilo** | Bootstrap 5 + W3.CSS |
| **Rotas** | React Router DOM 7 |

#### Funcionalidades

- **Login/Cadastro** - Autenticação via Supabase
- **Planos** - Seleção e assinatura (Stripe)
- **MeuGuardião** - Assistente de saúde com IA
- **Receitas** - Receitas naturais e protocolos
- **Comunidade** - Links exclusivos (WhatsApp, Telegram)
- **Perfil** - Dados de saúde do usuário

#### Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Tela de login |
| `/register` | Cadastro |
| `/reset` | Redefinição de senha |
| `/app` | App principal (após login) |

#### Dependências Principais

```json
{
  "@supabase/supabase-js": "^2.57.4",
  "@viver-saude/shared": "0.1.0",
  "bootstrap": "^5.3.8",
  "react": "^19.2.5",
  "react-router-dom": "^7.9.5"
}
```

---

### 2. Admin (`apps/admin`)

Painel administrativo para gerenciamento.

| Detalhe | Valor |
|---------|-------|
| **Porta** | 5174 (dev) |
| **Framework** | React 19 |
| **Build Tool** | Vite 8 |
| **Auth** | Token fixo |

#### Funcionalidades

- **Usuários** - Listar, criar, editar, excluir
- **Receitas** - Gerenciar receitas
- **Comunidade** - Gerenciar links
- **IA** - Configurar provedor e modelo
- **Stripe** - Configurar chaves
- **Tokens** - Monitorar uso de IA

#### Seções

| Seção | Descrição |
|-------|-----------|
| `usuarios` | Gerenciamento de usuários |
| `receitas` | CRUD de receitas |
| `comunidade` | Gerenciar links da comunidade |
| `config-ia` | Configurações de IA |
| `config-stripe` | Configurações do Stripe |
| `tokens` | Estatísticas de uso |

#### Variável de Ambiente

```env
VITE_ADMIN_TOKEN=vs-admin-dev
```

---

### 3. API (`apps/api`)

API principal do backend.

| Detalhe | Valor |
|---------|-------|
| **Porta** | 3001 (dev) |
| **Framework** | Express 5 |
| **Validação** | Zod |
| **Auth** | Token de administrador |

#### Endpoints Públicos

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check |
| `GET` | `/api/catalog/plans` | Listar planos |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/register` | Registro |
| `POST` | `/api/auth/forgot-password` | Esqueci senha |
| `POST` | `/api/auth/reset-password` | Redefinir senha |
| `POST` | `/api/billing/checkout-session` | Criar checkout |
| `GET` | `/api/billing/verify-session` | Verificar sessão |
| `POST` | `/api/billing/link-session` | Vincular sessão |
| `POST` | `/api/billing/cancel-subscription` | Cancelar assinatura |
| `GET` | `/api/recipes` | Listar receitas |
| `GET` | `/api/recipes/:id` | Detalhe receita |
| `GET` | `/api/community-links` | Links da comunidade |
| `POST` | `/api/ai/chat` | Chat com IA |

#### Endpoints Admin (requer `x-admin-token`)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/users` | Listar usuários |
| `POST` | `/api/admin/users` | Criar usuário |
| `DELETE` | `/api/admin/users/:id` | Excluir usuário |
| `GET` | `/api/admin/recipes` | Listar receitas |
| `POST` | `/api/admin/recipes` | Criar/editar receita |
| `DELETE` | `/api/admin/recipes/:id` | Excluir receita |
| `GET` | `/api/admin/community-links` | Listar links |
| `POST` | `/api/admin/community-links` | Criar/editar link |
| `DELETE` | `/api/admin/community-links/:id` | Excluir link |
| `POST` | `/api/admin/ai-settings` | Salvar config IA |
| `POST` | `/api/admin/stripe-settings` | Salvar config Stripe |
| `GET` | `/api/admin/knowledge` | Listar arquivos IA |
| `POST` | `/api/admin/knowledge` | Upload arquivo IA |
| `PUT` | `/api/admin/knowledge/:filename/meta` | Metadados arquivo |
| `DELETE` | `/api/admin/knowledge/:filename` | Excluir arquivo |
| `GET` | `/api/admin/token-usage` | Estatísticas tokens |
| `PUT` | `/api/admin/token-quota` | Definir quota |

#### Variáveis de Ambiente

```env
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
ADMIN_API_TOKEN=vs-admin-dev
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Packages Shared (`packages/shared`)

Código compartilhado entre os apps.

### Exportações

```typescript
// Planos
export const plans: Plan[]
export function getPlan(id: PlanId): Plan
export function getCatalog(): Plan[]

// Seções
export const bottomNavItems: NavItem[]
export const sectionRequiredPlan: Record<AppSection, string>
export function getSectionAccessForPlans(plans: PlanId[], section: AppSection): 'free' | 'limited' | 'locked'

// Dados de exemplo
export const sampleRecipes: Recipe[]
export const sampleCommunityLinks: CommunityLink[]
```

### Tipos

```typescript
type PlanId = 'nivel1' | 'nivel2' | 'nivel3'
type AppSection = 'inicio' | 'meuguardiao' | 'receitas' | 'comunidade' | 'conta'

interface Plan {
  id: PlanId
  label: string
  priceInCents: number
  billingInterval: 'monthly' | 'one_time'
  benefits: string[]
}

interface Recipe {
  id: string
  title: string
  category: string
  assetType: 'ebook' | 'protocol' | 'recipe'
}

interface CommunityLink {
  id: string
  title: string
  platform: 'whatsapp' | 'telegram' | 'youtube' | 'discord'
  href: string
}
```

---

## Fluxo de Dados

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Web (App)  │────▶│     API     │────▶│  Supabase   │
│  Port 5173  │     │  Port 3001  │     │   Auth+DB   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Stripe   │
                    │  Pagamentos │
                    └─────────────┘
```

---

## Build

```bash
# Build completo (shared → api → web → admin)
npm run build

# Build individual
npm run build --workspace @viver-saude/shared
npm run build --workspace @viver-saude/api
npm run build --workspace @viver-saude/web
npm run build --workspace @viver-saude/admin
```

---

## Testes

```bash
# Todos os testes
npm run test

# Teste individual
npm run test --workspace @viver-saude/web
npm run test --workspace @viver-saude/api
```

---

## Lint

```bash
# Lint em todos os workspaces
npm run lint
```

---

*Documentação gerada em: 04/08/2026*
