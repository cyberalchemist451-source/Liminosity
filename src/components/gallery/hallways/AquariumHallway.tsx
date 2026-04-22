'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH, HALLWAY_HEIGHT } from '@/lib/gallery/roomGenerator';
import { mulberry32 } from '@/lib/gallery/rng';

const WALL_T = 0.05;
const TUNNEL_HEIGHT = HALLWAY_HEIGHT;
const WATER_COLOR = '#0a3b55';
const WATER_BRIGHT = '#1a7da8';

// Water volume hugging the glass tunnel. Kept deliberately small: a
// shallow glass passage under a body of water, not a cathedral-sized
// aquarium. The shell is a fraction wider than the hallway so a few
// small fish can school past the glass, but does not reach into the
// neighbouring rooms the way an oversized volume would.
const SHELL_WIDTH = HALLWAY_WIDTH + 5.6; // ~1.4m of water visible either side
const SHELL_HEIGHT = TUNNEL_HEIGHT + 1.6; // a metre of water over the ceiling
const SHELL_Z_PAD = 1.2; // end-cap the water cleanly at the doorways
const FISH_MARGIN = 0.4; // keep fish this far inside the shell

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// A glass-walled tunnel that pierces a thin body of blue-green water. The
// walkable corridor is the same straight AABB as any other hallway; outside
// the glass we render a tight water volume with schools of small fish
// shoaling past. No large fish, no sprawling tank.
export default function AquariumHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const length = HALLWAY_LENGTH;
    const endZ = startZ + length;
    const midZ = startZ + length / 2;
    const wHalf = HALLWAY_WIDTH / 2;

    // X range the fish are allowed to occupy, either side of the glass.
    const xInnerAbs = wHalf + FISH_MARGIN + 0.1; // just outside the glass
    const xOuterAbs = SHELL_WIDTH / 2 - FISH_MARGIN;
    // Y range is bounded by the shell floor (~y=0) and its top.
    const yMin = 0.5;
    const yMax = SHELL_HEIGHT - FISH_MARGIN;

    const { schoolA, schoolB } = useMemo(() => {
        const rnd = mulberry32(0x13579bdf ^ Math.floor(startZ * 17.3));
        const makeSchool = (count: number, yBase: number, side: 1 | -1) =>
            Array.from({ length: count }, () => ({
                offsetZ: rnd() * length,
                offsetY: Math.min(
                    yMax - 0.3,
                    Math.max(yMin + 0.3, yBase + (rnd() - 0.5) * 1.2),
                ),
                side,
                speed: 0.6 + rnd() * 0.7,
                phase: rnd() * Math.PI * 2,
                sway: 0.25 + rnd() * 0.35,
                size: 0.08 + rnd() * 0.06,
            }));
        return {
            schoolA: makeSchool(14, 1.8, 1),
            schoolB: makeSchool(12, 1.1, -1),
        };
    }, [startZ, length, yMin, yMax]);

    return (
        <group>
            {/* Tight water volume around the tunnel. */}
            <WaterShell centerZ={midZ} length={length} />

            {/* Floor stays opaque so the player has something to walk on */}
            <mesh
                position={[0, -0.01, midZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, length]} />
                <meshStandardMaterial color="#0a2d3b" roughness={0.7} metalness={0.2} />
            </mesh>

            {/* Glass side walls (transparent) */}
            <GlassPanel
                position={[-wHalf - WALL_T / 2, TUNNEL_HEIGHT / 2, midZ]}
                size={[WALL_T, TUNNEL_HEIGHT, length]}
            />
            <GlassPanel
                position={[wHalf + WALL_T / 2, TUNNEL_HEIGHT / 2, midZ]}
                size={[WALL_T, TUNNEL_HEIGHT, length]}
            />

            {/* Glass ceiling */}
            <GlassPanel
                position={[0, TUNNEL_HEIGHT + WALL_T / 2, midZ]}
                size={[HALLWAY_WIDTH + WALL_T * 2, WALL_T, length]}
            />

            {/* Fish: two small shoals either side of the tunnel. Positions
                are clamped every frame to the shell bounds so nothing can
                swim out into the neighbouring rooms. */}
            {schoolA.map((f, i) => (
                <SmallFish
                    key={`sA${i}`}
                    startZ={startZ}
                    length={length}
                    offsetZ={f.offsetZ}
                    y={f.offsetY}
                    side={f.side}
                    speed={f.speed}
                    phase={f.phase}
                    sway={f.sway}
                    size={f.size}
                    xInnerAbs={xInnerAbs}
                    xOuterAbs={xOuterAbs}
                    yMin={yMin}
                    yMax={yMax}
                />
            ))}
            {schoolB.map((f, i) => (
                <SmallFish
                    key={`sB${i}`}
                    startZ={startZ}
                    length={length}
                    offsetZ={f.offsetZ}
                    y={f.offsetY}
                    side={f.side}
                    speed={f.speed}
                    phase={f.phase}
                    sway={f.sway}
                    size={f.size}
                    xInnerAbs={xInnerAbs}
                    xOuterAbs={xOuterAbs}
                    yMin={yMin}
                    yMax={yMax}
                />
            ))}

            {/* Cool aqueous lights */}
            <pointLight
                position={[0, TUNNEL_HEIGHT - 0.3, startZ + 3]}
                color="#6fd9ff"
                intensity={0.7}
                distance={14}
                decay={1.8}
            />
            <pointLight
                position={[0, TUNNEL_HEIGHT - 0.3, midZ]}
                color="#9fe8ff"
                intensity={0.9}
                distance={20}
                decay={1.6}
            />
            <pointLight
                position={[0, TUNNEL_HEIGHT - 0.3, endZ - 3]}
                color="#6fd9ff"
                intensity={0.7}
                distance={14}
                decay={1.8}
            />

            {/* Dead-end cap when no next room */}
            {!toRoom && (
                <mesh position={[0, TUNNEL_HEIGHT / 2, endZ + 0.1]} castShadow>
                    <boxGeometry args={[HALLWAY_WIDTH, TUNNEL_HEIGHT, 0.1]} />
                    <meshStandardMaterial color="#0a2d3b" roughness={0.9} />
                </mesh>
            )}
        </group>
    );
}

