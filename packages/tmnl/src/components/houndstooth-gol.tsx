import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

export function HoundstoothGOL() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const rafIdRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);

  // Textures and framebuffers
  const texturesRef = useRef<WebGLTexture[]>([]);
  const framebuffersRef = useRef<WebGLFramebuffer[]>([]);
  const currentIndexRef = useRef<number>(0);

  // Program refs
  const golProgramRef = useRef<WebGLProgram | null>(null);
  const displayProgramRef = useRef<WebGLProgram | null>(null);

  // Buffer refs
  const positionBufferRef = useRef<WebGLBuffer | null>(null);
  const texcoordBufferRef = useRef<WebGLBuffer | null>(null);

  // Dynamic resolution based on window size (full viewport)
  const [simResolution, setSimResolution] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  // Responsive houndstooth scale (big pattern, proportional to container)
  const houndstoothScale = useMemo(
    () => Math.max(3.2, simResolution.width / 250), // 25% larger (200 → 250)
    [simResolution.width]
  );

  // Control state (hidden for now, ready for future UI)
  const [speed] = useState(10);
  const [color1] = useState('#09090b'); // zinc-950 for dead (matches grid)
  const [color2] = useState('#ffffff'); // White for alive

  // Shaders
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texcoord;
    varying vec2 v_texcoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texcoord = a_texcoord;
    }
  `;

  const golFragmentShaderSource = `
    precision mediump float;
    varying vec2 v_texcoord;
    uniform sampler2D u_state;
    uniform vec2 u_texture_size;

    float read_state(vec2 coord) {
      return texture2D(u_state, coord).r;
    }

    void main() {
      vec2 texel_size = 1.0 / u_texture_size;
      vec2 coord = v_texcoord;
      float current_state = read_state(coord);

      float neighbors = 0.0;
      neighbors += read_state(coord + vec2(-1.0, -1.0) * texel_size);
      neighbors += read_state(coord + vec2( 0.0, -1.0) * texel_size);
      neighbors += read_state(coord + vec2( 1.0, -1.0) * texel_size);
      neighbors += read_state(coord + vec2(-1.0,  0.0) * texel_size);
      neighbors += read_state(coord + vec2( 1.0,  0.0) * texel_size);
      neighbors += read_state(coord + vec2(-1.0,  1.0) * texel_size);
      neighbors += read_state(coord + vec2( 0.0,  1.0) * texel_size);
      neighbors += read_state(coord + vec2( 1.0,  1.0) * texel_size);

      float new_state = current_state;
      if (current_state > 0.5) {
        if (neighbors < 2.0 || neighbors > 3.0) {
          new_state = 0.0;
        }
      } else {
        if (neighbors == 3.0) {
          new_state = 1.0;
        }
      }

      gl_FragColor = vec4(new_state, 0.0, 0.0, 1.0);
    }
  `;

  const displayFragmentShaderSource = `
    precision mediump float;
    varying vec2 v_texcoord;
    uniform float u_time;
    uniform float u_scale;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform sampler2D u_gol_state;

    float Houndstooth(vec2 uv_A) {
      float sub_A = step(uv_A.x, 0.5);
      float sub_B = step(1.0-uv_A.y, 0.5);
      float sub_C = max(sub_A,sub_B);
      float sub_D = min(sub_A,sub_B);
      float sub_E = 1.0-sub_C;

      float stripe_A = step((uv_A.x) + (uv_A.y), 0.25);
      float stripe_B = step((uv_A.x) + (uv_A.y), 0.5);
      float stripe_C = step((uv_A.x) + (uv_A.y), 0.75);
      float stripe_F = step((uv_A.x-0.5) + (uv_A.y-0.5), 0.25);
      float stripe_G = step((uv_A.x-0.5) + (uv_A.y-0.5), 0.5);
      float stripe_H = step((uv_A.x-0.5) + (uv_A.y-0.5), 0.75);

      float lum = (stripe_B - stripe_A);
      lum += (stripe_F - stripe_C);
      lum += (stripe_H - stripe_G);
      lum += sub_E;
      lum -= sub_D;

      return clamp(lum, 0.0, 1.0);
    }

    void main() {
      float gol_state = texture2D(u_gol_state, v_texcoord).r;
      gol_state = smoothstep(0.4, 0.6, gol_state);

      vec2 uv = v_texcoord;
      uv.x += u_time * 0.05;
      vec2 scaled_uv = uv * u_scale;
      vec2 tile_uv = fract(scaled_uv);

      float t = Houndstooth(tile_uv);
      vec3 houndstooth_color = mix(u_color2, u_color1, t);
      vec3 final_color = mix(u_color1, houndstooth_color, gol_state);

      gl_FragColor = vec4(final_color, 1.0);
    }
  `;

  // Helper functions
  const createShader = useCallback(
    (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return shader;
      }
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    },
    []
  );

  const createProgram = useCallback(
    (
      gl: WebGLRenderingContext,
      vertexShader: WebGLShader,
      fragmentShader: WebGLShader
    ) => {
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return program;
      }
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    },
    []
  );

  const hexToRgb = useCallback((hex: string): [number, number, number] => {
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return [r / 255, g / 255, b / 255];
  }, []);

  const fillTextureWithRandomData = useCallback(
    (
      gl: WebGLRenderingContext,
      texture: WebGLTexture,
      width: number,
      height: number
    ) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const data = new Uint8Array(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        const state = Math.random() > 0.9 ? 255 : 0;
        data[i] = state;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data
      );
    },
    []
  );

  const createTextureAndFramebuffer = useCallback(
    (
      gl: WebGLRenderingContext,
      width: number,
      height: number
    ): [WebGLTexture, WebGLFramebuffer] | null => {
      const texture = gl.createTexture();
      if (!texture) return null;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer();
      if (!fbo) return null;

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );

      return [texture, fbo];
    },
    []
  );

  // Reset simulation (called on click)
  const resetSimulation = useCallback(() => {
    const gl = glRef.current;
    if (gl && texturesRef.current.length > 0) {
      fillTextureWithRandomData(
        gl,
        texturesRef.current[currentIndexRef.current],
        simResolution.width,
        simResolution.height
      );
    }
  }, [fillTextureWithRandomData, simResolution]);

  // Update resolution based on window size (full viewport)
  useEffect(() => {
    const updateResolution = () => {
      setSimResolution({
        width: Math.floor(window.innerWidth * 1.4),
        height: Math.floor(window.innerHeight * 1.4),
      });
    };

    updateResolution();

    window.addEventListener('resize', updateResolution);

    return () => window.removeEventListener('resize', updateResolution);
  }, []);

  // Setup WebGL and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || simResolution.width === 0 || simResolution.height === 0)
      return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Compile shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const golFragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      golFragmentShaderSource
    );
    const displayFragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      displayFragmentShaderSource
    );

    if (!vertexShader || !golFragmentShader || !displayFragmentShader) {
      console.error('Failed to create shaders');
      return;
    }

    // Create programs
    const golProgram = createProgram(gl, vertexShader, golFragmentShader);
    const displayProgram = createProgram(
      gl,
      vertexShader,
      displayFragmentShader
    );

    if (!golProgram || !displayProgram) {
      console.error('Failed to create programs');
      return;
    }

    golProgramRef.current = golProgram;
    displayProgramRef.current = displayProgram;

    // Get attribute locations
    const positionAttr = gl.getAttribLocation(golProgram, 'a_position');
    const texcoordAttr = gl.getAttribLocation(golProgram, 'a_texcoord');

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    positionBufferRef.current = positionBuffer;

    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW
    );
    texcoordBufferRef.current = texcoordBuffer;

    // Create textures and framebuffers
    const textures: WebGLTexture[] = [];
    const framebuffers: WebGLFramebuffer[] = [];

    for (let i = 0; i < 2; i++) {
      const result = createTextureAndFramebuffer(
        gl,
        simResolution.width,
        simResolution.height
      );
      if (result) {
        textures.push(result[0]);
        framebuffers.push(result[1]);
      }
    }

    if (textures.length > 0) {
      fillTextureWithRandomData(
        gl,
        textures[0],
        simResolution.width,
        simResolution.height
      );
    }

    texturesRef.current = textures;
    framebuffersRef.current = framebuffers;
    currentIndexRef.current = 0;
    startTimeRef.current = performance.now();
    lastUpdateTimeRef.current = 0;

    // Render loop
    const render = (now: number) => {
      const time = (now - startTimeRef.current) * 0.001;
      const updateInterval = 1.0 / speed;

      // Update GOL
      if (time - lastUpdateTimeRef.current > updateInterval) {
        lastUpdateTimeRef.current = time;

        const nextIndex = (currentIndexRef.current + 1) % 2;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[nextIndex]);
        gl.viewport(0, 0, simResolution.width, simResolution.height);

        gl.useProgram(golProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[currentIndexRef.current]);
        gl.uniform1i(gl.getUniformLocation(golProgram, 'u_state'), 0);
        gl.uniform2f(
          gl.getUniformLocation(golProgram, 'u_texture_size'),
          simResolution.width,
          simResolution.height
        );

        gl.enableVertexAttribArray(positionAttr);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(texcoordAttr);
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.vertexAttribPointer(texcoordAttr, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        currentIndexRef.current = nextIndex;
      }

      // Draw to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(displayProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[currentIndexRef.current]);
      gl.uniform1i(gl.getUniformLocation(displayProgram, 'u_gol_state'), 0);
      gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_time'), time);
      gl.uniform1f(
        gl.getUniformLocation(displayProgram, 'u_scale'),
        houndstoothScale
      );

      const [r1, g1, b1] = hexToRgb(color1);
      const [r2, g2, b2] = hexToRgb(color2);
      gl.uniform3f(
        gl.getUniformLocation(displayProgram, 'u_color1'),
        r1,
        g1,
        b1
      );
      gl.uniform3f(
        gl.getUniformLocation(displayProgram, 'u_color2'),
        r2,
        g2,
        b2
      );

      gl.enableVertexAttribArray(positionAttr);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(texcoordAttr);
      gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
      gl.vertexAttribPointer(texcoordAttr, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafIdRef.current = requestAnimationFrame(render);
    };

    rafIdRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      textures.forEach((t) => gl.deleteTexture(t));
      framebuffers.forEach((fb) => gl.deleteFramebuffer(fb));
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (texcoordBuffer) gl.deleteBuffer(texcoordBuffer);
      if (golProgram) gl.deleteProgram(golProgram);
      if (displayProgram) gl.deleteProgram(displayProgram);
    };
  }, [
    simResolution,
    speed,
    color1,
    color2,
    houndstoothScale,
    createShader,
    createProgram,
    hexToRgb,
    fillTextureWithRandomData,
    createTextureAndFramebuffer,
  ]);

  return (
    <canvas
      ref={canvasRef}
      onClick={resetSimulation}
      className="fixed inset-0 w-screen h-screen cursor-pointer"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
