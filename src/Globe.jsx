import { useCallback, useEffect, useRef, useState } from 'react'
import { createGlobeScene } from './globe/createGlobeScene.js'
import './App.css'

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const FALLBACK_TIME = new Date()

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatLatitude(value) {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? 'N' : 'S'}`
}

function formatLongitude(value) {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? 'E' : 'W'}`
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.2 1.4v9.2L10 6z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2.6" y="1.6" width="2.4" height="8.8" rx="0.6" fill="currentColor" />
      <rect x="7" y="1.6" width="2.4" height="8.8" rx="0.6" fill="currentColor" />
    </svg>
  )
}

export default function Globe() {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [state, setState] = useState(null)

  useEffect(() => {
    let disposed = false
    const scene = createGlobeScene(canvasRef.current, {
      onReady: () => {
        if (!disposed) setReady(true)
      },
    })
    sceneRef.current = scene
    setState(scene.getState())

    const timer = window.setInterval(() => {
      if (!disposed) setState(scene.getState())
    }, 200)

    return () => {
      disposed = true
      window.clearInterval(timer)
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  const togglePaused = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.togglePaused()
    setState(scene.getState())
  }, [])

  const resetToNow = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.resetToNow()
    setState(scene.getState())
  }, [])

  const paused = state?.paused ?? false
  const simulated = state?.time ?? FALLBACK_TIME
  const lat = state?.lat ?? 0
  const lon = state?.lon ?? 0

  return (
    <div className="scene-shell">
      <canvas ref={canvasRef} className="scene-canvas" role="img" aria-label="Rotating Earth lit by the Sun, with real day and night" />
      <div className="scene-vignette" aria-hidden="true" />

      <div className="hud">
        <header className="hud__top">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name">Terra</span>
            <span className="brand__sub">orbital view</span>
          </div>
          <div className="status">
            <span className="status__dot" aria-hidden="true" />
            sunlight · live
          </div>
        </header>

        <footer className="hud__bottom">
          <section className="clock" aria-live="off">
            <span className="clock__eyebrow">UTC · simulated</span>
            <span className="clock__time">{timeFormatter.format(simulated)}</span>
            <span className="clock__date">{dateFormatter.format(simulated)}</span>
            <span className="clock__sun">
              <span className="clock__sun-label">Sun overhead</span>
              <span className="clock__sun-value">
                {formatLatitude(lat)} · {formatLongitude(lon)}
              </span>
              <span className="clock__speed">1 s = 1 h</span>
            </span>
          </section>

          <p className="caption">
            Sunlight follows the real subsolar point · time runs 3,600× faster
          </p>

          <div className="controls">
            <button type="button" className="btn" onClick={togglePaused} aria-pressed={paused}>
              {paused ? <PlayIcon /> : <PauseIcon />}
              {paused ? 'Play' : 'Pause'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={resetToNow}>
              Now
            </button>
          </div>
        </footer>
      </div>

      <div className="loader" data-hidden={ready}>
        <div className="loader__inner">
          <span className="loader__ring" aria-hidden="true" />
          <span>Acquiring orbit</span>
        </div>
      </div>
    </div>
  )
}
