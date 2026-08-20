import { useEffect, useState } from 'react'
import { notificationCenter } from './notificationCenter'

/** Hook simples: força re-render sempre que o NotificationCenter notifica uma mudança. */
export function useNotificationCenter() {
  const [, setTick] = useState(0)
  useEffect(() => notificationCenter.subscribe(() => setTick((t) => t + 1)), [])
  return notificationCenter
}
