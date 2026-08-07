import { useState } from 'react'
import {
  saveHealthProfile,
  type BloodType,
  type FamilyEntry,
  type Gender,
  type HealthProfile,
} from './healthProfile'

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro / Prefiro não informar' },
]
const COMMON_GOALS = [
  'Perder peso',
  'Ganhar massa muscular',
  'Reduzir inflamação',
  'Melhorar energia',
  'Melhorar o sono',
  'Organizar a alimentação',
  'Fortalecer imunidade',
  'Controlar estresse',
]

interface Props {
  profile: HealthProfile
  onSave: (profile: HealthProfile) => void
  onClose: () => void
}

export function HealthProfileEditor({ profile, onSave, onClose }: Props) {
  const [form, setForm] = useState<HealthProfile>({ ...profile })
  const [newGoal, setNewGoal] = useState('')
  const [saved, setSaved] = useState(false)

  function setField<K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleGoal(goal: string) {
    setForm((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }))
  }

  function addCustomGoal() {
    const trimmed = newGoal.trim()
    if (!trimmed || form.goals.includes(trimmed)) return
    setForm((prev) => ({ ...prev, goals: [...prev.goals, trimmed] }))
    setNewGoal('')
  }

  function addFamilyEntry() {
    const entry: FamilyEntry = { id: String(Date.now()), relation: '', notes: '' }
    setForm((prev) => ({ ...prev, familyHistory: [...prev.familyHistory, entry] }))
  }

  function updateFamilyEntry(id: string, field: keyof Omit<FamilyEntry, 'id'>, value: string) {
    setForm((prev) => ({
      ...prev,
      familyHistory: prev.familyHistory.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      ),
    }))
  }

  function removeFamilyEntry(id: string) {
    setForm((prev) => ({
      ...prev,
      familyHistory: prev.familyHistory.filter((e) => e.id !== id),
    }))
  }

  function handleSave() {
    saveHealthProfile(form)
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="health-editor-backdrop" onClick={onClose}>
      <div className="health-editor-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="health-editor-header">
          <div className="health-editor-handle" />
          <div className="health-editor-title-row">
            <h2 className="health-editor-title">Saúde e perfil pessoal</h2>
            <button
              type="button"
              className="health-editor-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <p className="health-editor-sub">
            Essas informações ajudam o MeuGuardião a dar orientações mais precisas para você.
          </p>
        </div>

        <div className="health-editor-body">
          {/* ── Dados básicos ────────────────────────── */}
          <div className="health-section">
            <div className="health-section-title">
              <i className="bi bi-person-fill" />
              Dados pessoais
            </div>

            <div className="health-field">
              <label className="health-label">Nome completo</label>
              <input
                type="text"
                className="health-input"
                placeholder="Seu nome"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>

            <div className="health-field-row">
              <div className="health-field">
                <label className="health-label">Sexo</label>
                <select
                  className="health-input"
                  value={form.gender}
                  onChange={(e) => setField('gender', e.target.value as Gender)}
                >
                  <option value="">Selecionar</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="health-field">
                <label className="health-label">Tipo sanguíneo</label>
                <select
                  className="health-input"
                  value={form.bloodType}
                  onChange={(e) => setField('bloodType', e.target.value as BloodType)}
                >
                  <option value="">Selecionar</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="health-field-row">
              <div className="health-field">
                <label className="health-label">Idade</label>
                <input
                  type="number"
                  className="health-input"
                  placeholder="Ex: 35"
                  min={1}
                  max={120}
                  value={form.age}
                  onChange={(e) => setField('age', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="health-field">
                <label className="health-label">Peso (kg)</label>
                <input
                  type="number"
                  className="health-input"
                  placeholder="Ex: 70"
                  min={1}
                  max={300}
                  step={0.1}
                  value={form.weightKg}
                  onChange={(e) => setField('weightKg', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="health-field">
                <label className="health-label">Altura (cm)</label>
                <input
                  type="number"
                  className="health-input"
                  placeholder="Ex: 170"
                  min={50}
                  max={250}
                  value={form.heightCm}
                  onChange={(e) => setField('heightCm', e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* ── Objetivos ────────────────────────────── */}
          <div className="health-section">
            <div className="health-section-title">
              <i className="bi bi-bullseye" />
              Objetivos de saúde
            </div>
            <div className="health-goals-grid">
              {COMMON_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  className={`health-goal-chip ${form.goals.includes(goal) ? 'health-goal-chip-active' : ''}`}
                  onClick={() => toggleGoal(goal)}
                >
                  {form.goals.includes(goal) && <i className="bi bi-check2" />}
                  {goal}
                </button>
              ))}
            </div>

            {/* Custom goal */}
            <div className="health-custom-goal">
              <input
                type="text"
                className="health-input"
                placeholder="Adicionar objetivo personalizado..."
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomGoal() } }}
              />
              <button
                type="button"
                className="btn-add-goal"
                onClick={addCustomGoal}
                disabled={!newGoal.trim()}
              >
                <i className="bi bi-plus-lg" />
              </button>
            </div>

            {/* Show custom goals (not in the common list) */}
            {form.goals.filter((g) => !COMMON_GOALS.includes(g)).map((g) => (
              <div key={g} className="health-custom-goal-tag">
                <span>{g}</span>
                <button
                  type="button"
                  className="health-goal-remove"
                  onClick={() => toggleGoal(g)}
                  aria-label={`Remover ${g}`}
                >
                  <i className="bi bi-x" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Histórico familiar ────────────────────── */}
          <div className="health-section">
            <div className="health-section-title">
              <i className="bi bi-people-fill" />
              Histórico familiar
              <span className="health-section-hint">Doenças ou condições em parentes próximos</span>
            </div>

            {form.familyHistory.length === 0 && (
              <p className="health-empty-hint">
                Nenhum registro adicionado. Informações como diabetes, hipertensão e histórico cardíaco na família ajudam o MeuGuardião a personalizar as orientações.
              </p>
            )}

            <div className="health-family-list">
              {form.familyHistory.map((entry) => (
                <div key={entry.id} className="health-family-entry">
                  <div className="health-field-row" style={{ marginBottom: '0.4rem' }}>
                    <div className="health-field">
                      <label className="health-label">Parentesco</label>
                      <input
                        type="text"
                        className="health-input"
                        placeholder="Ex: Mãe, Pai, Avó..."
                        value={entry.relation}
                        onChange={(e) => updateFamilyEntry(entry.id, 'relation', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="health-family-remove"
                      onClick={() => removeFamilyEntry(entry.id)}
                      aria-label="Remover"
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                  <div className="health-field">
                    <label className="health-label">Condição / Observação</label>
                    <textarea
                      className="health-input health-textarea"
                      placeholder="Ex: Diabetes tipo 2, hipertensão..."
                      rows={2}
                      value={entry.notes}
                      onChange={(e) => updateFamilyEntry(entry.id, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn-add-family" onClick={addFamilyEntry}>
              <i className="bi bi-plus-circle" />
              Adicionar familiar
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="health-editor-footer">
          <button type="button" className="btn-health-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-health-save" onClick={handleSave}>
            {saved ? (
              <>
                <i className="bi bi-check-lg" />
                Salvo!
              </>
            ) : (
              <>
                <i className="bi bi-floppy2-fill" />
                Salvar perfil
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
