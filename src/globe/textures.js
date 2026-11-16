import * as THREE from 'three'

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')]
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
const css = ([r, g, b], alpha = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Latitudinal bands with soft, turbulent edges. */
export function makeBandedTexture({ colors, bands = 14, seed = 1, spot = null }) {
  const [canvas, ctx] = makeCanvas(512, 256)
  const rand = mulberry32(seed)
  const palette = colors.map(rgb)

  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  const steps = 48
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const wobble = Math.sin(t * Math.PI * 3.1 + 0.8) * 0.35 + Math.sin(t * Math.PI * 7.7) * 0.15
    const x = (t + wobble * 0.02) * bands
    const index = Math.floor(x)
    const frac = x - index
    const a = palette[((index % palette.length) + palette.length) % palette.length]
    const b = palette[(((index + 1) % palette.length) + palette.length) % palette.length]
    const eased = frac * frac * (3 - 2 * frac)
    gradient.addColorStop(t, css(mix(a, b, eased)))
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 256)

  // Horizontal streaks give the bands a windswept, cloudy feel.
  ctx.filter = 'blur(1.5px)'
  for (let i = 0; i < 90; i += 1) {
    const y = rand() * 256
    const height = 0.6 + rand() * 4
    const light = rand() > 0.5
    ctx.fillStyle = light
      ? `rgba(255, 246, 226, ${0.02 + rand() * 0.05})`
      : `rgba(58, 38, 24, ${0.02 + rand() * 0.06})`
    ctx.beginPath()
    ctx.ellipse(256, y, 420, height, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.filter = 'none'

  if (spot) {
    const { x, y, rx, ry, color } = spot
    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry))
    spotGradient.addColorStop(0, css(rgb(color), 0.75))
    spotGradient.addColorStop(1, css(rgb(color), 0))
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, ry / rx)
    ctx.translate(-x, -y)
    ctx.fillStyle = spotGradient
    ctx.beginPath()
    ctx.arc(x, y, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  return canvasTexture(canvas)
}

export function makeMarsTexture(seed = 7) {
  const [canvas, ctx] = makeCanvas(512, 256)
  const rand = mulberry32(seed)

  const base = ctx.createLinearGradient(0, 0, 0, 256)
  base.addColorStop(0, '#a8522f')
  base.addColorStop(0.35, '#c4663a')
  base.addColorStop(0.62, '#b85b33')
  base.addColorStop(1, '#9c4a2a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 256)

  ctx.filter = 'blur(3px)'
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * 512
    const y = 30 + rand() * 196
    const rx = 10 + rand() * 55
    const ry = 7 + rand() * 28
    ctx.fillStyle = rand() > 0.45
      ? `rgba(112, 52, 30, ${0.1 + rand() * 0.22})`
      : `rgba(226, 158, 112, ${0.06 + rand() * 0.16})`
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.filter = 'none'

  // Polar caps.
  for (const [from, to] of [[0, 26], [256, 230]]) {
    const cap = ctx.createLinearGradient(0, from, 0, to)
    cap.addColorStop(0, 'rgba(255, 252, 246, 0.95)')
    cap.addColorStop(1, 'rgba(255, 250, 244, 0)')
    ctx.fillStyle = cap
    ctx.fillRect(0, Math.min(from, to), 512, Math.abs(to - from))
  }

  return canvasTexture(canvas)
}

export function makeVenusTexture(seed = 11) {
  const [canvas, ctx] = makeCanvas(512, 256)
  const rand = mulberry32(seed)

  const base = ctx.createLinearGradient(0, 0, 0, 256)
  base.addColorStop(0, '#efe3bd')
  base.addColorStop(0.5, '#e8d5a6')
  base.addColorStop(1, '#dcc494')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 256)

  ctx.filter = 'blur(9px)'
  for (let i = 0; i < 26; i += 1) {
    const y = rand() * 256
    ctx.strokeStyle = rand() > 0.5
      ? `rgba(255, 250, 233, ${0.16 + rand() * 0.2})`
      : `rgba(196, 168, 116, ${0.14 + rand() * 0.18})`
    ctx.lineWidth = 2 + rand() * 12
    ctx.beginPath()
    for (let x = -20; x <= 532; x += 12) {
      const wave = Math.sin(x * 0.014 + i) * 8 + Math.sin(x * 0.003 + i * 2) * 14
      if (x === -20) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.stroke()
  }
  ctx.filter = 'none'

  return canvasTexture(canvas)
}

export function makeRingTexture() {
  const size = 512
  const [canvas, ctx] = makeCanvas(size, size)
  const center = size / 2

  const gradient = ctx.createRadialGradient(center, center, center * 0.2, center, center, center)
  const bands = [
    [0.2, 0.0],
    [0.255, 0.0],
    [0.26, 0.55],
    [0.29, 0.35],
    [0.32, 0.62],
    [0.35, 0.18],
    [0.38, 0.55],
    [0.405, 0.08], // Cassini division
    [0.42, 0.5],
    [0.455, 0.34],
    [0.475, 0.6],
    [0.492, 0.12],
    [0.5, 0.0],
  ]
  for (const [stop, alpha] of bands) {
    gradient.addColorStop(stop, `rgba(222, 205, 170, ${alpha})`)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function makeGlowTexture() {
  const size = 256
  const [canvas, ctx] = makeCanvas(size, size)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  gradient.addColorStop(0.22, 'rgba(210, 230, 255, 0.45)')
  gradient.addColorStop(0.55, 'rgba(120, 165, 235, 0.12)')
  gradient.addColorStop(1, 'rgba(40, 70, 130, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvasTexture(canvas)
}

export function makeLabelTexture(text) {
  const [canvas, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = 'rgba(214, 228, 250, 0.95)'
  ctx.font = '500 40px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '14px'
  ctx.fillText(text.toUpperCase(), 256 + 7, 66)
  return canvasTexture(canvas)
}
