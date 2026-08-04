# Viver & Saúde - Documentação do Projeto

## Visão Geral

O **Viver & Saúde** é uma plataforma de saúde e bem-estar que combina:

- Assistente de IA personalizado ("MeuGuardião")
- Receitas naturais e protocolos de saúde
- Sistema de planos com assinatura
- Comunidade exclusiva por plano

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO FINAL                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │     Apps Frontend (web)    │
              │  React + Vite + TypeScript │
              │  Porta: 5173 (dev)        │
              └─────────────┬─────────────┘
                            │
              ┌─────────────▼─────────────┐
              │   API Principal (Express)  │
              │  Porta: 3001 (dev)        │
              └─────────────┬─────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼────┐      ┌─────▼─────┐      ┌────▼────┐
    │ Supabase│      │  Stripe   │      │   IA    │
    │   Auth  │      │  Pagamento│      │(Gemini/ │
    │ + DB    │      │           │      │ Claude) │
    └─────────┘      └───────────┘      └─────────┘
```

---

## Estrutura de Pastas

```
Nova pasta/
├── docs/                          # 📚 Esta documentação
│   ├── README.md                  # Visão geral
│   ├── backend/
│   │   └── README.md              # Backend legacy (TypeORM)
│   ├── frontend/
│   │   └── README.md              # Monorepo React
│   └── api-gemini/
│       └── README.md              # API Python Gemini
│
├── back-viver-e-saude/            # 🔧 Backend legacy (TypeORM + PostgreSQL)
│   ├── src/                       # Código TypeScript
│   ├── docker-compose.yml         # Containers Docker
│   ├── Dockerfile                 # Build do backend
│   └── ddls.sql                   # Schema do banco
│
├── viver/                         # 📱 Monorepo principal
│   ├── apps/
│   │   ├── web/                   # App do usuário (React)
│   │   ├── admin/                 # Painel admin (React)
│   │   └── api/                   # API Express (TypeScript)
│   └── packages/
│       └── shared/                # Código compartilhado
│
├── api-gemini/                    # 🤖 API Python (Google Gemini)
│   ├── ai.py                      # Script principal
│   └── ebook.txt                  # Base de conhecimento
│
└── html/                          # 📄 Páginas estáticas
```

---

## Componentes Principais

### 1. Frontend Web (`viver/apps/web`)

| Detalhe | Valor |
|---------|-------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 |
| **Estilo** | Bootstrap 5 + Bootstrap Icons |
| **Auth** | Supabase Auth |
| **Rotas** | React Router DOM 7 |

**Funcionalidades:**
- Tela de login/cadastro
- Seleção de planos (Nível 1, 2, 3)
- MeuGuardião (assistente IA)
- Receitas naturais
- Comunidade (links WhatsApp, Telegram, etc.)
- Perfil de saúde do usuário
- Integração com Stripe (pagamentos)

### 2. Painel Admin (`viver/apps/admin`)

| Detalhe | Valor |
|---------|-------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 |
| **Auth** | Token fixo (`VITE_ADMIN_TOKEN`) |

**Funcionalidades:**
- Gerenciamento de usuários
- Configurações de IA
- Configurações do Stripe
- Gerenciamento de receitas
- Gerenciamento de links da comunidade
- Uso de tokens

### 3. API Principal (`viver/apps/api`)

| Detalhe | Valor |
|---------|-------|
| **Framework** | Express 5 + TypeScript |
| **Validação** | Zod |
| **Pagamentos** | Stripe |
| **IA** | Anthropic Claude + Google Gemini |

**Endpoints principais:**
- `GET /health` - Health check
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/ai/chat` - Chat com IA
- `POST /api/billing/checkout-session` - Criar checkout
- `GET /api/recipes` - Listar receitas
- `GET /api/community-links` - Links da comunidade

### 4. Backend Legacy (`back-viver-e-saude`)

| Detalhe | Valor |
|---------|-------|
| **Framework** | Express + TypeORM |
| **Banco** | PostgreSQL 15 |
| **Container** | Docker |
| **Porta** | 3000 |

> **Nota:** Este backend é uma versão anterior. O novo backend está em `viver/apps/api`.

