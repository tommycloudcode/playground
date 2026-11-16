// GLSL used by the globe scene.

export const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const earthFragmentShader = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uSpecular;
  uniform sampler2D uNormal;
  uniform vec3 uSunDir;
  uniform vec3 uCamPos;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 N0 = normalize(vNormalW);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Build a tangent frame from screen-space derivatives so the equirect
    // normal map can be applied without precomputed tangents.
    vec3 dp1 = dFdx(vWorldPos);
    vec3 dp2 = dFdy(vWorldPos);
    vec2 duv1 = dFdx(vUv);
    vec2 duv2 = dFdy(vUv);
    vec3 dp2perp = cross(dp2, N0);
    vec3 dp1perp = cross(N0, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
    float invmax = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-8));
    vec3 texN = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 N = normalize(mat3(T * invmax, B * invmax, N0) * vec3(texN.xy * 0.75, texN.z));

    float ndl = dot(N, L);
    float ndlSmooth = dot(N0, L);
    float day = smoothstep(-0.12, 0.22, ndlSmooth);
    float diff = clamp(ndl, 0.0, 1.0);

    vec3 dayColor = texture2D(uDay, vUv).rgb;
    vec3 nightColor = texture2D(uNight, vUv).rgb;
    float ocean = texture2D(uSpecular, vUv).r;

    // Sunlit surface + a whisper of ambient so the night side keeps its shape.
    vec3 color = dayColor * (0.03 + diff * 1.3);

    // Warm scattering right at the terminator.
    float term = smoothstep(-0.3, 0.0, ndlSmooth) * (1.0 - smoothstep(0.0, 0.38, ndlSmooth));
    color += vec3(1.0, 0.5, 0.22) * term * 0.07;

    // City lights on the dark side.
    color += nightColor * (1.0 - day) * 2.6;

    // Ocean glint.
    vec3 H = normalize(L + V);
    float glint = pow(max(dot(N0, H), 0.0), 150.0) * ocean;
    color += vec3(1.0, 0.97, 0.9) * glint * 0.5 * day;
    float sheen = pow(max(dot(N0, H), 0.0), 22.0) * ocean * 0.06 * day;
    color += vec3(1.0, 0.94, 0.85) * sheen;

    // Atmospheric rim on the planet itself.
    float fresnel = pow(1.0 - max(dot(N0, V), 0.0), 3.0);
    color += vec3(0.2, 0.46, 1.0) * fresnel * (0.08 + 0.5 * day);

    gl_FragColor = vec4(color, 1.0);
  }
`

export const cloudsFragmentShader = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vNormalW;

  void main() {
    float mask = texture2D(uClouds, vUv).a;
    float lit = smoothstep(-0.18, 0.25, dot(normalize(vNormalW), normalize(uSunDir)));
    vec3 color = mix(vec3(0.26, 0.34, 0.5), vec3(0.96, 0.97, 0.98), lit);
    float alpha = mask * mix(0.05, 0.9, lit);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

export const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uCamPos;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCamPos - vWorldPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float sun = smoothstep(-0.55, 0.35, dot(N, normalize(uSunDir)));
    vec3 color = mix(vec3(0.02, 0.05, 0.16), vec3(0.28, 0.56, 1.0), sun);
    gl_FragColor = vec4(color * (0.35 + 1.7 * sun), rim * (0.12 + 0.88 * sun) * 0.9);
  }
`

export const starVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vPhase;

  void main() {
    vColor = aColor;
    vPhase = aPhase;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio;
  }
`

export const starFragmentShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vColor;
  varying float vPhase;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d2 = dot(p, p);
    if (d2 > 0.25) discard;
    float core = 1.0 - d2 * 4.0;
    float twinkle = 0.78 + 0.22 * sin(uTime * 1.8 + vPhase);
    float alpha = pow(core, 2.0) * twinkle;
    gl_FragColor = vec4(vColor, alpha);
  }
`
