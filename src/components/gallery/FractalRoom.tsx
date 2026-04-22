'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import Infographic from './Infographic';

/*
 * A deliberately non-conventional "room" that appears at SECTION 009.
 *
 * The bounding box still obeys RoomSpec dimensions (so collision + corridor
 * stitching keep working), but every surface is a shader-driven mandala and
 * the centerpiece is an infinitely-zooming fractal portal. The intent is a
 * brief Alex Grey / DMT vestibule tucked into the otherwise liminal museum.
 */

const MANDALA_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const MANDALA_FRAG = /* glsl */ `
    precision highp float;
    uniform float uTime;
    uniform float uSectors;
    uniform float uSpeed;
    varying vec2 vUv;

    vec3 palette(float t) {
        return 0.5 + 0.5 * cos(6.28318 * (vec3(0.85, 0.95, 1.08) * t + vec3(0.0, 0.35, 0.67)));
    }

    void main() {
        vec2 p = vUv - 0.5;
        float r = length(p);
        float a = atan(p.y, p.x);
        float s = uSectors;
        a = mod(a + uTime * uSpeed * 0.2, 6.28318 / s) - 3.14159 / s;
        a = abs(a);

        float tz = uTime * uSpeed;
        float rings = sin(r * 28.0 - tz * 2.0) * 0.5 + 0.5;
        float rays = sin(a * 12.0 + tz * 1.1) * 0.5 + 0.5;
        float web = sin((r * 9.0 - tz) * (a * 6.0 + tz * 0.3)) * 0.5 + 0.5;

        float intensity = rings * 0.42 + rays * 0.36 + web * 0.45;
        vec3 col = palette(r * 2.0 + uTime * 0.1) * (0.32 + 0.9 * intensity);

        // subtle scan-line flicker to evoke consciousness noise
        col *= 0.92 + 0.08 * sin(vUv.y * 220.0 + uTime * 3.0);

        // darken extreme edges to keep floor/ceiling readable
        float vign = smoothstep(0.95, 0.25, r);
        col *= 0.55 + 0.55 * vign;

        gl_FragColor = vec4(col, 1.0);
    }
`;

const PORTAL_FRAG = /* glsl */ `
    precision highp float;
    uniform float uTime;
    varying vec2 vUv;

    vec3 palette(float t) {
        return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0, 1.0, 1.0) * t + vec3(0.0, 0.25, 0.5)));
    }

    void main() {
        vec2 uv = (vUv - 0.5) * 3.2;
        float phase = mod(uTime * 0.22, 6.0);
        float zoom = exp(-phase);
        uv *= zoom;

        vec2 c = vec2(
            -0.79 + 0.06 * sin(uTime * 0.11),
             0.156 + 0.06 * cos(uTime * 0.13)
        );
        vec2 z = uv;
        float iter = 0.0;
        const int MAX = 80;
        for (int i = 0; i < MAX; i++) {
            z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
            if (dot(z, z) > 4.0) break;
            iter += 1.0;
        }
        float smoothed = iter;
        if (iter < float(MAX)) {
            smoothed = iter + 1.0 - log(log(length(z) + 1.0001)) / log(2.0);
        }
        float t = smoothed / float(MAX);
        vec3 col = palette(t * 1.6 + uTime * 0.18);
        col *= 0.12 + 1.15 * t;
        col *= 0.82 + 0.3 * (sin(uTime * 2.2) * 0.5 + 0.5);
        gl_FragColor = vec4(col, 1.0);
    }
`;

type Vec3 = [number, number, number];

type MandalaProps = {
    position: Vec3;
    rotation?: Vec3;
    size: [number, number];
    sectors?: number;
    speed?: number;
};

function MandalaSurface({ position, rotation, size, sectors = 12, speed = 1 }: MandalaProps) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uSectors: { value: sectors },
            uSpeed: { value: speed },
        }),
        [sectors, speed],
    );

    useFrame((_, dt) => {
        if (matRef.current) {
            matRef.current.uniforms.uTime.value += dt;
        }
    });

    return (
        <mesh position={position} rotation={rotation}>
            <planeGeometry args={size} />
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={MANDALA_VERT}
                fragmentShader={MANDALA_FRAG}
                side={THREE.FrontSide}
                toneMapped={false}
            />
        </mesh>
    );
}

function PortalSphere({ position, radius }: { position: Vec3; radius: number }) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

    useFrame((_, dt) => {
        if (matRef.current) {
            matRef.current.uniforms.uTime.value += dt;
        }
    });

    return (
        <mesh position={position}>
            <sphereGeometry args={[radius, 64, 40]} />
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={MANDALA_VERT}
                fragmentShader={PORTAL_FRAG}
                side={THREE.FrontSide}
                toneMapped={false}
            />
        </mesh>
    );
}

type Props = {
    spec: RoomSpec;
    hasPrev: boolean;
    hasNext: boolean;
    behind?: boolean;
};

