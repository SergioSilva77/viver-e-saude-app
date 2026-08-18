import { useState, useEffect, useRef, useCallback } from 'react'

export interface TutorialStep {
  target: string
  title: string
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  section?: string
}

interface Props {
  steps: TutorialStep[]
  onFinish: () => void
  onSkip: () => void
}

export function TutorialOverlay({ steps, onFinish, onSkip }: Props) {
  const [current, setCurrent] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const step = steps[current]

  const updatePosition = useCallback(() => {
    const el = document.querySelector(step.target)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect(r)

    const gap = 12
    const tooltipW = tooltipRef.current?.offsetWidth ?? 300
    const tooltipH = tooltipRef.current?.offsetHeight ?? 120
    const pos = step.position || 'bottom'

    let top = 0
    let left = 0

    switch (pos) {
      case 'top':
        top = r.top - tooltipH - gap
        left = r.left + r.width / 2 - tooltipW / 2
        break
      case 'bottom':
        top = r.bottom + gap
        left = r.left + r.width / 2 - tooltipW / 2
        break
      case 'left':
        top = r.top + r.height / 2 - tooltipH / 2
        left = r.left - tooltipW - gap
        break
      case 'right':
        top = r.top + r.height / 2 - tooltipH / 2
        left = r.right + gap
        break
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8))

    setTooltipPos({ top, left })
  }, [step])

  useEffect(() => {
    // If the step targets a different section, navigate there first
    if (step.section) {
      const navBtn = document.querySelector(`[data-section="${step.section}"]`) as HTMLElement | null
      if (navBtn && !navBtn.classList.contains('active')) {
        navBtn.click()
      }
    }

    // Wait a bit for navigation/render, then position
    const timer = setTimeout(updatePosition, 350)
    return () => clearTimeout(timer)
  }, [current, step, updatePosition])

  useEffect(() => {
    const onResize = () => updatePosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [updatePosition])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function handleNext() {
    if (current < steps.length - 1) {
      setCurrent(current + 1)
    } else {
      onFinish()
    }
  }

  function handlePrev() {
    if (current > 0) setCurrent(current - 1)
  }

  if (!step) return null

  const isFirst = current === 0
  const isLast = current === steps.length - 1

  return (
    <div className="tutorial-overlay">
      {/* Dark backdrop with spotlight cutout */}
      {rect && (
        <svg className="tutorial-backdrop" width="100%" height="100%">
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx={8}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#tutorial-mask)"
          />
          {/* Animated ring around target */}
          <rect
            className="tutorial-ring"
            x={rect.left - 6}
            y={rect.top - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            rx={8}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={2}
          />
        </svg>
      )}

      {/* Full dark backdrop when target not found */}
      {!rect && <div className="tutorial-backdrop-fallback" />}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="tutorial-tooltip"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="tutorial-tooltip-header">
          <span className="tutorial-step-counter">{current + 1} / {steps.length}</span>
          <button className="tutorial-skip-btn" onClick={onSkip}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <h4 className="tutorial-tooltip-title">{step.title}</h4>
        <p className="tutorial-tooltip-text">{step.text}</p>
        <div className="tutorial-tooltip-actions">
          {!isFirst && (
            <button className="tutorial-prev-btn" onClick={handlePrev}>
              <i className="bi bi-arrow-left" /> Voltar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="tutorial-next-btn" onClick={handleNext}>
            {isLast ? 'Concluir' : 'Próximo'} {!isLast && <i className="bi bi-arrow-right" />}
          </button>
        </div>
      </div>

      {/* Click on backdrop to skip */}
      {rect && (
        <div
          className="tutorial-backdrop-click"
          onClick={onSkip}
          style={{ position: 'fixed', inset: 0, zIndex: 10000 }}
        />
      )}
    </div>
  )
}
