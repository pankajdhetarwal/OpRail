import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function useHealth(pollMs = 30000) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        await api.health()
        if (mounted) setOnline(true)
      } catch {
        if (mounted) setOnline(false)
      }
    }

    check()
    const id = setInterval(check, pollMs)

    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [pollMs])

  return online
}
