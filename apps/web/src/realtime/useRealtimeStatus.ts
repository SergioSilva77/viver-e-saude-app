import { useEffect, useState } from 'react'
import { realtimeService, type RealtimeStatus } from './realtimeService'

/** Hook para exibir o status da conexão de tempo real (WebSocket) na UI. */
export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(realtimeService.getStatus())

  useEffect(() => {
    return realtimeService.onStatusChange(setStatus)
  }, [])

  return status
}
