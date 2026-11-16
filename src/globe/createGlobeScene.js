import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { subsolarPoint } from './solar.js'
import {
  atmosphereFragmentShader,
  cloudsFragmentShader,
  earthFragmentShader,
  earthVertexShader,
  starFragmentShader,
  starVertexShader,
} from './shaders.js'
import {
  makeBandedTexture,
  makeGlowTexture,
  makeLabelTexture,
  makeMarsTexture,
  makeRingTexture,
  makeVenusTexture,
} from './textures.js'

const DEG = Math.PI / 180

const SIM_SECONDS_PER_REAL_SECOND = 3600 // 1 second = 1 hour
const FOV = 42
const CAMERA_Z = 5
const GLOBE_HEIGHT_FRACTION = 0.46
const SKY_DRIFT = (Math.PI * 2) / 7200 // one slow revolution every two hours

// Direction from Earth toward the Sun in view space: up and to the right.
const SUN_DIR = new THREE.Vector3(0.78, 0.32, 0.54).normalize()

const EARTH_TEXTURE_SIZE = 96

const PLANET_DEFS = [
  {
    name: 'Jupiter',
    radius: 9.5,
    depth: 330,
    ax: -1.35,
    ay: 0.5,
    mobile: { x: -0.63, y: 0.6 },
    tilt: 0.1,
    texture: () =>
      makeBandedTexture({
        colors: [0xd8c3a5, 0xb4875f, 0xe8d9c2, 0x9c6d4a, 0xdfc9ab],
        bands: 18,
        seed: 21,
        spot: { x: 360, y: 168, rx: 48, ry: 22, color: 0x9c4a33 },
      }),
  },
  {
    name: 'Saturn',
    radius: 7.6,
    depth: 390,
    ax: 1.38,
    ay: 0.33,
    mobile: { x: 0.62, y: 0.73 },
    tilt: -0.32,
    rings: true,
    texture: () =>
      makeBandedTexture({
        colors: [0xe0cf9f, 0xc4ac7b, 0xf0e3c1, 0xbca272],
        bands: 12,
        seed: 42,
      }),
  },
  {
    name: 'Mars',
    radius: 5.2,
    depth: 300,
    ax: 1.42,
    ay: -0.6,
    tilt: 0.22,
    texture: () => makeMarsTexture(7),
  },
  {
    name: 'Venus',
    radius: 4.4,
    depth: 350,
    ax: -1.4,
    ay: -0.3,
    tilt: 0,
    glow: true,
    texture: () => makeVenusTexture(11),
  },
]

