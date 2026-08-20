import { useEffect, useState } from 'react'
import { callManager } from './callManager'

/** Hook simples: força re-render sempre que o CallManager notifica uma mudança. */
export function useCallManager() {
  const [, setTick] = useState(0)
  useEffect(() => callManager.subscribe(() => setTick((t) => t + 1)), [])
  return callManager
}
