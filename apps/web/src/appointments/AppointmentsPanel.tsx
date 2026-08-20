import { useEffect, useState } from 'react'
import type { Consultant } from '../consultor/types'
import { fetchConsultants } from '../consultor/api'
import {
  fetchMyAvailability, saveAvailability, fetchFreeSlots, createAppointment,
  fetchAppointments, cancelAppointment, declineAppointment,
  type AvailabilityRule, type FreeSlot, type Appointment,
} from './api'

interface Props {
  token: string
  role: 'user' | 'consultant'
  onClose: () => void
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Confirmada'
    case 'declined': return 'Recusada'
    case 'cancelled': return 'Cancelada'
    case 'completed': return 'Concluída'
    default: return status
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'confirmed': return '#2e7d5e'
    case 'declined': return '#c0392b'
    case 'cancelled': return '#8a9a92'
    case 'completed': return '#2563eb'
    default: return '#8a9a92'
  }
}

function userLevelLabel(planIds?: string[]): string {
  const ids = planIds ?? []
  if (ids.includes('nivel3')) return 'Nível 3'
  if (ids.includes('nivel2')) return 'Nível 2'
  if (ids.includes('nivel1')) return 'Nível 1'
  return 'Sem plano'
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Painel de agendamento — lista de consultas + fluxo de agendar (usuário) ou configurar disponibilidade (consultor). */
export function AppointmentsPanel({ token, role, onClose }: Props) {
  const [view, setView] = useState<'list' | 'book-pick' | 'book-slots' | 'availability'>('list')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null)
  const [slots, setSlots] = useState<FreeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null)
  const [objective, setObjective] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    fetchAppointments(token)
      .then(setAppointments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAppointments(token)
      .then(setAppointments)
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startBooking() {
    setView('book-pick')
    try {
      setConsultants(await fetchConsultants(token))
    } catch {
      setConsultants([])
    }
  }

  async function pickConsultant(c: Consultant) {
    setSelectedConsultant(c)
    setView('book-slots')
    try {
      setSlots(await fetchFreeSlots(token, c.id))
    } catch {
      setSlots([])
    }
  }

  async function confirmBooking() {
    if (!selectedConsultant || !selectedSlot) return
    setSubmitting(true)
    try {
      await createAppointment(token, selectedConsultant.id, selectedSlot.startsAt, objective)
      setView('list')
      setSelectedSlot(null)
      setObjective('')
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao agendar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar este agendamento?')) return
    await cancelAppointment(token, id)
    load()
  }

  async function handleDecline(id: string) {
    if (!confirm('Recusar este agendamento? O usuário será notificado.')) return
    await declineAppointment(token, id)
    load()
  }

  const slotsByDay = slots.reduce<Record<string, FreeSlot[]>>((acc, slot) => {
    const key = new Date(slot.startsAt).toLocaleDateString('pt-BR')
    acc[key] = acc[key] ? [...acc[key], slot] : [slot]
    return acc
  }, {})

  return (
    <div className="plans-backdrop plans-backdrop-entered" onClick={onClose}>
      <div
        className="plans-overlay plans-overlay-entered"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          bottom: 'calc(76px + env(safe-area-inset-bottom))',
          borderRadius: 24,
        }}
      >
        <div className="plans-overlay-handle" onClick={onClose} />
        <div className="plans-overlay-header">
          <h2 className="plans-overlay-title">
            {view === 'list' && (role === 'consultant' ? 'Minha agenda' : 'Minhas consultas')}
            {view === 'book-pick' && 'Escolha um consultor'}
            {view === 'book-slots' && `Agendar com ${selectedConsultant?.fullName ?? ''}`}
            {view === 'availability' && 'Minha disponibilidade'}
          </h2>
          <button type="button" className="plans-overlay-close" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="plans-overlay-body" style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'list' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {role === 'user' ? (
                  <button type="button" className="btn-primary" onClick={startBooking}>
                    <i className="bi bi-plus-circle" /> Agendar consulta
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => setView('availability')}>
                    <i className="bi bi-gear" /> Configurar disponibilidade
                  </button>
                )}
              </div>

              {loading ? (
                <p className="drawer-section-sub">Carregando…</p>
              ) : appointments.length === 0 ? (
                <p className="drawer-section-sub">Nenhuma consulta agendada ainda.</p>
              ) : (
                appointments.map((appt) => (
                  <div key={appt.id} className="chat-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>{formatDateTime(appt.startsAt)}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(appt.status), background: `${statusColor(appt.status)}22`, padding: '2px 8px', borderRadius: 10 }}>
                        {statusLabel(appt.status)}
                      </span>
                    </div>
                    {role === 'consultant' && (
                      <div style={{ fontSize: 12, color: '#5c7268', marginTop: 4 }}>
                        {appt.userFullName || 'Usuário'} · {userLevelLabel(appt.userPlanIds)}
                      </div>
                    )}
                    {appt.objective && <div style={{ fontSize: 12, color: '#5c7268', marginTop: 4 }}>Objetivo: {appt.objective}</div>}
                    {appt.status === 'confirmed' && new Date(appt.startsAt) > new Date() && (
                      <div style={{ marginTop: 8, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => (role === 'consultant' ? handleDecline(appt.id) : handleCancel(appt.id))}
                          style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: 12, cursor: 'pointer' }}
                        >
                          {role === 'consultant' ? 'Recusar' : 'Cancelar'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {view === 'book-pick' && (
            consultants.length === 0 ? (
              <p className="drawer-section-sub">Nenhum consultor disponível no momento.</p>
            ) : (
              consultants.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chat-list-item-btn"
                  style={{ width: '100%' }}
                  onClick={() => pickConsultant(c)}
                >
                  <div className="chat-list-item-info">
                    <span className="chat-list-item-title">{c.fullName}</span>
                    <span className="chat-list-item-meta">{c.specialty || 'Consultor'}</span>
                  </div>
                </button>
              ))
            )
          )}

          {view === 'book-slots' && (
            <>
              {Object.keys(slotsByDay).length === 0 ? (
                <p className="drawer-section-sub">Este consultor ainda não tem horários disponíveis.</p>
              ) : (
                Object.entries(slotsByDay).map(([day, daySlots]) => (
                  <div key={day} style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: 13 }}>{day}</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {daySlots.map((slot) => {
                        const selected = selectedSlot?.startsAt === slot.startsAt
                        const time = new Date(slot.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        return (
                          <button
                            key={slot.startsAt}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              padding: '6px 12px', borderRadius: 20, border: '1px solid #5a8672',
                              background: selected ? '#5a8672' : 'transparent',
                              color: selected ? '#fff' : '#2e7d5e', cursor: 'pointer', fontSize: 13,
                            }}
                          >
                            {time}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
              {selectedSlot && (
                <div style={{ marginTop: 16 }}>
                  <textarea
                    placeholder="Objetivo (opcional)"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    rows={2}
                    style={{ width: '100%', borderRadius: 12, border: '1px solid #ece6d8', padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                  />
                  <button type="button" className="btn-primary" style={{ marginTop: 10, width: '100%' }} disabled={submitting} onClick={confirmBooking}>
                    {submitting ? 'Agendando…' : 'Confirmar agendamento'}
                  </button>
                </div>
              )}
            </>
          )}

          {view === 'availability' && (
            <AvailabilityEditor token={token} onSaved={() => setView('list')} />
          )}
        </div>
      </div>
    </div>
  )
}

function AvailabilityEditor({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [rules, setRules] = useState<Record<number, { enabled: boolean; startTime: string; endTime: string }>>(
    Object.fromEntries(WEEKDAY_NAMES.map((_, i) => [i, { enabled: false, startTime: '09:00', endTime: '18:00' }])),
  )
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMyAvailability(token).then((existing: AvailabilityRule[]) => {
      if (existing.length === 0) return
      setSlotMinutes(existing[0].slotMinutes)
      setRules((prev) => {
        const next = { ...prev }
        for (const rule of existing) {
          next[rule.weekday] = { enabled: true, startTime: rule.startTime, endTime: rule.endTime }
        }
        return next
      })
    }).catch(() => {})
  }, [token])

  async function handleSave() {
    const payload: AvailabilityRule[] = Object.entries(rules)
      .filter(([, r]) => r.enabled)
      .map(([weekday, r]) => ({ weekday: Number(weekday), startTime: r.startTime, endTime: r.endTime, slotMinutes }))

    for (const rule of payload) {
      if (rule.startTime >= rule.endTime) {
        alert(`${WEEKDAY_NAMES[rule.weekday]}: horário inicial deve ser antes do final.`)
        return
      }
    }

    setSaving(true)
    try {
      await saveAvailability(token, payload)
      onSaved()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="drawer-section-sub">Escolha os dias e horários em que você atende.</p>
      <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Duração de cada consulta:</label>
        <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
          {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </div>
      {WEEKDAY_NAMES.map((name, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f9f6' }}>
          <input
            type="checkbox"
            checked={rules[i].enabled}
            onChange={(e) => setRules((prev) => ({ ...prev, [i]: { ...prev[i], enabled: e.target.checked } }))}
          />
          <span style={{ width: 90, fontSize: 13 }}>{name}</span>
          {rules[i].enabled && (
            <>
              <input
                type="time"
                value={rules[i].startTime}
                onChange={(e) => setRules((prev) => ({ ...prev, [i]: { ...prev[i], startTime: e.target.value } }))}
              />
              <span>—</span>
              <input
                type="time"
                value={rules[i].endTime}
                onChange={(e) => setRules((prev) => ({ ...prev, [i]: { ...prev[i], endTime: e.target.value } }))}
              />
            </>
          )}
        </div>
      ))}
      <button type="button" className="btn-primary" style={{ marginTop: 16, width: '100%' }} disabled={saving} onClick={handleSave}>
        {saving ? 'Salvando…' : 'Salvar disponibilidade'}
      </button>
    </div>
  )
}