function GlassPanel({
    position,
    size,
}: {
    position: [number, number, number];
    size: [number, number, number];
}) {
    return (
        <mesh position={position}>
            <boxGeometry args={size} />
            <meshPhysicalMaterial
                color={WATER_BRIGHT}
                transparent
                opacity={0.22}
                roughness={0.08}
                metalness={0.0}
                transmission={0.5}
                thickness={0.2}
                ior={1.33}
            />
        </mesh>
    );
}

// Shader shell rendered as the back side of a tight box around the tunnel.
// Painted deep-water blue with gentle caustic highlights.
const WATER_VERT = /* glsl */ `
    varying vec3 vWorldPos;
    void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
    }
`;

const WATER_FRAG = /* glsl */ `
    precision mediump float;
    varying vec3 vWorldPos;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
    float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.,0.));
        float c = hash(i + vec2(0.,1.));
        float d = hash(i + vec2(1.,1.));
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }
    void main() {
        float depth = clamp((4.0 - vWorldPos.y) / 6.0, 0.0, 1.0);
        vec3 col = mix(uShallow, uDeep, depth);
        float caustic = noise(vec2(vWorldPos.x*0.35 + uTime*0.2, vWorldPos.z*0.35));
        caustic = smoothstep(0.55, 0.9, caustic);
        col += vec3(0.35, 0.55, 0.7) * caustic * 0.18;
        gl_FragColor = vec4(col, 1.0);
    }
`;

function WaterShell({ centerZ, length }: { centerZ: number; length: number }) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color(WATER_COLOR) },
            uShallow: { value: new THREE.Color('#4fbad0') },
        }),
        [],
    );
    useFrame(({ clock }) => {
        if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    });
    return (
        <mesh position={[0, SHELL_HEIGHT / 2, centerZ]}>
            <boxGeometry
                args={[SHELL_WIDTH, SHELL_HEIGHT, length + SHELL_Z_PAD * 2]}
            />
            <shaderMaterial
                ref={matRef}
                vertexShader={WATER_VERT}
                fragmentShader={WATER_FRAG}
                uniforms={uniforms}
                side={THREE.BackSide}
                depthWrite={false}
            />
        </mesh>
    );
}

// Small shoaling fish: loops along +Z within the hallway's Z extent, with a
// gentle lateral sway clamped to the shell's X range so none can swim into
// the rooms at either end of the tunnel.
function SmallFish({
    startZ,
    length,
    offsetZ,
    y,
    side,
    speed,
    phase,
    sway,
    size,
    xInnerAbs,
    xOuterAbs,
    yMin,
    yMax,
}: {
    startZ: number;
    length: number;
    offsetZ: number;
    y: number;
    side: 1 | -1;
    speed: number;
    phase: number;
    sway: number;
    size: number;
    xInnerAbs: number;
    xOuterAbs: number;
    yMin: number;
    yMax: number;
}) {
    const ref = useRef<THREE.Group>(null);
    // baseX sits midway between the glass and the shell wall on this side.
    const baseX = side * ((xInnerAbs + xOuterAbs) / 2);
    const xRange = (xOuterAbs - xInnerAbs) / 2 - 0.05;
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const t = clock.getElapsedTime();
        const z = startZ + ((offsetZ + t * speed * 3.0) % length);
        const xOff = Math.sin(t * 1.6 + phase) * Math.min(sway, xRange);
        const yOff = Math.sin(t * 0.9 + phase * 1.3) * 0.2;
        ref.current.position.set(
            baseX + xOff,
            Math.min(yMax, Math.max(yMin, y + yOff)),
            z,
        );
        ref.current.rotation.y = side === 1 ? 0.15 : Math.PI - 0.15;
        ref.current.rotation.z = Math.sin(t * 3.0 + phase) * 0.15;
    });
    const color = '#c8e8ff';
    return (
        <group ref={ref}>
            <mesh>
                <sphereGeometry args={[size, 8, 6]} />
                <meshStandardMaterial color={color} roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[-size * 0.9, 0, 0]}>
                <coneGeometry args={[size * 0.55, size * 0.9, 6]} />
                <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
            </mesh>
        </group>
    );
}
