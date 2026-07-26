import { useEffect } from 'react'

/**
 * Freeze background scrolling while an overlay (modal, drawer) is on screen.
 *
 * The app's scroll container is <main>, not the document body, so lock that
 * directly — overflow to stop it scrolling and touch-action to stop iOS
 * momentum/touch scrolling. html and body are locked too as a backstop in case
 * the scroll ever lives higher up. Everything is restored on unmount, so a
 * modal that mounts only while open can just call this with no arguments.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    const main = document.querySelector('main') as HTMLElement | null
    const root = document.documentElement
    const body = document.body
    const saved = {
      mainOverflowY: main?.style.overflowY ?? '',
      mainTouch: main?.style.touchAction ?? '',
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
    }
    if (main) {
      main.style.overflowY = 'hidden'
      main.style.touchAction = 'none'
    }
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      if (main) {
        main.style.overflowY = saved.mainOverflowY
        main.style.touchAction = saved.mainTouch
      }
      root.style.overflow = saved.rootOverflow
      body.style.overflow = saved.bodyOverflow
    }
  }, [active])
}
