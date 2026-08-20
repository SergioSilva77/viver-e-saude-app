export interface AvailabilityRule {
  id?: string
  weekday: number
  startTime: string
  endTime: string
  slotMinutes: number
}

export interface FreeSlot {
  startsAt: string
  endsAt: string
}

export interface Appointment {
  id: string
  userId: string
  consultantId: string
  startsAt: string
  endsAt: string
  status: 'confirmed' | 'declined' | 'cancelled' | 'completed'
  objective: string
  createdAt: string
  userFullName?: string
  userPlanIds?: string[]
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function unwrap<T>(res: Response, key: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message ?? `Erro ${res.status}`)
  }
  const data = await res.json()
  return (data[key] ?? data) as T
}

export async function fetchMyAvailability(token: string): Promise<AvailabilityRule[]> {
  const res = await fetch('/api/consultants/me/availability', { headers: authHeaders(token) })
  return unwrap<AvailabilityRule[]>(res, 'rules')
}

export async function saveAvailability(token: string, rules: AvailabilityRule[]): Promise<AvailabilityRule[]> {
  const res = await fetch('/api/consultants/me/availability', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ rules }),
  })
  return unwrap<AvailabilityRule[]>(res, 'rules')
}

export async function fetchFreeSlots(token: string, consultantId: string, days = 14): Promise<FreeSlot[]> {
  const res = await fetch(`/api/consultants/${consultantId}/free-slots?days=${days}`, { headers: authHeaders(token) })
  return unwrap<FreeSlot[]>(res, 'slots')
}

export async function createAppointment(token: string, consultantId: string, startsAt: string, objective: string): Promise<Appointment> {
  const res = await fetch('/api/appointments', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ consultantId, startsAt, objective }),
  })
  return unwrap<Appointment>(res, 'appointment')
}

export async function fetchAppointments(token: string): Promise<Appointment[]> {
  const res = await fetch('/api/appointments', { headers: authHeaders(token) })
  return unwrap<Appointment[]>(res, 'appointments')
}

export async function cancelAppointment(token: string, id: string): Promise<void> {
  await fetch(`/api/appointments/${id}/cancel`, { method: 'POST', headers: authHeaders(token) })
}

export async function declineAppointment(token: string, id: string): Promise<void> {
  await fetch(`/api/appointments/${id}/decline`, { method: 'POST', headers: authHeaders(token) })
}
