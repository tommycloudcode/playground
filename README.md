# Terra — Earth, Day & Night

A full-window, real-time 3D Earth rendered with React + three.js.

- **Rotating globe** centred in the viewport at roughly half the window height.
- **Real sunlight**: the lit hemisphere is computed from the actual subsolar point
  (solar declination + Greenwich sidereal time), so the day/night terminator and
  the Sun's overhead coordinates match the current UTC time.
- **Accelerated time**: 1 second of real time = 1 hour simulated (3,600×). The
  clock in the HUD shows the simulated UTC time.
- **Day / night shading**: NASA Blue Marble day map, city lights on the dark side,
  a soft terminator glow, ocean sun-glint, drifting clouds, and an atmospheric rim.
- **Procedural sky**: a twinkling star field with a Milky Way band, faint nebulae,
  and Jupiter, Saturn (with rings), Mars and Venus placed around the scene.
- **Controls**: pause/resume the simulation, or jump back to the present.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build    # production build to dist/
npm start        # build, then serve the compiled artifact (preview on :4173)
npm run preview  # serve the existing dist/ without rebuilding
npm run lint     # oxlint
```

## How it works

| File | Purpose |
| --- | --- |
| `src/Globe.jsx` | React shell: canvas, HUD clock, pause / now controls, loading state |
| `src/globe/createGlobeScene.js` | three.js scene, Earth orientation, sizing, sky bodies, animation loop |
| `src/globe/solar.js` | Low-precision NOAA solar ephemeris → subsolar latitude/longitude |
| `src/globe/shaders.js` | Earth, clouds, atmosphere and star GLSL shaders |
| `src/globe/textures.js` | Procedural planet, ring, glow and label textures |

Earth textures live in `public/textures` (from the three.js example assets).

The globe is oriented by building a rotation that maps the textured sphere's
subsolar point onto the fixed Sun direction, which keeps the Earth's spin at a
true 15°/hour while the sunlight stays physically consistent. The globe's angular
size is derived from the camera FOV so its silhouette stays at ~50% of the
viewport height (and fits the width on narrow screens).

## Assets

Earth imagery: [NASA Visible Earth](https://visibleearth.nasa.gov/) via the
three.js example textures (public domain / CC).
