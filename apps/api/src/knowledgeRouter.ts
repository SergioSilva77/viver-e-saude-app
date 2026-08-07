import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Types ──────────────────────────────────────────────────

export interface KnowledgeEntry {
  filename: string
  title: string
  description: string
  /** Keywords/topics used to match against user messages. Case-insensitive. */
  topics: string[]
}

// ── Paths ──────────────────────────────────────────────────

const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge')
const MANIFEST_PATH = resolve(KNOWLEDGE_DIR, 'manifest.json')

// ── Manifest CRUD ──────────────────────────────────────────

export function loadManifest(): KnowledgeEntry[] {
  try {
    if (!existsSync(MANIFEST_PATH)) return []
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as KnowledgeEntry[]
  } catch {
    return []
  }
}

export function saveManifest(entries: KnowledgeEntry[]): void {
  if (!existsSync(KNOWLEDGE_DIR)) {
    mkdirSync(KNOWLEDGE_DIR, { recursive: true })
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

export function upsertManifestEntry(entry: KnowledgeEntry): void {
  const current = loadManifest()
  const idx = current.findIndex((e) => e.filename === entry.filename)
  if (idx === -1) {
    current.push(entry)
  } else {
    current[idx] = entry
  }
  saveManifest(current)
}

export function removeManifestEntry(filename: string): void {
  const current = loadManifest().filter((e) => e.filename !== filename)
  saveManifest(current)
}

// ── Scoring ────────────────────────────────────────────────

/**
 * Scores how relevant a knowledge entry is to a user message.
 * Strategy: normalizes message to lowercase tokens, then checks
 * how many of the entry's topics appear in the message.
 * Returns a score >= 0; higher = more relevant.
 */
export function scoreRelevance(message: string, entry: KnowledgeEntry): number {
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')

  const descTokens = (entry.description + ' ' + entry.title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  let score = 0

  // Each matching topic word = 3 points (high signal)
  for (const topic of entry.topics) {
    const normalizedTopic = topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
    if (normalizedTopic && normalizedMessage.includes(normalizedTopic)) {
      score += 3
    }
  }

  // Each matching description/title word = 1 point (soft signal)
  for (const token of descTokens) {
    if (token.length >= 4 && normalizedMessage.includes(token)) {
      score += 1
    }
  }

  return score
}

// ── File loader ────────────────────────────────────────────

function readKnowledgeFile(filename: string): string {
  try {
    const filePath = resolve(KNOWLEDGE_DIR, filename)
    if (!existsSync(filePath)) return ''
    return readFileSync(filePath, 'utf-8').trim()
  } catch {
    return ''
  }
}

function loadAllKnowledgeFiles(): string[] {
  try {
    if (!existsSync(KNOWLEDGE_DIR)) return []
    return readdirSync(KNOWLEDGE_DIR)
      .filter((f) => f.endsWith('.txt'))
      .map(readKnowledgeFile)
      .filter(Boolean)
  } catch {
    return []
  }
}

// ── Router ─────────────────────────────────────────────────

const SCORE_THRESHOLD = 3
const MAX_FILES_DEFAULT = 3

/**
 * Selects the most relevant knowledge files for the given user message.
 *
 * Algorithm:
 * 1. Score each manifest entry against the message.
 * 2. Filter entries scoring >= SCORE_THRESHOLD.
 * 3. Sort descending by score, take up to maxFiles.
 * 4. Fallback: if no entry passes the threshold (or no manifest),
 *    load all .txt files so the AI is never left without context.
 */
export function selectRelevantFiles(
  userMessage: string,
  maxFiles: number = MAX_FILES_DEFAULT,
): string[] {
  const manifest = loadManifest()

  // No manifest configured yet — load everything (safe fallback)
  if (manifest.length === 0) {
    return loadAllKnowledgeFiles()
  }

  const scored = manifest
    .map((entry) => ({ entry, score: scoreRelevance(userMessage, entry) }))
    .filter(({ score }) => score >= SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)

  // No match above threshold — load everything as fallback
  if (scored.length === 0) {
    return loadAllKnowledgeFiles()
  }

  return scored
    .map(({ entry }) => readKnowledgeFile(entry.filename))
    .filter(Boolean)
}
