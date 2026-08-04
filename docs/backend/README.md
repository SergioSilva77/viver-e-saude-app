# Backend Legacy - Viver & Saúde

## Visão Geral

Backend original do projeto Viver & Saúde, construído com **Express + TypeORM + PostgreSQL**.

> **⚠️ Aviso:** Este é o backend legado. O novo backend está em `viver/apps/api/`.

---

## Estrutura

```
back-viver-e-saude/
├── src/
│   ├── index.ts              # Ponto de entrada
│   ├── data-source.ts        # Configuração TypeORM
│   ├── routes/
│   │   ├── index.ts          # Rotas principais
│   │   ├── auth.ts           # Autenticação
│   │   ├── user.ts           # Usuários
│   │   └── ai.ts             # Integração IA
│   ├── controller/           # Controllers
│   ├── entity/               # Entidades TypeORM
│   ├── middleware/            # Middleware
│   └── services/             # Serviços
├── public/                   # Arquivos estáticos
├── docker-compose.yml        # Containers
├── Dockerfile                # Build
├── ddls.sql                  # Schema do banco
├── package.json              # Dependências
└── tsconfig.json             # Config TypeScript
```

---

## Tecnologias

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | - | Runtime |
| Express | 5.2 | Framework HTTP |
| TypeORM | 0.3 | ORM |
| PostgreSQL | 15 | Banco de dados |
| TypeScript | 5.9 | Tipagem |
| bcryptjs | 3.0 | Senhas |
| jsonwebtoken | 9.0 | JWT |
| stripe | 20.2 | Pagamentos |
| Docker | - | Containerização |

---

## Schema do Banco

### Tabela `user`

```sql
CREATE TABLE public."user" (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    "isSubscribed" BOOLEAN DEFAULT false,
    "level1Unlocked" BOOLEAN DEFAULT false,
    "level2Unlocked" BOOLEAN DEFAULT false,
    "isAdmin" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "stripeCustomerId" VARCHAR,
    "subscriptionStatus" VARCHAR,
    "subscriptionExpiresAt" TIMESTAMP,
    "subscriptionPlanId" VARCHAR,
    "aiUsageCount" INT DEFAULT 0,
    "aiWindowStart" TIMESTAMP,
    "chatHistory" TEXT
);
```

### Tabela `profile`

```sql
CREATE TABLE public.profile (
    id SERIAL PRIMARY KEY,
    phone VARCHAR,
    dob VARCHAR,
    weight DOUBLE PRECISION DEFAULT 0,
    height DOUBLE PRECISION DEFAULT 0,
    "bloodType" VARCHAR,
    "familyHistory" TEXT,
    goals TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "userId" INTEGER REFERENCES public."user"(id) ON DELETE CASCADE,
    UNIQUE("userId")
);
```

### Tabela `stripe_config`

```sql
CREATE TABLE public.stripe_config (
    id SERIAL PRIMARY KEY,
    "publicKey" VARCHAR NOT NULL,
    "secretKey" VARCHAR NOT NULL,
    "monthlyProductId" VARCHAR,
    "oneTimeProductId1" VARCHAR,
    "oneTimeProductId2" VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

---

## Endpoints

### Health Check

```
GET /health
```

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-04T00:00:00.000Z"
}
```

### Autenticação

```
POST /api/auth/register
POST /api/auth/login
```

### IA

```
POST /api/ai/chat
```

**Body:**
```json
{
  "question": "Como melhorar o sono?",
  "profile": { "age": 30, "weight": 75 },
  "history": []
}
```

---

## Docker

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:15-alpine
    container_name: postgres-viver-e-saude
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vivereesaude
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./ddls.sql:/docker-entrypoint-initdb.d/init.sql

  backend:
    build: .
    container_name: backend-viver-e-saude
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ../api-gemini:/app/api-gemini:ro

volumes:
  postgres_data:
```

### Comandos Docker

```bash
# Subir containers
docker-compose up -d

# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f

# Parar containers
docker-compose down

# Rebuild
docker-compose up -d --build
```

---

## Variáveis de Ambiente

Arquivo `.env`:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://postgres:postgres@db:5432/vivereesaude
JWT_SECRET=sua_chave_secreta
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_APPLICATION_CREDENTIALS=/app/api-gemini/credentials.json
```

---

## Deploy

### Pré-requisitos

- Docker e Docker Compose
- Acesso à VPS (72.61.41.3)
- Credenciais Stripe e Google

### Passos

1. Conectar na VPS:
```bash
ssh root@72.61.41.3
```

2. Navegar até o diretório:
```bash
cd /var/www/back-viver-e-saude
```

3. Copiar arquivos do local:
```bash
scp -r ./* root@72.61.41.3:/var/www/back-viver-e-saude/
```

4. Subir containers:
```bash
docker-compose up -d --build
```

5. Verificar:
```bash
docker-compose ps
curl http://localhost:3000/health
```

---

## Troubleshooting

### Container não inicia

```bash
docker-compose logs backend
docker-compose logs db
```

### Porta em uso

```bash
lsof -i :3000
kill -9 <PID>
```

### Resetar banco

```bash
docker-compose down -v
docker-compose up -d --build
```

### Verificar variáveis do container

```bash
docker exec backend-viver-e-saude env
```

---

## Notas

- Este backend usa **TypeORM** para mapeamento objeto-relacional
- O banco PostgreSQL é inicializado automaticamente via `ddls.sql`
- A integração com IA é feita via script Python (`api-gemini/ai.py`)
- O Stripe é configurado via variáveis de ambiente ou tabela `stripe_config`

---

*Documentação gerada em: 04/08/2026*