function gaussian() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function createGlobeScene(canvas, { onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x02030a, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 8000)
  camera.position.set(0, 0, CAMERA_Z)
  camera.lookAt(0, 0, 0)

  // Sunlight for the sky bodies. The Earth's surface is lit in its own shader.
  const sunLight = new THREE.DirectionalLight(0xfff2df, 3.2)
  sunLight.position.copy(SUN_DIR).multiplyScalar(60)
  scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x243a63, 0.5))

  // --- Earth ---------------------------------------------------------------
  const textureLoader = new THREE.TextureLoader()
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
  const disposableTextures = []

  let ready = false
  let pendingTextures = 0

  function markReady() {
    if (ready) return
    ready = true
    onReady?.()
  }

  const settleTexture = () => {
    pendingTextures -= 1
    if (pendingTextures <= 0) markReady()
  }

  const loadTexture = (url, srgb = true) => {
    pendingTextures += 1
    const texture = textureLoader.load(url, settleTexture, undefined, settleTexture)
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.anisotropy = maxAnisotropy
    disposableTextures.push(texture)
    return texture
  }

  const dayTexture = loadTexture('/textures/earth_day_4096.jpg')
  const nightTexture = loadTexture('/textures/earth_lights_2048.png')
  const cloudsTexture = loadTexture('/textures/earth_clouds_1024.png')
  const specularTexture = loadTexture('/textures/earth_specular_2048.jpg', false)
  const normalTexture = loadTexture('/textures/earth_normal_2048.jpg', false)

  const earthGroup = new THREE.Group()
  scene.add(earthGroup)

  const earthUniforms = {
    uDay: { value: dayTexture },
    uNight: { value: nightTexture },
    uSpecular: { value: specularTexture },
    uNormal: { value: normalTexture },
    uSunDir: { value: SUN_DIR.clone() },
    uCamPos: { value: camera.position.clone() },
  }

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, EARTH_TEXTURE_SIZE, 64),
    new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    }),
  )
  earthGroup.add(earth)

  const cloudUniforms = {
    uClouds: { value: cloudsTexture },
    uSunDir: { value: SUN_DIR.clone() },
  }
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.008, EARTH_TEXTURE_SIZE, 64),
    new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      vertexShader: earthVertexShader,
      fragmentShader: cloudsFragmentShader,
      transparent: true,
      depthWrite: false,
    }),
  )
  earthGroup.add(clouds)

  const atmosphereUniforms = {
    uSunDir: { value: SUN_DIR.clone() },
    uCamPos: { value: camera.position.clone() },
  }
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: atmosphereUniforms,
      vertexShader: earthVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  earthGroup.add(atmosphere)

  // --- Sky -----------------------------------------------------------------
  const skyGroup = new THREE.Group()
  scene.add(skyGroup)

  const starMaterials = []
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  const makeStarLayer = ({
    count,
    radiusMin,
    radiusMax,
    sizeMin,
    sizeMax,
    brightness,
    band = null,
    rotation = null,
  }) => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i += 1) {
      let lat
      if (band !== null) {
        lat = gaussian() * band
      } else {
        lat = Math.asin(Math.random() * 2 - 1)
      }
      const lon = Math.random() * Math.PI * 2
      const radius = radiusMin + Math.random() * (radiusMax - radiusMin)
      const cosLat = Math.cos(lat)

      positions[i * 3] = radius * cosLat * Math.cos(lon)
      positions[i * 3 + 1] = radius * Math.sin(lat)
      positions[i * 3 + 2] = radius * cosLat * Math.sin(lon)

      const roll = Math.random()
      let r
      let g
      let b
      if (roll < 0.07) {
        r = 1.0
        g = 0.72
        b = 0.5
      } else if (roll < 0.24) {
        r = 1.0
        g = 0.91
        b = 0.78
      } else if (roll < 0.62) {
        r = 0.85
        g = 0.91
        b = 1.0
      } else {
        r = 0.66
        g = 0.79
        b = 1.0
      }
      const power = brightness * (0.32 + Math.pow(Math.random(), 2.1) * 0.68)
      colors[i * 3] = r * power
      colors[i * 3 + 1] = g * power
      colors[i * 3 + 2] = b * power

      sizes[i] = sizeMin + Math.pow(Math.random(), 3) * (sizeMax - sizeMin)
      phases[i] = Math.random() * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uTime: { value: 0 },
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    starMaterials.push(material)

    const points = new THREE.Points(geometry, material)
    if (rotation) points.rotation.set(rotation[0], rotation[1], rotation[2])
    skyGroup.add(points)
    return points
  }

  makeStarLayer({
    count: 6800,
    radiusMin: 700,
    radiusMax: 1800,
    sizeMin: 0.9,
    sizeMax: 2.7,
    brightness: 1.0,
  })
  makeStarLayer({
    count: 280,
    radiusMin: 700,
    radiusMax: 1700,
    sizeMin: 2.6,
    sizeMax: 4.8,
    brightness: 1.15,
  })
  makeStarLayer({
    count: 7500,
    radiusMin: 800,
    radiusMax: 1900,
    sizeMin: 0.6,
    sizeMax: 1.7,
    brightness: 0.28,
    band: 0.085,
    rotation: [0.18, 0, 0.62],
  })

  const glowTexture = makeGlowTexture()
  disposableTextures.push(glowTexture)

  const nebulaSprites = [
    { color: 0x1d356e, opacity: 0.3, scale: 1500, position: [-820, 430, -1500] },
    { color: 0x35214f, opacity: 0.24, scale: 1150, position: [1150, -260, -1650] },
    { color: 0x123a53, opacity: 0.18, scale: 900, position: [550, 900, -1300] },
  ]
  for (const nebula of nebulaSprites) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: nebula.color,
        transparent: true,
        opacity: nebula.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    sprite.position.set(...nebula.position)
    sprite.scale.setScalar(nebula.scale)
    skyGroup.add(sprite)
  }

  // --- Planets in the sky ---------------------------------------------------
  const planetEntries = []

  for (const def of PLANET_DEFS) {
    const group = new THREE.Group()
    group.rotation.z = def.tilt

    const texture = def.texture()
    disposableTextures.push(texture)

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius, 48, 32),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0 }),
    )
    group.add(body)

    if (def.rings) {
      const ringTexture = makeRingTexture()
      disposableTextures.push(ringTexture)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(def.radius * 1.33, def.radius * 2.62, 96, 1),
        new THREE.MeshBasicMaterial({
          map: ringTexture,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.rotation.y = 0.12
      group.add(ring)
    }

    if (def.glow) {
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffe2a8,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      glow.scale.setScalar(def.radius * 4.6)
      group.add(glow)
    }

    skyGroup.add(group)

    const labelTexture = makeLabelTexture(def.name)
    disposableTextures.push(labelTexture)
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    )
    skyGroup.add(label)

    planetEntries.push({ def, group, label })
  }

  // --- Orientation from the real subsolar point ----------------------------
  const ds = new THREE.Vector3()
  const northAxis = new THREE.Vector3()
  const sunPerp = new THREE.Vector3()
  const localA2 = new THREE.Vector3()
  const localA3 = new THREE.Vector3()
  const worldB2 = new THREE.Vector3()
  const worldB3 = new THREE.Vector3()
  const basisLocal = new THREE.Matrix4()
  const basisWorld = new THREE.Matrix4()
  const orientMatrix = new THREE.Matrix4()

  /**
   * Rotation that puts the point (dec, lon) of the textured sphere under the
   * given sun direction, while keeping the north pole upright in view space.
   */
  const orientEarth = (decDeg, lonDeg) => {
    const dec = decDeg * DEG
    const lon = lonDeg * DEG
    const cosDec = Math.cos(dec)

    // Direction of a (lat, lon) point in the sphere's local frame, matching
    // the equirectangular texture layout of SphereGeometry.
    ds.set(cosDec * Math.cos(lon), Math.sin(dec), -cosDec * Math.sin(lon)).normalize()

    // World north pole: tilted from up by the solar declination.
    const beta = Math.PI / 2 - dec
    sunPerp.set(0, 1, 0).addScaledVector(SUN_DIR, -SUN_DIR.y)
    if (sunPerp.lengthSq() < 1e-8) sunPerp.set(1, 0, 0)
    sunPerp.normalize()
    northAxis.copy(sunPerp).multiplyScalar(Math.sin(beta)).addScaledVector(SUN_DIR, Math.cos(beta)).normalize()

    localA2.set(0, 1, 0).addScaledVector(ds, -ds.y).normalize()
    localA3.crossVectors(ds, localA2)
    worldB2.copy(northAxis).addScaledVector(SUN_DIR, -northAxis.dot(SUN_DIR)).normalize()
    worldB3.crossVectors(SUN_DIR, worldB2)

    basisLocal.makeBasis(ds, localA2, localA3)
    basisWorld.makeBasis(SUN_DIR, worldB2, worldB3)
    orientMatrix.copy(basisWorld).multiply(basisLocal.transpose())
    return orientMatrix
  }

  // --- Sizing ---------------------------------------------------------------
  let aspect = 1

  const layoutSky = () => {
    const halfTan = Math.tan((FOV * DEG) / 2)
    const compact = aspect < 0.95
    for (const { def, group, label } of planetEntries) {
      const mobile = compact ? def.mobile : null
      const visible = Boolean(mobile) || !compact
      group.visible = visible
      label.visible = visible && !compact
      if (!visible) continue

      const distance = CAMERA_Z + def.depth
      const unit = halfTan * distance
      const maxX = unit * aspect * 0.94
      const x = mobile
        ? mobile.x * unit * aspect
        : THREE.MathUtils.clamp((def.ax / 1.4) * 0.85 * unit * aspect, -maxX, maxX)
      const y = (mobile ? mobile.y : def.ay) * unit

      group.position.set(x, y, -def.depth)

      const labelHeight = unit * 0.062
      label.scale.set(labelHeight * 4, labelHeight, 1)
      label.position.set(x, y - def.radius * 1.7 - labelHeight * 0.9, -def.depth)
    }
  }

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    aspect = width / height

    camera.aspect = aspect
    camera.updateProjectionMatrix()

    const halfTan = Math.tan((FOV * DEG) / 2)
    const radiusForHeight = CAMERA_Z * Math.sin(Math.atan(GLOBE_HEIGHT_FRACTION * halfTan))
    const radiusForWidth = CAMERA_Z * Math.sin(Math.atan(0.86 * halfTan * aspect))
    earthGroup.scale.setScalar(Math.min(radiusForHeight, radiusForWidth))

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(width, height)
    layoutSky()
  }

  // --- Post processing ------------------------------------------------------
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
  )
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.5, 1.0)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // --- State ----------------------------------------------------------------
  let simTime = Date.now()
  let paused = false
  let raf = 0
  let elapsed = 0
  let cloudSpin = 0
  let skySpin = 0
  let lastSun = subsolarPoint(new Date(simTime))
  const pointer = { x: 0, y: 0 }
  let lastFrame = performance.now()

  const onPointerMove = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1
  }

  const animate = () => {
    raf = requestAnimationFrame(animate)
    const now = performance.now()
    const dt = Math.min((now - lastFrame) / 1000, 0.05)
    lastFrame = now
    elapsed += dt

    if (!paused) simTime += dt * 1000 * SIM_SECONDS_PER_REAL_SECOND
    const simulated = new Date(simTime)
    lastSun = subsolarPoint(simulated)

    earthGroup.quaternion.setFromRotationMatrix(orientEarth(lastSun.lat, lastSun.lon))

    cloudSpin += dt * 0.006
    clouds.rotation.y = cloudSpin

    skySpin += dt * SKY_DRIFT
    skyGroup.quaternion.setFromAxisAngle(northAxis, -skySpin)

    earthUniforms.uCamPos.value.copy(camera.position)
    atmosphereUniforms.uCamPos.value.copy(camera.position)
    for (const material of starMaterials) material.uniforms.uTime.value = elapsed

    const ease = 1 - Math.exp(-3.2 * dt)
    camera.position.x += (pointer.x * 0.24 - camera.position.x) * ease
    camera.position.y += (-pointer.y * 0.18 - camera.position.y) * ease
    camera.position.z = CAMERA_Z
    camera.lookAt(0, 0, 0)

    composer.render()
  }

  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  resize()
  animate()

  return {
    setPaused(value) {
      paused = value
    },
    togglePaused() {
      paused = !paused
      return paused
    },
    resetToNow() {
      simTime = Date.now()
    },
    getState() {
      return {
        time: new Date(simTime),
        lat: lastSun.lat,
        lon: lastSun.lon,
        paused,
        ready,
      }
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      composer.dispose()
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
        for (const material of materials) {
          for (const value of Object.values(material.uniforms ?? {})) {
            if (value?.value?.isTexture) value.value.dispose()
          }
          material.dispose()
        }
      })
      for (const texture of disposableTextures) texture.dispose()
      renderer.dispose()
    },
  }
}
