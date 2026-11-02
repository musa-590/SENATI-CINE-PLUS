/**
 * Fondo animado continuo en WebGL 2 (FluxLines)
 * Renderizado de fluidos y líneas cálidas optimizado para no interferir con la navegación
 */

const MAX_COLORS = 8;
const FLOW = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FIELD = `
float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * 3.14159265 - 3.14159265 / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uLine;
uniform float uMaxHalf;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform vec4 uMagnet;
uniform vec4 uSwirl;
uniform float uReveal;
uniform float uLight;
uniform float uOpaque;
uniform vec3 uBackground;
uniform float uOpacity;
out vec4 outColor;
${FIELD}

vec3 palette(float h) {
  float x = clamp(h, 0.0, 1.0) * float(uColorCount - 1);
  int i = int(floor(x));
  int j = min(i + 1, uColorCount - 1);
  return mix(uColors[i], uColors[j], smoothstep(0.0, 1.0, x - float(i)));
}

void main() {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uResolution * 0.5) / ref;
  p += uFlow * uTime * uSpeed * 0.18;
  float n = dbn(p * 2.4, 0.8, 12.3) * uTurbulence;
  float wave = sin(p.y * 3.5 + n * 4.0 + uTime * 0.25);
  float rim = smoothstep(0.0, uRimWidth, abs(wave));
  float alpha = (1.0 - rim) * uOpacity * uReveal;
  vec3 col = palette(n * 0.5 + 0.5);
  col += vec3(uGlow * 0.15) * (1.0 - rim);
  outColor = vec4(col * alpha, alpha * 0.85);
}`;

function compileShader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function initFluxLines(canvas, options = {}) {
  if (!canvas) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power'
  });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPosition');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(prog, 'uResolution');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uFlow = gl.getUniformLocation(prog, 'uFlow');
  const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
  const uScale = gl.getUniformLocation(prog, 'uScale');
  const uTurbulence = gl.getUniformLocation(prog, 'uTurbulence');
  const uFluidity = gl.getUniformLocation(prog, 'uFluidity');
  const uRimWidth = gl.getUniformLocation(prog, 'uRimWidth');
  const uGlow = gl.getUniformLocation(prog, 'uGlow');
  const uColors = gl.getUniformLocation(prog, 'uColors');
  const uColorCount = gl.getUniformLocation(prog, 'uColorCount');
  const uReveal = gl.getUniformLocation(prog, 'uReveal');
  const uOpacity = gl.getUniformLocation(prog, 'uOpacity');

  const colors = [
    0.93, 0.89, 0.82,  // #efe3d2
    0.65, 0.57, 0.48,  // #a8927b
    0.29, 0.25, 0.21   // #4a4137
  ];

  let width = 0;
  let height = 0;
  let rafId = 0;
  let running = true;
  let startTime = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const newW = Math.floor(window.innerWidth * dpr);
    const newH = Math.floor(window.innerHeight * dpr);
    if (newW !== width || newH !== height) {
      width = newW;
      height = newH;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function render(now) {
    if (!running) return;

    if (document.hidden || document.body.classList.contains('modal-open')) {
      rafId = requestAnimationFrame(render);
      return;
    }

    const t = (now - startTime) * 0.001;

    gl.useProgram(prog);
    gl.uniform2f(uResolution, width, height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uFlow, 0.0, -1.0);
    gl.uniform1f(uSpeed, 0.18);
    gl.uniform1f(uScale, 1.8);
    gl.uniform1f(uTurbulence, 0.7);
    gl.uniform1f(uFluidity, 0.12);
    gl.uniform1f(uRimWidth, 0.22);
    gl.uniform1f(uGlow, 1.2);
    gl.uniform1i(uColorCount, 3);
    gl.uniform3fv(uColors, new Float32Array(colors));
    gl.uniform1f(uReveal, Math.min(1.0, t * 0.8));
    gl.uniform1f(uOpacity, 0.9);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    rafId = requestAnimationFrame(render);
  }

  rafId = requestAnimationFrame(render);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    }
  };
}
