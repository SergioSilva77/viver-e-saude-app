// ── Types ──────────────────────────────────────────────────

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | ''
export type Gender = 'masculino' | 'feminino' | 'outro' | ''

export interface FamilyEntry {
  id: string
  relation: string
  notes: string
}

export interface HealthProfile {
  name: string
  gender: Gender
  age: number | ''
  weightKg: number | ''
  heightCm: number | ''
  bloodType: BloodType
  goals: string[]
  familyHistory: FamilyEntry[]
}

// ── Defaults ───────────────────────────────────────────────

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  name: '',
  gender: '',
  age: '',
  weightKg: '',
  heightCm: '',
  bloodType: '',
  goals: [],
  familyHistory: [],
}

// ── localStorage ───────────────────────────────────────────

function healthProfileKey(userId?: string): string {
  return userId ? `vs_health_profile_${userId}` : 'vs_health_profile'
}

export function loadHealthProfile(userId?: string): HealthProfile {
  try {
    const raw = localStorage.getItem(healthProfileKey(userId))
    if (!raw) return { ...DEFAULT_HEALTH_PROFILE }
    return { ...DEFAULT_HEALTH_PROFILE, ...JSON.parse(raw) } as HealthProfile
  } catch {
    return { ...DEFAULT_HEALTH_PROFILE }
  }
}

export function saveHealthProfile(profile: HealthProfile, userId?: string): void {
  localStorage.setItem(healthProfileKey(userId), JSON.stringify(profile))
}

export function clearHealthProfile(userId?: string): void {
  localStorage.removeItem(healthProfileKey(userId))
}
