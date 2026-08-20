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
 */
export function CallOverlay() {
  const manager = useCallManager()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = manager.localStream
  }, [manager.localStream])

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = manager.remoteStream
  }, [manager.remoteStream])

  if (manager.phase === 'idle') return null

  const session = manager.session
  if (!session) return null

  const isActiveVideo = manager.isVideo && manager.phase === 'active'
  const statusLabel = (() => {
    switch (manager.phase) {
      case 'outgoingRinging': return 'Chamando...'
      case 'incomingRinging': return session.callType === 'video' ? 'Videochamada entrando...' : 'Chamada de voz entrando...'
      case 'connecting': return 'Conectando...'
      case 'active': return formatDuration(manager.elapsedSeconds)
      default: return ''
    }
  })()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#13251E',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
      }}
    >
      {isActiveVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {isActiveVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', top: 16, right: 16, width: 110, height: 150,
            objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)',
          }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isActiveVideo ? 'flex-end' : 'center' }}>
        {!isActiveVideo && (
          <>
            <div
              style={{
                width: 112, height: 112, borderRadius: '50%', background: '#5a8672',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, fontWeight: 700, overflow: 'hidden', marginBottom: 20,
              }}
            >
              {session.peerPhotoUrl ? (
                <img src={session.peerPhotoUrl} alt={session.peerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (session.peerName || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{session.peerName || 'Contato'}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{statusLabel}</div>
          </>
        )}
        {isActiveVideo && (
          <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>{formatDuration(manager.elapsedSeconds)}</div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, paddingBottom: 40 }}>
        {manager.phase === 'incomingRinging' ? (
          <>
            <CallButton icon="bi-telephone-x-fill" color="#e04444" onClick={() => manager.rejectCall()} label="Rejeitar" />
            <CallButton icon="bi-telephone-fill" color="#2e7d5e" onClick={() => void manager.acceptCall()} label="Aceitar" />
          </>
        ) : (
          <>
            <CallButton icon={manager.micEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'} color="rgba(255,255,255,0.15)" onClick={() => manager.toggleMic()} small />
            {manager.isVideo && (
              <CallButton icon={manager.cameraEnabled ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'} color="rgba(255,255,255,0.15)" onClick={() => manager.toggleCamera()} small />
            )}
            <CallButton
              icon="bi-telephone-x-fill"
              color="#e04444"
              onClick={() => manager.hangUp()}
              label={manager.phase === 'outgoingRinging' ? 'Cancelar' : undefined}
            />
          </>
        )}
      </div>
    </div>
  )
}

function CallButton({ icon, color, onClick, label, small }: { icon: string; color: string; onClick: () => void; label?: string; small?: boolean }) {
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
