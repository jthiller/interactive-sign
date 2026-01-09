import { useEffect, useRef } from 'react'

/**
 * CRT TV static effect using WebGL shader
 * Creates realistic animated static with horizontal banding
 */
export default function TVStatic() {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const glRef = useRef(null)
  const programRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false
    })
    if (!gl) {
      console.error('WebGL not supported')
      return
    }
    glRef.current = gl

    // Vertex shader - simple fullscreen quad
    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    // Fragment shader - CRT static with horizontal banding
    const fragmentShaderSource = `
      precision highp float;

      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;

      // Pseudo-random hash functions for noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
      }

      // Value noise for smoother horizontal bands
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        // Fixed grain size regardless of resolution (normalized coordinates)
        // Using a consistent scale factor for uniform grain appearance
        float grainScale = 400.0;
        vec2 grainCoord = v_uv * grainScale;

        // Time-varying offset for animation
        float timeOffset = floor(u_time * 30.0); // 30 fps static animation

        // Main static noise - fine grain
        float staticNoise = hash(grainCoord + timeOffset);

        // Secondary noise layer for variation
        float staticNoise2 = hash2(grainCoord * 0.7 + timeOffset * 1.3);

        // Combine noise layers
        float combinedNoise = mix(staticNoise, staticNoise2, 0.4);

        // Horizontal banding - rolling bands that move slowly
        float bandFreq = 8.0; // Number of major bands
        float bandY = v_uv.y * bandFreq + u_time * 0.5;
        float band = sin(bandY * 3.14159 * 2.0) * 0.5 + 0.5;
        band = pow(band, 2.0); // Sharper bands

        // Secondary faster rolling band (like CRT sync issues)
        float fastBandY = v_uv.y * 20.0 + u_time * 3.0;
        float fastBand = sin(fastBandY * 3.14159) * 0.5 + 0.5;
        fastBand = pow(fastBand, 4.0) * 0.3;

        // Horizontal noise bands - vary intensity horizontally
        float hNoise = noise(vec2(v_uv.y * 50.0, timeOffset * 0.1));

        // Scanline effect - subtle
        float scanline = sin(v_uv.y * u_resolution.y * 0.5) * 0.5 + 0.5;
        scanline = pow(scanline, 0.5) * 0.15 + 0.85;

        // Combine all effects
        float intensity = combinedNoise;
        intensity *= (0.7 + band * 0.3); // Modulate by slow bands
        intensity += fastBand * (1.0 - combinedNoise); // Add fast band highlights
        intensity *= (0.8 + hNoise * 0.2); // Horizontal noise variation
        intensity *= scanline; // Scanline darkening

        // Slight random brightness flicker
        float flicker = 0.95 + hash(vec2(timeOffset * 0.1, 0.0)) * 0.1;
        intensity *= flicker;

        // Output grayscale static with slight blue/gray tint (like real CRT)
        vec3 color = vec3(intensity) * vec3(0.9, 0.92, 1.0);

        // Darken overall to not be too bright
        color *= 0.35;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    // Compile shaders
    const compileShader = (source, type) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER)
    if (!vertexShader || !fragmentShader) return

    // Create program
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      return
    }
    programRef.current = program

    // Create fullscreen quad
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW)

    // Get locations
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')

    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Resize handler
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      const width = canvas.clientWidth * dpr
      const height = canvas.clientHeight * dpr
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    }

    // Animation loop
    let startTime = performance.now()
    const render = () => {
      resize()

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(program)

      const time = (performance.now() - startTime) / 1000
      gl.uniform1f(timeLocation, time)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(positionBuffer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="tv-static"
      aria-hidden="true"
    />
  )
}
