import { randomUUID } from 'node:crypto'
import { query } from './db.js'

// ── Chamadas de voz/vídeo (usuário ↔ consultor) ────────────
// Sinalização acontece via WebSocket (ver realtime/wsServer.ts); esta
// tabela existe para: (1) auditoria/histórico, (2) permitir ao Módulo 6
// somar minutos de chamada por usuário/mês (limite do Nível 1).

export type CallType = 'voice' | 'video'
export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected' | 'cancelled'

export interface Call {
  id: string
  callerId: string
  calleeId: string
  type: CallType
  status: CallStatus
  createdAt: Date
  answeredAt: Date | null
  endedAt: Date | null
  durationSeconds: number | null
}

interface CallRow {
  id: string
  caller_id: string
  callee_id: string
  type: CallType
  status: CallStatus
  created_at: Date
  answered_at: Date | null
  ended_at: Date | null
  duration_seconds: number | null
}

function rowToCall(row: CallRow): Call {
  return {
    id: row.id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
  }
}

export async function createCall(callerId: string, calleeId: string, type: CallType): Promise<Call> {
  const id = randomUUID()
  const { rows } = await query<CallRow>(
    `INSERT INTO calls (id, caller_id, callee_id, type, status)
     VALUES ($1, $2, $3, $4, 'ringing')
     RETURNING *`,
    [id, callerId, calleeId, type],
  )
  return rowToCall(rows[0])
}

export async function getCallById(id: string): Promise<Call | null> {
  const { rows } = await query<CallRow>('SELECT * FROM calls WHERE id = $1 LIMIT 1', [id])
  return rows.length > 0 ? rowToCall(rows[0]) : null
}

export async function markCallOngoing(id: string): Promise<void> {
  await query(`UPDATE calls SET status = 'ongoing', answered_at = NOW() WHERE id = $1`, [id])
}

export async function endCall(id: string, status: CallStatus): Promise<Call | null> {
  const { rows } = await query<CallRow>(
    `UPDATE calls
     SET status = $2,
         ended_at = NOW(),
         duration_seconds = CASE WHEN answered_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - answered_at))::INT ELSE 0 END
     WHERE id = $1 AND status NOT IN ('ended', 'rejected', 'cancelled', 'missed')
     RETURNING *`,
    [id, status],
  )
  return rows.length > 0 ? rowToCall(rows[0]) : null
}

export function isCallParticipant(call: Call, userId: string): boolean {
  return call.callerId === userId || call.calleeId === userId
}

export function getOtherParty(call: Call, selfId: string): string {
  return call.callerId === selfId ? call.calleeId : call.callerId
}

/** Soma de segundos de chamadas atendidas por um usuário num intervalo (usado no Módulo 6). */
export async function sumCallSecondsForUser(userId: string, since: Date): Promise<number> {
  const { rows } = await query<{ total: string }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS total
     FROM calls
     WHERE (caller_id = $1 OR callee_id = $1) AND status = 'ended' AND created_at >= $2`,
    [userId, since],
  )
  return Number(rows[0]?.total ?? 0)
}
