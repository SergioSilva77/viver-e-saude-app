import { realtimeService } from '../realtime/realtimeService'

export type CallPhase = 'idle' | 'outgoingRinging' | 'incomingRinging' | 'connecting' | 'active'

export interface CallSession {
  callId: string
  peerId: string
  peerName: string
  peerPhotoUrl: string
  callType: 'voice' | 'video'
  isOutgoing: boolean
}

type Listener = () => void

/**
 * Gerencia o ciclo de vida completo de uma chamada no navegador (WebRTC
 * nativo do browser — não precisa de biblioteca extra). Singleton global:
 * uma chamada pode chegar em qualquer seção do app, então escuta as
 * mensagens em tempo real desde o login (ver setToken).
 */
class CallManagerImpl {
  private token = ''
  phase: CallPhase = 'idle'
  session: CallSession | null = null
  localStream: MediaStream | null = null
  remoteStream: MediaStream | null = null
  micEnabled = true
  cameraEnabled = true
  elapsedSeconds = 0
  errorMessage: string | null = null
  /** Segundos restantes quando o aviso de limite (Nível 1) chega — null = sem aviso ativo. */
  limitWarningSeconds: number | null = null

  private pc: RTCPeerConnection | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private mediaSetupPromise: Promise<void> | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private answeredAt: number | null = null
  private listeners = new Set<Listener>()

  constructor() {
    realtimeService.onMessage((msg) => { void this.handleMessage(msg) })
  }

  setToken(token: string): void {
    this.token = token
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    this.listeners.forEach((l) => l())
  }

  get isVideo(): boolean {
    return this.session?.callType === 'video'
  }

  // ── Ações do usuário ───────────────────────────────────────

  startCall(peerId: string, peerName: string, peerPhotoUrl: string, callType: 'voice' | 'video'): void {
    if (this.phase !== 'idle') return
    this.session = { callId: '', peerId, peerName, peerPhotoUrl, callType, isOutgoing: true }
    this.phase = 'outgoingRinging'
    this.errorMessage = null
    this.emit()

    // Se for chamada de vídeo, abre preview local já no início
    if (callType === 'video') {
      this.setupLocalMedia(true).catch(() => {})
    }

    realtimeService.send({ type: 'call:invite', calleeId: peerId, callType })
  }

  async acceptCall(): Promise<void> {
    const s = this.session
    if (!s || this.phase !== 'incomingRinging') return
    this.phase = 'connecting'
    this.emit()
    try {
      // 1. Inicializa mídia e RTCPeerConnection ANTES de sinalizar o aceite
      await this.ensureLocalMediaAndPeerConnection()
      // 2. Só agora sinaliza o aceite
      realtimeService.send({ type: 'call:accept', callId: s.callId })
    } catch {
      this.errorMessage = 'Não foi possível acessar câmera/microfone.'
      this.rejectCall()
    }
  }

  rejectCall(): void {
    const s = this.session
    if (s) realtimeService.send({ type: 'call:reject', callId: s.callId })
    this.teardown()
  }

  hangUp(): void {
    const s = this.session
    if (s && s.callId) {
      const type = this.phase === 'outgoingRinging' ? 'call:cancel' : 'call:end'
      realtimeService.send({ type, callId: s.callId })
    }
    this.teardown()
  }