export default function FractalRoom({ spec, hasPrev, hasNext, behind = false }: Props) {
    const { origin, width, depth, ceilingHeight, doorwayWidth, doorwayHeight, theme } = spec;
    const [ox, , oz] = origin;
    const dHalf = depth / 2;
    const wHalf = width / 2;
    const dw = doorwayWidth;
    const dh = doorwayHeight;
    const sideW = (width - dw) / 2;

    const ringsRef = useRef<THREE.Group>(null);
    const shellRef = useRef<THREE.Group>(null);

    useFrame((_, dt) => {
        if (shellRef.current) {
            shellRef.current.rotation.y += dt * 0.08;
        }
        if (ringsRef.current) {
            ringsRef.current.rotation.y -= dt * 0.25;
            ringsRef.current.rotation.z += dt * 0.12;
        }
    });

    // Walls: each face is a mandala plane flush with the collision bound.
    // North/south face split around their doorway so the opening doesn't shade.

    return (
        <group>
            {/* Floor mandala */}
            <MandalaSurface
                position={[ox, 0.01, oz]}
                rotation={[-Math.PI / 2, 0, 0]}
                size={[width, depth]}
                sectors={16}
                speed={0.7}
            />
            {/* Ceiling mandala */}
            <MandalaSurface
                position={[ox, ceilingHeight - 0.01, oz]}
                rotation={[Math.PI / 2, 0, 0]}
                size={[width, depth]}
                sectors={24}
                speed={1.2}
            />

            {/* East / west walls */}
            <MandalaSurface
                position={[ox - wHalf + 0.01, ceilingHeight / 2, oz]}
                rotation={[0, Math.PI / 2, 0]}
                size={[depth, ceilingHeight]}
                sectors={10}
                speed={0.6}
            />
            <MandalaSurface
                position={[ox + wHalf - 0.01, ceilingHeight / 2, oz]}
                rotation={[0, -Math.PI / 2, 0]}
                size={[depth, ceilingHeight]}
                sectors={10}
                speed={0.6}
            />

            {/* Front wall (entry) */}
            {hasPrev ? (
                <>
                    <MandalaSurface
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf + 0.01]}
                        size={[sideW, ceilingHeight]}
                        sectors={8}
                        speed={0.7}
                    />
                    <MandalaSurface
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf + 0.01]}
                        size={[sideW, ceilingHeight]}
                        sectors={8}
                        speed={0.7}
                    />
                    <MandalaSurface
                        position={[ox, (ceilingHeight + dh) / 2, oz - dHalf + 0.01]}
                        size={[dw, ceilingHeight - dh]}
                        sectors={12}
                        speed={0.7}
                    />
                </>
            ) : (
                <MandalaSurface
                    position={[ox, ceilingHeight / 2, oz - dHalf + 0.01]}
                    size={[width, ceilingHeight]}
                    sectors={10}
                    speed={0.7}
                />
            )}

            {/* Back wall (exit) */}
            {hasNext ? (
                <>
                    <MandalaSurface
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz + dHalf - 0.01]}
                        rotation={[0, Math.PI, 0]}
                        size={[sideW, ceilingHeight]}
                        sectors={8}
                        speed={0.7}
                    />
                    <MandalaSurface
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz + dHalf - 0.01]}
                        rotation={[0, Math.PI, 0]}
                        size={[sideW, ceilingHeight]}
                        sectors={8}
                        speed={0.7}
                    />
                    <MandalaSurface
                        position={[ox, (ceilingHeight + dh) / 2, oz + dHalf - 0.01]}
                        rotation={[0, Math.PI, 0]}
                        size={[dw, ceilingHeight - dh]}
                        sectors={12}
                        speed={0.7}
                    />
                </>
            ) : (
                <MandalaSurface
                    position={[ox, ceilingHeight / 2, oz + dHalf - 0.01]}
                    rotation={[0, Math.PI, 0]}
                    size={[width, ceilingHeight]}
                    sectors={10}
                    speed={0.7}
                />
            )}

            {/* When the player has left this room, skip the expensive interior
                cluster (portal sphere, mandala rings, dynamic lights). Shell
                surfaces alone are cheap enough to leave running. */}
            {!behind && (
                <>
                    <group ref={shellRef} position={[ox, ceilingHeight / 2, oz]}>
                        <PortalSphere position={[0, 0, 0]} radius={1.7} />
                    </group>

                    <group ref={ringsRef} position={[ox, ceilingHeight / 2, oz]}>
                        {[1.4, 2.2, 3.1, 4.2].map((r, i) => (
                            <mesh key={i} rotation={[Math.PI / 2, 0, i * 0.35]}>
                                <torusGeometry args={[r, 0.05, 16, 128]} />
                                <meshBasicMaterial
                                    color={new THREE.Color().setHSL((i * 0.17) % 1, 1, 0.6)}
                                    toneMapped={false}
                                />
                            </mesh>
                        ))}
                        {[0.8, 1.5].map((r, i) => (
                            <mesh
                                key={`v-${i}`}
                                rotation={[0, 0, (i * Math.PI) / 3]}
                            >
                                <torusGeometry args={[r, 0.03, 12, 96]} />
                                <meshBasicMaterial
                                    color={new THREE.Color().setHSL((i * 0.33 + 0.5) % 1, 1, 0.7)}
                                    toneMapped={false}
                                />
                            </mesh>
                        ))}
                    </group>

                    {/* Four rainbow point lights orbiting the portal. Only
                        active while this is the current room. */}
                    {[0, 1, 2, 3].map((i) => {
                        const ang = (i / 4) * Math.PI * 2;
                        const col = new THREE.Color().setHSL(i * 0.25, 1, 0.6);
                        return (
                            <pointLight
                                key={i}
                                position={[
                                    ox + Math.cos(ang) * 3.2,
                                    ceilingHeight * 0.62,
                                    oz + Math.sin(ang) * 3.2,
                                ]}
                                color={col}
                                intensity={0.85}
                                distance={14}
                            />
                        );
                    })}
                </>
            )}

            {/* Infographic remains on the west wall so the museum rhythm holds. */}
            {!behind && (
                <Infographic
                    theme={theme}
                    position={[ox - wHalf + 0.18, ceilingHeight * 0.55, oz]}
                    rotationY={Math.PI / 2}
                    maxWidth={Math.min(6.5, depth * 0.72)}
                    maxHeight={Math.min(3.6, ceilingHeight * 0.72)}
                />
            )}
        </group>
    );
}
