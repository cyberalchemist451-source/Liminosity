'use client';

import { useEffect, useRef } from 'react';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import { playArrivalPop } from '@/lib/gallery/ambientAudio';

/*
 * Fullscreen Mandelbrot zoom that runs while the fall cutscene is active.
 * Plays for 18 seconds with NO fade in or out - entry is abrupt (the moment
 * a fall is triggered, the overlay snaps on at full opacity) and exit is
 * equally abrupt (the overlay vanishes and the player pops into the target
 * hallway on the very next frame).
 *
 * Used by both the sealed void-shaft room (SECTION 022) and any bottomless
 * pit that calls galleryStore.triggerFall.
 *
 * Rendered directly via WebGL (no R3F) so it can sit above the R3F canvas
 * and completely cover it without compositing artifacts.
 */

const FALL_DURATION_SEC = 18.0;

const VERT_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uTime;
uniform vec2 uResolution;

vec3 palette(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.95, 1.05, 1.2) * t + vec3(0.08, 0.33, 0.61)));
}

void main() {
    // Adjust for aspect so the zoom stays circular
    vec2 p = vUv - 0.5;
    p.x *= uResolution.x / uResolution.y;

    // Famous Misiurewicz point - pleasant infinite self-similarity
    vec2 target = vec2(-0.743643887037151, 0.131825904205330);

    float zoom = 3.0 * exp(-uTime * 0.72);
    vec2 c = target + p * zoom;

    vec2 z = vec2(0.0);
    float iter = 0.0;
    const float MAX = 260.0;
    for (float i = 0.0; i < 260.0; i++) {
        if (dot(z, z) > 16.0) break;
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iter += 1.0;
    }

    vec3 col;
    if (iter >= MAX) {
        col = vec3(0.0);
    } else {
        // Smooth iteration count for continuous colouring
        float sm = iter - log2(log2(dot(z, z))) + 4.0;
        float t = sm / 60.0 + uTime * 0.05;
        col = palette(t);
        // Add a radial pulse so the zoom reads as "falling"
        float r = length(p);
        col *= 0.85 + 0.35 * sin(uTime * 1.6 - r * 4.0);
    }

    // Vignette toward the edges
    float v = smoothstep(0.95, 0.25, length(p));
    col *= 0.55 + 0.55 * v;

    fragColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(s);
        console.warn('[fall] shader compile failed', err);
        gl.deleteShader(s);
        return null;
    }
    return s;
}

export default function MandelbrotFallOverlay() {
    const fallingIntoHole = useGalleryStore((s) => s.fallingIntoHole);
    const endFall = useGalleryStore((s) => s.endFall);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!fallingIntoHole) return;
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (!canvas || !overlay) return;

        // Single arrival cue: play the pop sound the instant the overlay
        // releases, then hand control back to the store. Every exit path
        // (normal completion, WebGL unavailable, shader failure, link
        // failure) funnels through here so the audio cue is guaranteed.
        const finish = () => {
            try {
                playArrivalPop();
            } catch {
                // Audio is best-effort; never block the teleport on it.
            }
            endFall();
        };

        const resize = () => {
            const dpr = Math.min(1.5, window.devicePixelRatio || 1);
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
        };
        resize();
        window.addEventListener('resize', resize);

        const gl = canvas.getContext('webgl2');
        if (!gl) {
            console.warn('[fall] WebGL2 unavailable - skipping cutscene visuals');
            const fallback = window.setTimeout(finish, FALL_DURATION_SEC * 1000);
            return () => {
                window.clearTimeout(fallback);
                window.removeEventListener('resize', resize);
            };
        }

        const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
        const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
        if (!vert || !frag) {
            const fallback = window.setTimeout(finish, FALL_DURATION_SEC * 1000);
            return () => {
                window.clearTimeout(fallback);
                window.removeEventListener('resize', resize);
            };
        }

        const prog = gl.createProgram();
        if (!prog) return;
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.warn('[fall] program link failed', gl.getProgramInfoLog(prog));
            const fallback = window.setTimeout(finish, FALL_DURATION_SEC * 1000);
            return () => {
                window.clearTimeout(fallback);
                window.removeEventListener('resize', resize);
            };
        }

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW,
        );
        const aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(prog, 'uTime');
        const uResolution = gl.getUniformLocation(prog, 'uResolution');

        let start = 0;
        let raf = 0;
        let ended = false;
        const draw = (now: number) => {
            if (!start) start = now;
            const elapsed = (now - start) / 1000;

            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(prog);
            gl.uniform1f(uTime, elapsed);
            gl.uniform2f(uResolution, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            // No fade. The overlay is on at full opacity from the first frame
            // and vanishes abruptly when the fall ends.
            overlay.style.opacity = '1';

            if (elapsed >= FALL_DURATION_SEC) {
                if (!ended) {
                    ended = true;
                    finish();
                }
                return;
            }
            raf = window.requestAnimationFrame(draw);
        };
        raf = window.requestAnimationFrame(draw);

        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            gl.deleteProgram(prog);
            gl.deleteShader(vert);
            gl.deleteShader(frag);
            gl.deleteBuffer(vbo);
        };
    }, [fallingIntoHole, endFall]);

    if (!fallingIntoHole) return null;
    return (
        <div
            ref={overlayRef}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                pointerEvents: 'none',
                opacity: 1,
                background: '#000',
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '6vh',
                    fontFamily: '"IBM Plex Mono", monospace',
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: '12px',
                    letterSpacing: '0.3em',
                    textShadow: '0 0 12px rgba(0,0,0,0.8)',
                    userSelect: 'none',
                }}
            >
                FALLING
            </div>
        </div>
    );
}