  toggleMic(): void {
    this.micEnabled = !this.micEnabled
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = this.micEnabled })
    this.emit()
  }

  toggleCamera(): void {
    this.cameraEnabled = !this.cameraEnabled
    this.localStream?.getVideoTracks().forEach((t) => { t.enabled = this.cameraEnabled })
    this.emit()
  }

  // ── Mensagens recebidas via WebSocket ──────────────────────

  private async handleMessage(msg: Record<string, unknown>): Promise<void> {
    const type = msg.type as string | undefined
    switch (type) {
      case 'call:ringing':
        if (this.session) {
          this.session = { ...this.session, callId: msg.callId as string }
          this.emit()
        }
        break

      case 'call:incoming': {
        if (this.phase !== 'idle') {
          realtimeService.send({ type: 'call:reject', callId: msg.callId })
          return
        }
        this.session = {
          callId: msg.callId as string,
          peerId: msg.callerId as string,
          peerName: (msg.callerName as string) || 'Contato',
          peerPhotoUrl: (msg.callerPhotoUrl as string) || '',
          callType: (msg.callType as 'voice' | 'video') || 'voice',
          isOutgoing: false,
        }
        this.phase = 'incomingRinging'
        this.errorMessage = null
        this.emit()
        break
      }

      case 'call:accepted':
        if (this.phase === 'outgoingRinging') {
          this.phase = 'connecting'
          this.emit()
          try {
            await this.ensureLocalMediaAndPeerConnection()
            await this.makeOffer()
          } catch {
            this.errorMessage = 'Não foi possível acessar câmera/microfone.'
            this.hangUp()
          }
        }
        break

      case 'call:rejected':
        this.errorMessage = 'Chamada não atendida.'
        this.teardown()
        break

      case 'call:busy':
        this.errorMessage = 'Contato ocupado em outra chamada.'
        this.teardown()
        break

      case 'call:cancelled':
        this.errorMessage = 'Chamada cancelada.'
        this.teardown()
        break

      case 'call:missed':
        this.errorMessage = this.phase === 'outgoingRinging' ? 'Chamada não atendida.' : null
        this.teardown()
        break

      case 'call:ended':
        if (msg.reason === 'limit_reached') {
          this.errorMessage = 'Sua chamada foi encerrada: limite mensal do Nível 1 atingido.'
        }
        this.teardown()
        break

      case 'call:limit_warning':
        this.limitWarningSeconds = (msg.remainingSeconds as number) ?? 300
        this.emit()
        break

      case 'webrtc:offer':
        await this.onRemoteOffer(msg.sdp as RTCSessionDescriptionInit)
        break

      case 'webrtc:answer':
        await this.onRemoteAnswer(msg.sdp as RTCSessionDescriptionInit)
        break

      case 'webrtc:ice':
        await this.onRemoteIce(msg.candidate as RTCIceCandidateInit)
        break
    }
  }

  // ── WebRTC ──────────────────────────────────────────────

  private async setupLocalMedia(video: boolean): Promise<void> {
    if (this.localStream) {
      const hasVideo = this.localStream.getVideoTracks().length > 0
      if (hasVideo === video) return
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    })
    this.micEnabled = true
    this.cameraEnabled = video
    this.emit()
  }

  private async ensureLocalMediaAndPeerConnection(): Promise<void> {
    if (this.pc) return
    if (this.mediaSetupPromise) return this.mediaSetupPromise

    this.mediaSetupPromise = (async () => {
      try {
        await this.setupLocalMedia(this.session?.callType === 'video')
        await this.createPeerConnection()
      } finally {
        this.mediaSetupPromise = null
      }
    })()

    return this.mediaSetupPromise
  }

  private async iceServers(): Promise<RTCConfiguration> {
    try {
      const res = await fetch('/api/turn-credentials', {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) throw new Error('sem turn')
      const creds = await res.json()
      return {
        iceServers: [
          { urls: creds.uris as string[], username: creds.username, credential: creds.password },
          { urls: ['stun:stun.l.google.com:19302'] },
        ],
      }
    } catch {
      return {
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      }
    }
  }

  private async createPeerConnection(): Promise<void> {
    const config = await this.iceServers()
    const pc = new RTCPeerConnection(config)
    this.pc = pc

    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!)
    })

    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.session?.callId) return
      realtimeService.send({
        type: 'webrtc:ice',
        callId: this.session.callId,
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        },
      })
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC ontrack]', event.track.kind, event.track.id)
      let stream = this.remoteStream
      if (!stream) {
        stream = event.streams[0] ? event.streams[0] : new MediaStream()
      }
      if (!stream.getTracks().some((t) => t.id === event.track.id)) {
        stream.addTrack(event.track)
      }
      // Cria nova instância de MediaStream para garantir que a referência seja reavaliada no React
      this.remoteStream = new MediaStream(stream.getTracks())
      this.emit()
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.onConnected()
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Deixa o encerramento explícito (call:end) cuidar da limpeza
      }
    }
  }

  private onConnected(): void {
    if (this.phase === 'active') return
    this.phase = 'active'
    this.answeredAt = Date.now()
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => {
      if (this.answeredAt) {
        this.elapsedSeconds = Math.floor((Date.now() - this.answeredAt) / 1000)
        this.emit()
      }
    }, 1000)
    this.emit()
  }

  private async makeOffer(): Promise<void> {
    const pc = this.pc
    if (!pc || !this.session?.callId) return
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.session?.callType === 'video',
    })
    await pc.setLocalDescription(offer)
    realtimeService.send({ type: 'webrtc:offer', callId: this.session.callId, sdp: offer })
  }

  private async onRemoteOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.ensureLocalMediaAndPeerConnection()
    const pc = this.pc
    if (!pc) return

    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    await this.flushPendingCandidates()
    const answer = await pc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.session?.callType === 'video',
    })
    await pc.setLocalDescription(answer)
    realtimeService.send({ type: 'webrtc:answer', callId: this.session?.callId, sdp: answer })
  }

  private async onRemoteAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.pc
    if (!pc) return
    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    await this.flushPendingCandidates()
  }

  private async onRemoteIce(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.pc
    if (!pc || !pc.remoteDescription) {
      this.pendingCandidates.push(candidate)
      return
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate))
  }

  private async flushPendingCandidates(): Promise<void> {
    const pc = this.pc
    if (!pc) return
    for (const c of this.pendingCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(c))
    }
    this.pendingCandidates = []
  }

  // ── Encerramento / limpeza ──────────────────────────────

  private teardown(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.answeredAt = null
    this.limitWarningSeconds = null
    this.elapsedSeconds = 0

    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.remoteStream = null

    this.pc?.close()
    this.pc = null
    this.pendingCandidates = []

    this.phase = 'idle'
    this.session = null
    this.emit()
  }

  clearError(): void {
    this.errorMessage = null
    this.emit()
  }
}

export const callManager = new CallManagerImpl()