### 5. API Gemini (`api-gemini`)

| Detalhe | Valor |
|---------|-------|
| **Linguagem** | Python |
| **Framework** | Vertex AI |
| **Modelo** | Gemini 2.0 Flash Lite |
| **Input** | JSON via stdin |

**Uso:**
```bash
echo '{"question": "Olá", "profile": {}, "history": []}' | python3 ai.py
```

---

## Planos

| Plano | Preço | Tipo | Benefícios |
|-------|-------|------|------------|
| **Assinatura Mensal** | R$ 18,07/mês | Recorrente | Acesso base ao app |
| **Nível 1** | R$ 29,90 | Único | MeuGuardião, 70+ receitas, e-book, live semanal |
| **Nível 2** | R$ 79,18 | Único | Tudo do Nível 1 + grupo VIP, profissionais, loja parceira |
| **Nível 3** | - | - | Acesso completo permanente |

---

## Como Rodar

### Frontend (Monorepo)

```bash
cd viver

# Instalar dependências
npm install

# Rodar app do usuário
npm run dev:web

# Rodar painel admin
npm run dev:admin

# Rodar API
npm run dev:api
```

### Backend Legacy (Docker)

```bash
cd back-viver-e-saude

# Subir containers
docker-compose up -d

# Verificar status
docker-compose ps
```

### API Gemini

```bash
cd api-gemini
python3 ai.py < input.json
```

---

## Variáveis de Ambiente

### Frontend (`viver/apps/web/.env`)

```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
VITE_API_URL=http://localhost:3001
```

### API (`viver/apps/api/.env`)

```env
PORT=3001
NODE_ENV=development
ANTHROPIC_API_KEY=sua_chave
GOOGLE_API_KEY=sua_chave
STRIPE_SECRET_KEY=sua_chave
ADMIN_API_TOKEN=token_secreto
```

### Backend Legacy (`back-viver-e-saude/.env`)

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@db:5432/vivereesaude
JWT_SECRET=seu_secret
STRIPE_SECRET_KEY=sua_chave
```

---

## Deploy

### VPS Recomendada

| Configuração | Valor |
|--------------|-------|
| **IP** | 72.61.41.3 |
| **SO** | Ubuntu/Debian |
| **Docker** | Sim |
| **Nginx** | Proxy reverso |
| **SSL** | Certbot |

### Comandos de Deploy

```bash
# Conectar na VPS
ssh root@72.61.41.3

# Backend legacy
cd /var/www/back-viver-e-saude
docker-compose up -d --build

# Frontend
cd /var/www/viver
npm run build
```

---

## Tecnologias Utilizadas

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React, TypeScript, Vite, Bootstrap, React Router |
| **Backend** | Express, TypeORM, PostgreSQL, Docker |
| **Auth** | Supabase Auth, JWT |
| **Pagamentos** | Stripe |
| **IA** | Google Gemini, Anthropic Claude |
| **Infra** | Docker, Nginx, VPS |

---

## Fluxo de Pagamento

```
1. Usuário escolhe plano
   ↓
2. Frontend chama POST /api/billing/checkout-session
   ↓
3. Backend cria sessão Stripe
   ↓
4. Usuário é redirecionado para Stripe Checkout
   ↓
5. Pagamento confirmado → Webhook Stripe
   ↓
6. Backend atualiza plano do usuário
   ↓
7. Usuário é redirecionado para cadastro/login
   ↓
8. Acesso liberado
```

---

## Segurança

- Senhas com bcrypt (backend legacy) ou Supabase Auth (novo)
- Validação de entrada com Zod
- Rate limiting via token quota
- CORS configurado para domínios específicos
- Webhook Stripe com verificação de assinatura
- Variáveis sensíveis em `.env` (não commitadas)

---

## Próximos Passos

- [ ] Migrar dados do backend legacy para Supabase
- [ ] Implementar autenticação completa no novo backend
- [ ] Adicionar testes automatizados
- [ ] Configurar CI/CD
- [ ] Implementar notificações push
- [ ] Adicionar dashboard de analytics

---

*Documentação gerada em: 04/08/2026*
