import { randomUUID } from 'node:crypto'
import { query } from './db.js'

// ── Agendamento (usuário ↔ consultor) ──────────────────────

export interface AvailabilityRule {
  id: string
  consultantId: string
  weekday: number // 0=domingo ... 6=sábado
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
  slotMinutes: number
}

interface AvailabilityRow {
  id: string
  consultant_id: string
  weekday: number
  start_time: string
  end_time: string
  slot_minutes: number
}

function rowToRule(row: AvailabilityRow): AvailabilityRule {
  return {
    id: row.id,
    consultantId: row.consultant_id,
    weekday: row.weekday,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    slotMinutes: row.slot_minutes,
  }
}

export type AppointmentStatus = 'confirmed' | 'declined' | 'cancelled' | 'completed'

export interface Appointment {
  id: string
  userId: string
  consultantId: string
  startsAt: Date
  endsAt: Date
  status: AppointmentStatus
  objective: string
  reminderSentAt: Date | null
  createdAt: Date
}

interface AppointmentRow {
  id: string
  user_id: string
  consultant_id: string
  starts_at: Date
  ends_at: Date
  status: AppointmentStatus
  objective: string
  reminder_sent_at: Date | null
  created_at: Date
}

function rowToAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    userId: row.user_id,
    consultantId: row.consultant_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    objective: row.objective ?? '',
    reminderSentAt: row.reminder_sent_at,
    createdAt: row.created_at,
  }
}

// ── Disponibilidade do consultor ───────────────────────────

export async function setAvailability(
  consultantId: string,
  rules: { weekday: number; startTime: string; endTime: string; slotMinutes: number }[],
): Promise<AvailabilityRule[]> {
  await query('DELETE FROM consultant_availability WHERE consultant_id = $1', [consultantId])
  const created: AvailabilityRule[] = []
  for (const rule of rules) {
    const id = randomUUID()
    const { rows } = await query<AvailabilityRow>(
      `INSERT INTO consultant_availability (id, consultant_id, weekday, start_time, end_time, slot_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, consultantId, rule.weekday, rule.startTime, rule.endTime, rule.slotMinutes],
    )
    created.push(rowToRule(rows[0]))
  }
  return created
}

export async function getAvailability(consultantId: string): Promise<AvailabilityRule[]> {
  const { rows } = await query<AvailabilityRow>(
    `SELECT * FROM consultant_availability WHERE consultant_id = $1 ORDER BY weekday, start_time`,
    [consultantId],
  )
  return rows.map(rowToRule)
}

// ── Geração de horários livres ──────────────────────────────

/** Gera os horários livres de um consultor entre hoje e `daysAhead` dias, a partir da disponibilidade configurada. */
export async function listFreeSlots(consultantId: string, daysAhead = 14): Promise<{ startsAt: string; endsAt: string }[]> {
  const rules = await getAvailability(consultantId)
  if (rules.length === 0) return []

  const now = new Date()
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  // Compromissos já ocupados (confirmados) no período — para excluir das opções.
  const { rows: busyRows } = await query<{ starts_at: Date; ends_at: Date }>(
    `SELECT starts_at, ends_at FROM appointments
     WHERE consultant_id = $1 AND status = 'confirmed' AND starts_at >= $2 AND starts_at <= $3`,
    [consultantId, now, horizon],
  )
  const busy = busyRows.map((r) => ({ start: r.starts_at.getTime(), end: r.ends_at.getTime() }))

  const slots: { startsAt: string; endsAt: string }[] = []
  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)
    const weekday = day.getDay()
    const dayRules = rules.filter((r) => r.weekday === weekday)

    for (const rule of dayRules) {
      const [startH, startM] = rule.startTime.split(':').map(Number)
      const [endH, endM] = rule.endTime.split(':').map(Number)
      let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startH, startM)
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endH, endM)

      while (cursor.getTime() + rule.slotMinutes * 60000 <= end.getTime()) {
        const slotStart = cursor.getTime()
        const slotEnd = slotStart + rule.slotMinutes * 60000

        const isPast = slotStart <= now.getTime()
        const overlapsBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start)

        if (!isPast && !overlapsBusy) {
          slots.push({ startsAt: new Date(slotStart).toISOString(), endsAt: new Date(slotEnd).toISOString() })
        }
        cursor = new Date(slotEnd)
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

// ── Agendamentos ─────────────────────────────────────────────

export async function createAppointment(
  userId: string,
  consultantId: string,
  startsAt: Date,
  endsAt: Date,
  objective: string,
): Promise<Appointment | null> {
  // Confere conflito (outro agendamento confirmado do consultor que sobreponha o horário).
  const { rows: conflict } = await query<{ id: string }>(
    `SELECT id FROM appointments
     WHERE consultant_id = $1 AND status = 'confirmed' AND starts_at < $3 AND ends_at > $2`,
    [consultantId, startsAt, endsAt],
  )
  if (conflict.length > 0) return null

  const id = randomUUID()
  const { rows } = await query<AppointmentRow>(
    `INSERT INTO appointments (id, user_id, consultant_id, starts_at, ends_at, status, objective)
     VALUES ($1, $2, $3, $4, $5, 'confirmed', $6)
     RETURNING *`,
    [id, userId, consultantId, startsAt, endsAt, objective],
  )
  return rowToAppointment(rows[0])
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const { rows } = await query<AppointmentRow>('SELECT * FROM appointments WHERE id = $1 LIMIT 1', [id])
  return rows.length > 0 ? rowToAppointment(rows[0]) : null
}

export async function listAppointmentsForUser(userId: string): Promise<Appointment[]> {
  const { rows } = await query<AppointmentRow>(
    `SELECT * FROM appointments WHERE user_id = $1 ORDER BY starts_at DESC LIMIT 50`,
    [userId],
  )
  return rows.map(rowToAppointment)
}

export interface AppointmentWithUser extends Appointment {
  userFullName: string
  userPlanIds: string[]
}

export async function listAppointmentsForConsultant(consultantId: string): Promise<AppointmentWithUser[]> {
  const { rows } = await query<AppointmentRow & { user_full_name: string; plan_ids: string[] }>(
    `SELECT a.*, u.full_name AS user_full_name, u.plan_ids AS plan_ids
     FROM appointments a
     JOIN users u ON u.id = a.user_id
     WHERE a.consultant_id = $1
     ORDER BY a.starts_at DESC
     LIMIT 100`,
    [consultantId],
  )
  return rows.map((row) => ({
    ...rowToAppointment(row),
    userFullName: row.user_full_name ?? '',
    userPlanIds: row.plan_ids ?? [],
  }))
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
  const { rows } = await query<AppointmentRow>(
    `UPDATE appointments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, status],
  )
  return rows.length > 0 ? rowToAppointment(rows[0]) : null
}

export function isAppointmentParticipant(appointment: Appointment, userId: string): boolean {
  return appointment.userId === userId || appointment.consultantId === userId
}

/** Agendamentos confirmados que começam entre 29 e 31 minutos a partir de agora e ainda não receberam lembrete. */
export async function listAppointmentsNeedingReminder(): Promise<Appointment[]> {
  const { rows } = await query<AppointmentRow>(
    `SELECT * FROM appointments
     WHERE status = 'confirmed'
       AND reminder_sent_at IS NULL
       AND starts_at BETWEEN NOW() + INTERVAL '29 minutes' AND NOW() + INTERVAL '31 minutes'`,
  )
  return rows.map(rowToAppointment)
}

export async function markReminderSent(id: string): Promise<void> {
  await query('UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1', [id])
}
