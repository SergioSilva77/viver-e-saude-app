# Guia de Deploy - Viver & Saúde

## Visão Geral

Guia completo para deploy do projeto Viver & Saúde em produção.

---

## Infraestrutura

### Servidor

| Configuração | Valor |
|--------------|-------|
| **IP** | 72.61.41.3 |
| **Usuário** | root |
| **SO** | Ubuntu/Debian |
| **Docker** | Sim |
| **Nginx** | Sim |
| **SSL** | Certbot |

### Estrutura no Servidor

```
/var/www/
├── back-viver-e-saude/      # Backend legacy (Docker)
├── viver/                   # Frontend + API (npm)
└── api-gemini/              # API Python
```

---

## Pré-requisitos

### Instalar dependências

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# Instalar Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Python 3
sudo apt install -y python3 python3-pip python3-venv

# Instalar Nginx
sudo apt install -y nginx

# Instalar Git
sudo apt install -y git
```

---

## Deploy Backend Legacy

### 1. Copiar arquivos

```bash
# Do PC local
cd back-viver-e-saude

scp docker-compose.yml ddls.sql .env Dockerfile \
  package.json package-lock.json tsconfig.json \
  root@72.61.41.3:/var/www/back-viver-e-saude/

scp -r src root@72.61.41.3:/var/www/back-viver-e-saude/
scp -r public root@72.61.41.3:/var/www/back-viver-e-saude/
```

### 2. Configurar .env

```bash
ssh root@72.61.41.3

cd /var/www/back-viver-e-saude

cat > .env << 'EOF'
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://postgres:postgres@db:5432/vivereesaude
JWT_SECRET=sua_chave_secreta_aqui
STRIPE_SECRET_KEY=sk_live_sua_chave
STRIPE_WEBHOOK_SECRET=whsec_seu_secret
EOF
```

### 3. Subir containers

```bash
cd /var/www/back-viver-e-saude

# Parar containers existentes
docker-compose down 2>/dev/null || true

# Subir containers
docker-compose up -d --build

# Verificar
docker-compose ps
curl http://localhost:3000/health
```

---

## Deploy Frontend (Monorepo)

### 1. Clonar repositório

```bash
cd /var/www

git clone https://github.com/usuario/viver-saude.git viver
cd viver
```

### 2. Configurar variáveis de ambiente

```bash
# App do usuário
cat > apps/web/.env << 'EOF'
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_supabase
VITE_API_URL=https://api.seudominio.com
EOF

# API
cat > apps/api/.env << 'EOF'
PORT=3001
NODE_ENV=production
APP_URL=https://seudominio.com
ADMIN_URL=https://admin.seudominio.com
ADMIN_API_TOKEN=token_secreto_admin
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EOF
```

### 3. Instalar e buildar

```bash
cd /var/www/viver

# Instalar dependências
npm install

# Build completo
npm run build

# Build da API
npm run build --workspace @viver-saude/api
```

### 4. Iniciar API com PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar API
cd /var/www/viver
pm2 start "npm run start --workspace @viver-saude/api" --name viver-api

# Salvar configuração
pm2 save
pm2 startup
```

---

## Deploy API Gemini

### 1. Copiar arquivos

```bash
scp -r api-gemini/* root@72.61.41.3:/var/www/api-gemini/
```

### 2. Configurar ambiente virtual

```bash
ssh root@72.61.41.3

cd /var/www/api-gemini

python3 -m venv venv
source venv/bin/activate

pip install google-cloud-aiplatform vertexai
```

### 3. Testar

```bash
cd /var/www/api-gemini
source venv/bin/activate

echo '{"question": "Olá", "profile": {}, "history": []}' | python3 ai.py
```

---

## Configurar Nginx

### Arquivo de configuração

```bash
sudo nano /etc/nginx/sites-available/viver-e-saude
```

### Conteúdo

```nginx
# Frontend
server {
    listen 80;
    server_nameseudominio.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Webhook Stripe (raw body)
    location /api/stripe/webhook {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Importante: não bufferizar o body
        proxy_request_buffering off;
    }
}

# Backend legacy
server {
    listen 80;
    server_name legacy.seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Ativar configuração

```bash
sudo ln -s /etc/nginx/sites-available/viver-e-saude /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Configurar SSL (HTTPS)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seudominio.com -d api.seudominio.com

# Renovação automática
sudo systemctl status certbot.timer
```

---

## Comandos Úteis

### Docker

| Comando | Descrição |
|---------|-----------|
| `docker-compose ps` | Ver containers |
| `docker-compose logs -f` | Logs tempo real |
| `docker-compose logs backend` | Logs backend |
| `docker-compose logs db` | Logs banco |
| `docker-compose restart` | Reiniciar |
| `docker-compose down` | Parar |
| `docker-compose up -d --build` | Rebuild e iniciar |

### PM2

| Comando | Descrição |
|---------|-----------|
| `pm2 status` | Ver processos |
| `pm2 logs viver-api` | Logs da API |
| `pm2 restart viver-api` | Reiniciar API |
| `pm2 stop viver-api` | Parar API |
| `pm2 monit` | Monitorar |

### Nginx

| Comando | Descrição |
|---------|-----------|
| `sudo nginx -t` | Testar config |
| `sudo systemctl restart nginx` | Reiniciar |
| `sudo systemctl status nginx` | Ver status |

---

## Troubleshooting

### Backend não conecta no banco

```bash
# Verificar se PostgreSQL está rodando
docker-compose logs db

# Testar conexão
docker exec -it postgres-viver-e-saude psql -U postgres -d vivereesaude
```

### API retorna 503

```bash
# Verificar se Stripe está configurado
curl http://localhost:3001/api/health

# Verificar logs
pm2 logs viver-api
```

### Nginx 502 Bad Gateway

```bash
# Verificar se o serviço está rodando
pm2 status
docker-compose ps

# Verificar portas
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5173
```

### Webhook Stripe não funciona

Verifique se o Nginx está enviando o body raw:

```nginx
location /api/stripe/webhook {
    proxy_request_buffering off;
}
```

---

## Variáveis de Ambiente Completas

### Backend Legacy

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://postgres:postgres@db:5432/vivereesaude
JWT_SECRET=seu_jwt_secret
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_APPLICATION_CREDENTIALS=/app/api-gemini/credentials.json
```

### API Principal

```env
PORT=3001
NODE_ENV=production
APP_URL=https://seudominio.com
ADMIN_URL=https://admin.seudominio.com
ADMIN_API_TOKEN=token_secreto
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://api.seudominio.com
VITE_ADMIN_TOKEN=token_admin
```

---

## Checklist de Deploy

- [ ] Servidor configurado (Docker, Node, Python, Nginx)
- [ ] Repositório clonado
- [ ] Variáveis de ambiente configuradas
- [ ] Backend legacy rodando (Docker)
- [ ] API principal rodando (PM2)
- [ ] Frontend buildado
- [ ] Nginx configurado
- [ ] SSL ativo
- [ ] Webhook Stripe funcionando
- [ ] IA configurada (chaves Google/Anthropic)
- [ ] Testes de ponta a ponta realizados

---

*Documentação gerada em: 04/08/2026*
