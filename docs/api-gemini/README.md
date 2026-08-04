# API Gemini - Viver & Saúde

## Visão Geral

Script Python para integração com o Google Gemini (Vertex AI), utilizado pelo assistente "MeuGuardião".

---

## Estrutura

```
api-gemini/
├── ai.py                                          # Script principal
├── ebook.txt                                      # Base de conhecimento
└── gen-lang-client-0426566045-911ccfa5523c.json   # Credenciais Google
```

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| Python 3 | Runtime |
| Vertex AI | Framework Google AI |
| Gemini 2.0 Flash Lite | Modelo de linguagem |

---

## Como Funciona

### Fluxo

```
1. Recebe JSON via stdin
   ↓
2. Lê conteúdo do ebook.txt
   ↓
3. Monta system instruction com:
   - Persona do assistente
   - Dados do usuário
   - Conteúdo do ebook
   ↓
4. Envia para Gemini via Vertex AI
   ↓
5. Retorna resposta via stdout
```

### Input (JSON via stdin)

```json
{
  "question": "Como melhorar meu sono?",
  "profile": {
    "name": "João",
    "age": 35,
    "weightKg": 80,
    "heightCm": 175,
    "bloodType": "O+",
    "goals": ["Dormir melhor", "Perder peso"],
    "familyHistory": [
      { "relation": "Pai", "notes": "Hipertensão" }
    ]
  },
  "history": [
    { "role": "user", "parts": ["Olá"] },
    { "role": "model", "parts": ["Olá! Como posso ajudar?"] }
  ]
}
```

### Output (stdout)

```
Para melhorar seu sono, com base no seu perfil de 80kg e 175cm, recomendo:

1. Evite cafeína após as 14h
2. Mantenha horário regular de dormir
3. Pratique exercícios leves antes de dormir

O conteúdo do e-book sugere chás naturais como camomila e valeriana...
```

---

## Uso

### Direto via terminal

```bash
cd api-gemini

echo '{"question": "Olá", "profile": {}, "history": []}' | python3 ai.py
```

### Via backend (TypeScript)

```typescript
import { spawn } from 'child_process'

const child = spawn('python3', ['ai.py'], {
  cwd: '/var/www/api-gemini'
})

child.stdin.write(JSON.stringify({
  question: 'Como melhorar o sono?',
  profile: { age: 30, weight: 75 },
  history: []
}))

child.stdout.on('data', (data) => {
  console.log('Resposta:', data.toString())
})
```

---

## Configuração

### Credenciais

O arquivo `gen-lang-client-0426566045-911ccfa5523c.json` contém as credenciais do Google Cloud.

**Variável de ambiente:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/credenciais.json
```

### Projeto Google Cloud

| Configuração | Valor |
|--------------|-------|
| **Project ID** | `gen-lang-client-0426566045` |
| **Location** | `global` |
| **Modelo** | `gemini-2.0-flash-lite-001` |

---

## System Instruction

O assistente é configurado com as seguintes instruções:

1. **Persona:** "Assistente Guardião" - extensão do autor do e-book
2. **Missão:** Personalizar respostas com base nos dados do usuário
3. **Foco:** Saúde, nutrição e bem-estar
4. **Restrição:** Negar perguntas fora do tema educadamente

### Dados Incluídos

- Conteúdo completo do ebook.txt
- Dados do perfil do usuário
- Hierarquia de planos do aplicativo
- Informações de cadastro

---

## Base de Conhecimento

O arquivo `ebook.txt` contém o conteúdo que serve de base para as respostas do assistente.

**Formato:** Texto puro (.txt)  
**Encoding:** UTF-8  
**Tamanho:** Variável

---

## Deploy

### Na VPS

```bash
# Conectar
ssh root@72.61.41.3

# Navegar
cd /var/www/api-gemini

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install google-cloud-aiplatform vertexai

# Testar
echo '{"question": "Olá", "profile": {}, "history": []}' | python3 ai.py
```

### Docker (alternativo)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY ai.py .
COPY ebook.txt .
COPY credentials.json .

ENV GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json

RUN pip install google-cloud-aiplatform vertexai

CMD ["python3", "ai.py"]
```

---

## Erros Comuns

### "Nenhum dado recebido via stdin"

O script não recebeu input. Verifique se está passando JSON via stdin.

### "Não foi possível carregar o contexto do ebook"

O arquivo `ebook.txt` não foi encontrado. Verifique o caminho.

### "Erro na geração"

Problema com a API do Gemini. Verifique:
- Credenciais válidas
- Projeto habilitado no Google Cloud
- Modelo acessível

---

## Notas

- O script lê o ebook.txt a cada chamada (não cacheia)
- O histórico de conversa é mantido via `history` no input
- Respostas são em português brasileiro
- O modelo pode negar perguntas fora do tema saúde

---

*Documentação gerada em: 04/08/2026*
