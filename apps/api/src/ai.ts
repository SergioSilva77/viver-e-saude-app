import Anthropic from '@anthropic-ai/sdk'

// ── Types ──────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface UserProfile {
  name?: string
  age?: number
  weightKg?: number
  heightCm?: number
  bloodType?: string
  goals?: string[]
  familyHistory?: { relation: string; notes: string }[]
}

export interface AiConfig {
  provider: 'claude' | 'gemini' | 'mimo' | 'mimo-free'
  apiKey: string
  model: string
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface ChatResult {
  reply: string
  usage: TokenUsage
}

// ── System prompt ──────────────────────────────────────────

export function buildSystemPrompt(profile: UserProfile | undefined, knowledgeContent: string[]): string {
  const profileSection = profile
    ? `
## Perfil do usuário
- Nome: ${profile.name ?? 'Não informado'}
- Idade: ${profile.age != null ? `${profile.age} anos` : 'Não informada'}
- Peso: ${profile.weightKg != null ? `${profile.weightKg} kg` : 'Não informado'}
- Altura: ${profile.heightCm != null ? `${profile.heightCm} cm` : 'Não informada'}
- Tipo sanguíneo: ${profile.bloodType ?? 'Não informado'}
- Objetivos: ${profile.goals?.join(', ') ?? 'Não informados'}
- Histórico familiar: ${
      profile.familyHistory?.map((h) => `${h.relation}: ${h.notes}`).join('; ') ?? 'Não informado'
    }

Use essas informações para personalizar suas orientações. Sempre mencione dados relevantes do perfil quando fizer sentido.
`.trim()
    : '(Perfil do usuário não disponível.)'

  const knowledgeSection =
    knowledgeContent.length > 0
      ? `\n## Base de conhecimento\n${knowledgeContent.map((c, i) => `### Arquivo ${i + 1}\n${c}`).join('\n\n')}`
      : ''

  return `Você é o MeuGuardião, assistente de saúde e bem-estar do aplicativo Viver & Saúde.

## Sua personalidade
- Seja amigável, direto e honesto. Não seja excessivamente formal nem chato.
- Respostas objetivas: vá direto ao ponto, sem enrolação.
- Use formatação Markdown quando ajudar (listas, negrito para termos importantes, etc.).
- Demonstre cuidado genuíno com a saúde e qualidade de vida do usuário.

## Regras de comportamento
- **Foco principal**: saúde, alimentação, bem-estar, hábitos saudáveis e qualidade de vida.
- Se a pergunta envolver compras de produtos naturais, alimentação, suplementos ou estilo de vida saudável, responda com base na base de conhecimento e em seu conhecimento geral.
- Se o tema se afastar de saúde mas puder ser conectado a ela (como equilíbrio emocional, espiritualidade e saúde mental), faça a conexão e agregue valor.
- Se o tema for completamente alheio à saúde (política, entretenimento, etc.), gentilmente redirecione: "Esse assunto está fora do meu escopo de saúde e bem-estar. Posso te ajudar com alguma orientação sobre alimentação, hábitos ou qualidade de vida?"
- Priorize sempre a base de conhecimento fornecida. Quando não houver informação específica lá, use seu conhecimento geral de saúde.
- Nunca invente resultados clínicos específicos. Se não souber, diga que recomenda consultar um profissional de saúde.

${profileSection}
${knowledgeSection}`.trim()
}

// ── Claude client ──────────────────────────────────────────

export async function callClaude(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
): Promise<ChatResult> {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error('Resposta inesperada da API Claude.')
  }

  return {
    reply: block.text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  }
}

// ── Gemini client ──────────────────────────────────────────

export async function callGemini(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
): Promise<ChatResult> {
  // Dynamic import to avoid loading the SDK when not needed
  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey })

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const lastMessage = messages[messages.length - 1]

  const chatSession = client.chats.create({
    model,
    config: { systemInstruction: systemPrompt },
    history,
  })

  const response = await chatSession.sendMessage({ message: lastMessage.content })

  return {
    reply: response.text ?? '',
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}

// ── MiMo (OpenRouter) client ───────────────────────────────

export async function callMiMo(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
): Promise<ChatResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://viversaude.com.br',
      'X-Title': 'Viver & Saúde',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro na API OpenRouter (MiMo): ${response.status} – ${error}`)
  }

  const data = await response.json()
  const choice = data.choices?.[0]
  if (!choice?.message?.content) {
    throw new Error('Resposta inesperada da API MiMo.')
  }

  return {
    reply: choice.message.content,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

// ── MiMo Free (OpenRouter) client ──────────────────────────

export async function callMiMoFree(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
): Promise<ChatResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://viversaude.com.br',
      'X-Title': 'Viver & Saúde',
      'X-OpenRouter-Free': 'true',
    },
    body: JSON.stringify({
      model: model || 'xiaomi/mimo-v2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro na API OpenRouter (MiMo Free): ${response.status} – ${error}`)
  }

  const data = await response.json()
  const choice = data.choices?.[0]
  if (!choice?.message?.content) {
    throw new Error('Resposta inesperada da API MiMo Free.')
  }

  return {
    reply: choice.message.content,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

// ── Dispatcher ─────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  userProfile: UserProfile | undefined,
  knowledgeContent: string[],
  aiConfig: AiConfig,
): Promise<ChatResult> {
  const systemPrompt = buildSystemPrompt(userProfile, knowledgeContent)

  // Keep only the last 10 messages to control context window cost
  const contextMessages = messages.slice(-10)

  if (aiConfig.provider === 'gemini') {
    return callGemini(contextMessages, systemPrompt, aiConfig.model, aiConfig.apiKey)
  }

  if (aiConfig.provider === 'mimo') {
    return callMiMo(contextMessages, systemPrompt, aiConfig.model, aiConfig.apiKey)
  }

  if (aiConfig.provider === 'mimo-free') {
    return callMiMoFree(contextMessages, systemPrompt, aiConfig.model, aiConfig.apiKey)
  }

  return callClaude(contextMessages, systemPrompt, aiConfig.model, aiConfig.apiKey)
}
