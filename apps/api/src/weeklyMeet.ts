import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CONFIG_PATH = resolve(process.cwd(), '.weekly-meet.json')
const TIMEZONE = 'America/Sao_Paulo'

export interface WeeklyMeetConfig {
  /** Link permanente do Google Meet — o mesmo todas as segundas. */
  meetUrl: string
  consultantEmail: string
  consultantName: string
  /** 0=domingo … 1=segunda (Date.getDay no fuso de São Paulo). */
  weekday: number
  /** Horário de início, HH:mm */
  time: string
  durationMinutes: number
  timezone: string
  /** Horário (HH:mm) em que o e-mail semanal é disparado no dia da reunião. */
  emailHour: string
  lastEmailSentOn: string
}

const DEFAULT_CONFIG: WeeklyMeetConfig = {
  meetUrl: '',
  consultantEmail: '',
  consultantName: '',
  weekday: 1,
  time: '19:00',
  durationMinutes: 60,
  timezone: TIMEZONE,
  emailHour: '08:00',
  lastEmailSentOn: '',
}

function normalizeMeetUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map((n) => Number(n))
  return {
    hours: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 19,
    minutes: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  }
}

function zonedParts(date = new Date(), timeZone = TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday] ?? date.getDay(),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

export function loadWeeklyMeet(): WeeklyMeetConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG }
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<WeeklyMeetConfig>
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveWeeklyMeet(patch: Partial<WeeklyMeetConfig>): WeeklyMeetConfig {
  const current = loadWeeklyMeet()
  const next: WeeklyMeetConfig = {
    ...current,
    ...patch,
    meetUrl: normalizeMeetUrl(String(patch.meetUrl ?? current.meetUrl)),
    consultantEmail: String(patch.consultantEmail ?? current.consultantEmail).trim().toLowerCase(),
    consultantName: String(patch.consultantName ?? current.consultantName).trim(),
    weekday: Number(patch.weekday ?? current.weekday) || 1,
    time: String(patch.time ?? current.time).trim() || '19:00',
    durationMinutes: Number(patch.durationMinutes ?? current.durationMinutes) || 60,
    timezone: String(patch.timezone ?? current.timezone).trim() || TIMEZONE,
    emailHour: String(patch.emailHour ?? current.emailHour).trim() || '08:00',
    lastEmailSentOn: patch.lastEmailSentOn !== undefined ? String(patch.lastEmailSentOn) : current.lastEmailSentOn,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export function nextWeeklyOccurrence(cfg: WeeklyMeetConfig, from = new Date()): Date {
  const { hours, minutes } = parseTime(cfg.time)
  const now = zonedParts(from, cfg.timezone)
  let add = (cfg.weekday - now.weekday + 7) % 7
  const alreadyPassedToday =
    add === 0 && (now.hour > hours || (now.hour === hours && now.minute >= minutes + cfg.durationMinutes))
  if (alreadyPassedToday) add = 7

  const parts = zonedParts(new Date(from.getTime() + add * 24 * 60 * 60 * 1000), cfg.timezone)
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return new Date(
    `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${hh}:${mm}:00-03:00`,
  )
}

export function isWeeklyMeetOpen(cfg: WeeklyMeetConfig, from = new Date()): boolean {
  if (!cfg.meetUrl) return false
  const now = zonedParts(from, cfg.timezone)
  return now.weekday === cfg.weekday
}

export function publicWeeklyMeet(cfg: WeeklyMeetConfig, from = new Date()) {
  const next = nextWeeklyOccurrence(cfg, from)
  const open = isWeeklyMeetOpen(cfg, from)
  const nextLabel = next.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: cfg.timezone })
  const dateLabel = next.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: cfg.timezone,
  })
  return {
    meetUrl: cfg.meetUrl,
    consultantName: cfg.consultantName,
    weekday: cfg.weekday,
    time: cfg.time,
    durationMinutes: cfg.durationMinutes,
    timezone: cfg.timezone,
    isOpen: open,
    nextStartsAt: next.toISOString(),
    nextLabel,
    dateLabel,
    timeLabel: cfg.time,
  }
}

export function todayYmd(cfg: WeeklyMeetConfig, from = new Date()): string {
  return zonedParts(from, cfg.timezone).ymd
}

export function shouldSendWeeklyEmail(cfg: WeeklyMeetConfig, from = new Date()): boolean {
  if (!cfg.meetUrl || !cfg.consultantEmail) return false
  const now = zonedParts(from, cfg.timezone)
  if (now.weekday !== cfg.weekday) return false
  if (cfg.lastEmailSentOn === now.ymd) return false
  const sendAt = parseTime(cfg.emailHour)
  const minutesNow = now.hour * 60 + now.minute
  const minutesSend = sendAt.hours * 60 + sendAt.minutes
  return minutesNow >= minutesSend
}

export function markWeeklyEmailSent(ymd: string): WeeklyMeetConfig {
  return saveWeeklyMeet({ lastEmailSentOn: ymd })
}
