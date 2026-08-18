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
  rememberPersonSummary?: boolean
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

export function buildSystemPrompt(
  profile: UserProfile | undefined,
  knowledgeContent: string[],
  options?: {
    personSummary?: string
    healthProfile?: Record<string, unknown>
    rememberPersonSummary?: boolean
  },
): string {
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

  const memorySection = options?.rememberPersonSummary
    ? `
## Conhecimento sobre esta pessoa
${options.personSummary ?? 'Ainda não há informações suficientes sobre esta pessoa.'}

## Perfil de saúde conhecido
${formatHealthProfile(options.healthProfile)}
`
    : ''

  const memoryInstructions = options?.rememberPersonSummary
    ? `
## Instruções especiais de memória
Você está CONSTRUINDO um conhecimento sobre esta pessoa ao longo do tempo.
NÃO faça um interrogatório. Converse NATURALMENTE.
Se faltar informação relevante, mencione CASUALMENTE: "Se quiser me contar mais sobre [X], posso te orientar melhor"

### ATUALIZAÇÃO DO PERFIL DE SAÚDE — OBRIGATÓRIO
Quando a pessoa mencionar QUALQUER informação de saúde — peso, idade, altura, sexo, tipo sanguíneo, condição de saúde, medicamento, objetivo — você DEVE incluir o marcador abaixo no FINAL da sua resposta, DEPOIS de todo o texto:

[UPDATE_HEALTH_PROFILE: {"campo": "valor"}]

Exemplos:
- Pessoa diz "ganhei 80kg" → responda normalmente + no final: [UPDATE_HEALTH_PROFILE: {"weightKg": 80}]
- Pessoa diz "tenho 30 anos" → responda normalmente + no final: [UPDATE_HEALTH_PROFILE: {"age": 30}]
- Pessoa diz "meu tipo sanguíneo é O+" → responda normalmente + no final: [UPDATE_HEALTH_PROFILE: {"bloodType": "O+"}]
- Pessoa diz "comecei a tomar remédio para pressão" → responda normalmente + no final: [UPDATE_HEALTH_PROFILE: {"medications": ["pressão arterial"]}]

O marcador é INVISÍVEL para o usuário (removido automaticamente). Sempre use. É obrigatório.

### RESUMO DA PESSOA
Após acumular informações suficientes, pergunte: "Quer que eu faça um resumo sobre você?"
Se confirmar, responda: [UPDATE_PERSON_SUMMARY: "resumo compacto - máximo 400 caracteres"]
NÃO repita o resumo a cada resposta. Use-o como CONTEXTO INTERNO.
Quando fizer sentido comparar com histórico, faça naturalmente: "Você já conseguiu emagrecer X kg antes, dá pra fazer de novo"
`
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

${memoryInstructions}
${memorySection}
${profileSection}
${knowledgeSection}`.trim()
}

function formatHealthProfile(profile?: Record<string, unknown>): string {
  if (!profile || Object.keys(profile).length === 0) {
    return 'Nenhum dado de saúde registrado ainda.'
  }
  const lines: string[] = []
  if (profile.age !== undefined) lines.push(`- Idade: ${profile.age} anos`)
  if (profile.weightKg !== undefined) lines.push(`- Peso: ${profile.weightKg} kg`)
  if (profile.heightCm !== undefined) lines.push(`- Altura: ${profile.heightCm} cm`)
  if (profile.sex) lines.push(`- Sexo: ${profile.sex}`)
  if (profile.bloodType) lines.push(`- Tipo sanguíneo: ${profile.bloodType}`)
  if (profile.goals && Array.isArray(profile.goals) && profile.goals.length > 0) {
    lines.push(`- Objetivos: ${profile.goals.join(', ')}`)
  }
  if (profile.conditions && Array.isArray(profile.conditions) && profile.conditions.length > 0) {
    lines.push(`- Condições: ${profile.conditions.join(', ')}`)
  }
  if (profile.medications && Array.isArray(profile.medications) && profile.medications.length > 0) {
    lines.push(`- Medicamentos: ${profile.medications.join(', ')}`)
  }
  if (profile.lifestyle) lines.push(`- Estilo de vida: ${profile.lifestyle}`)
  return lines.length > 0 ? lines.join('\n') : 'Nenhum dado de saúde registrado ainda.'
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
      'HTTP-Referer': 'https://viveresaude.com',
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
      'HTTP-Referer': 'https://viveresaude.com',
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

export interface ChatOptions {
  personSummary?: string
  healthProfile?: Record<string, unknown>
  rememberPersonSummary?: boolean
}

export async function chat(
  messages: ChatMessage[],
  userProfile: UserProfile | undefined,
  knowledgeContent: string[],
  aiConfig: AiConfig,
  options?: ChatOptions,
): Promise<ChatResult> {
  const systemPrompt = buildSystemPrompt(userProfile, knowledgeContent, options)

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
