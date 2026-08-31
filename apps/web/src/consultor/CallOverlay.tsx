import { useEffect, useRef } from 'react'
import { useCallManager } from './useCallManager'

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Overlay global de chamada (chamando / chegando / ativa). Montado uma
 * única vez no topo do App.tsx — assim uma chamada pode chegar em
 * qualquer seção do app, igual ao comportamento do Flutter.
 *
 * IMPORTANTE: Os elementos <video> e <audio> são SEMPRE mantidos no DOM
 * (apenas ocultados via display:none) para que o srcObject possa ser
 * atribuído a qualquer momento — inclusive antes de phase='active'.
 * Isso evita que ontrack dispare enquanto o elemento ainda não existe.
 */
export function CallOverlay() {
  const manager = useCallManager()
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  // Sincroniza vídeo local — roda após cada render para não perder nenhum emit()
  useEffect(() => {
    const el = localVideoRef.current
    if (!el) return
    if (manager.localStream && el.srcObject !== manager.localStream) {
      el.srcObject = manager.localStream
      el.play().catch(() => {})
    } else if (!manager.localStream) {
      el.srcObject = null
    }
  })

  // Sincroniza vídeo/áudio remoto — roda após cada render
  useEffect(() => {
    const vid = remoteVideoRef.current
    const aud = remoteAudioRef.current
    if (manager.remoteStream) {
      // Vídeo remoto recebe sempre o stream completo
      if (vid && vid.srcObject !== manager.remoteStream) {
        vid.srcObject = manager.remoteStream
        vid.play().catch(() => {})
      }
      // Áudio remoto só recebe o stream em chamadas de VOZ (em videochamada,
      // o <video> já reproduz o áudio — evitar duplo áudio)
      if (!manager.isVideo) {
        if (aud && aud.srcObject !== manager.remoteStream) {
          aud.srcObject = manager.remoteStream
          aud.play().catch(() => {})
        }
      } else {
        if (aud) aud.srcObject = null
      }
    } else {
      if (vid) vid.srcObject = null
      if (aud) aud.srcObject = null
    }
  })

  if (manager.phase === 'idle') return null

  const session = manager.session
  if (!session) return null

  const isVideo = manager.isVideo
  const isActive = manager.phase === 'active'
  const hasRemoteVideo = isVideo && isActive && !!manager.remoteStream && manager.remoteStream.getVideoTracks().length > 0
  const hasLocalVideo  = isVideo && !!manager.localStream && manager.localStream.getVideoTracks().length > 0

  const statusLabel = (() => {
    switch (manager.phase) {
      case 'outgoingRinging': return 'Chamando...'
      case 'incomingRinging': return session.callType === 'video' ? 'Videochamada entrando...' : 'Chamada de voz entrando...'
      case 'connecting':      return 'Conectando...'
      case 'active':          return formatDuration(manager.elapsedSeconds)
      default: return ''
    }
  })()

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: '#13251E', zIndex: 9999,
        display: 'flex', flexDirection: 'column', color: '#fff',
      }}
    >
      {/* ── Elementos de mídia SEMPRE no DOM ── */}

      {/* Áudio remoto — só reproduz em chamadas de voz (em vídeo o <video> já tem áudio) */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Vídeo remoto — sempre montado, visível apenas quando há tracks de vídeo */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        onLoadedMetadata={(e) => { e.currentTarget.play().catch(() => {}) }}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          display: hasRemoteVideo ? 'block' : 'none',
        }}
      />

      {/* Vídeo local — PiP quando há vídeo remoto, fullscreen quando não há */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={
          !hasLocalVideo
            ? { display: 'none' }
            : hasRemoteVideo
              ? {
                  position: 'absolute', top: 16, right: 16,
                  width: 110, height: 150, objectFit: 'cover',
                  borderRadius: 12, border: '2px solid rgba(255,255,255,0.4)',
                  zIndex: 5,
                }
              : {
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', opacity: 0.75, zIndex: 1,
                }
        }
      />

      {/* ── Aviso de limite ── */}
      {manager.limitWarningSeconds !== null && (
        <div
          style={{
            position: 'absolute', top: 12, left: 16, right: 16, zIndex: 10,
            background: 'rgba(230,126,34,0.95)', borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <i className="bi bi-exclamation-triangle-fill" style={{ color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            Faltam {Math.ceil((manager.limitWarningSeconds ?? 300) / 60)} minutos no seu limite mensal (Nível 1).
          </span>
        </div>
      )}

      {/* ── Conteúdo central (avatar / timer) ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: hasRemoteVideo ? 'flex-end' : 'center', zIndex: 2,
      }}>
        {!hasRemoteVideo && (
          <>
            <div style={{
              width: 112, height: 112, borderRadius: '50%', background: '#5a8672',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, fontWeight: 700, overflow: 'hidden', marginBottom: 20,
            }}>
              {session.peerPhotoUrl
                ? <img src={session.peerPhotoUrl} alt={session.peerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (session.peerName || '?').charAt(0).toUpperCase()
              }
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{session.peerName || 'Contato'}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{statusLabel}</div>
          </>
        )}
        {hasRemoteVideo && (
          <div style={{
            marginBottom: 12, fontSize: 16, fontWeight: 600,
            background: 'rgba(0,0,0,0.5)', padding: '4px 14px', borderRadius: 16,
          }}>
            {formatDuration(manager.elapsedSeconds)}
          </div>
        )}
      </div>

      {/* ── Controles ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, paddingBottom: 40, zIndex: 2 }}>
        {manager.phase === 'incomingRinging' ? (
          <>
            <CallButton icon="bi-telephone-x-fill" color="#e04444" onClick={() => manager.rejectCall()} label="Rejeitar" />
            <CallButton icon="bi-telephone-fill"   color="#2e7d5e" onClick={() => void manager.acceptCall()} label="Aceitar" />
          </>
        ) : (
          <>
            <CallButton
              icon={manager.micEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'}
              color={manager.micEnabled ? 'rgba(255,255,255,0.15)' : '#e67e22'}
              onClick={() => manager.toggleMic()}
              small
              label={manager.micEnabled ? 'Microfone' : 'Mudo'}
            />
            {isVideo && (
              <CallButton
                icon={manager.cameraEnabled ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}
                color={manager.cameraEnabled ? 'rgba(255,255,255,0.15)' : '#e67e22'}
                onClick={() => manager.toggleCamera()}
                small
                label="Câmera"
              />
            )}
            <CallButton
              icon="bi-telephone-x-fill"
              color="#e04444"
              onClick={() => manager.hangUp()}
              label={manager.phase === 'outgoingRinging' ? 'Cancelar' : 'Desligar'}
            />
          </>
        )}
      </div>
    </div>
  )
}

function CallButton({
  icon, color, onClick, label, small,
}: {
  icon: string; color: string; onClick: () => void; label?: string; small?: boolean
}) {
  const size = small ? 52 : 64
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%', border: 'none', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
        aria-label={label ?? icon}
      >
        <i className={`bi ${icon}`} style={{ color: '#fff', fontSize: small ? 20 : 24 }} />
      </button>
      {label && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>}
    </div>
  )
}
