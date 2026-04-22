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

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// A glass-walled tunnel that pierces a body of blue-green water. The walkable
// corridor is the same straight AABB as any other hallway; outside the glass
// we render a broad water volume with schools of small fish and a few large,
// slow ones arcing through.
export default function AquariumHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const length = HALLWAY_LENGTH;
    const endZ = startZ + length;
    const midZ = startZ + length / 2;
    const wHalf = HALLWAY_WIDTH / 2;

    // Deterministic schools and large fish
    const { schoolA, schoolB, largeFish } = useMemo(() => {
        const rnd = mulberry32(0x13579bdf ^ Math.floor(startZ * 17.3));
        const makeSchool = (count: number, yBase: number, side: 1 | -1) =>
            Array.from({ length: count }, () => ({
                offsetZ: rnd() * length,
                offsetY: yBase + (rnd() - 0.5) * 1.4,
                side,
                speed: 0.6 + rnd() * 0.7,
                phase: rnd() * Math.PI * 2,
                sway: 0.5 + rnd() * 0.6,
                size: 0.1 + rnd() * 0.08,
            }));
        return {
            schoolA: makeSchool(22, 1.8, 1),
            schoolB: makeSchool(18, 0.9, -1),
            largeFish: [
                {
                    offsetZ: rnd() * length,
                    offsetY: 1.6,
                    side: 1 as const,
                    speed: 0.22,
                    phase: rnd() * Math.PI * 2,
                    size: 0.9,
                },
                {
                    offsetZ: rnd() * length,
                    offsetY: 2.0,
                    side: -1 as const,
                    speed: 0.18,
                    phase: rnd() * Math.PI * 2,
                    size: 1.15,
                },
                {
                    offsetZ: rnd() * length,
                    offsetY: 2.6,
                    side: 1 as const,
                    speed: 0.14,
                    phase: rnd() * Math.PI * 2,
                    size: 1.45,
                },
            ],
        };
    }, [startZ, length]);

    return (
        <group>
            {/* Surrounding water volume - three big panels around the tunnel. */}
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

            {/* Glass ceiling (slight dome feel) */}
            <GlassPanel
                position={[0, TUNNEL_HEIGHT + WALL_T / 2, midZ]}
                size={[HALLWAY_WIDTH + WALL_T * 2, WALL_T, length]}
            />

            {/* Fish: two schools + three large individuals. Schools swim in
                loose shoaling patterns; large fish drift slowly across. */}
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
                />
            ))}
            {largeFish.map((f, i) => (
                <LargeFish
                    key={`L${i}`}
                    startZ={startZ}
                    length={length}
                    offsetZ={f.offsetZ}
                    y={f.offsetY}
                    side={f.side}
                    speed={f.speed}
                    phase={f.phase}
                    size={f.size}
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

// Shader shell rendered as the back side of a large box around the tunnel.
// Paints deep-water blue with rippling caustic-like highlights.
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
        float depth = clamp((6.0 - vWorldPos.y) / 14.0, 0.0, 1.0);
        vec3 col = mix(uShallow, uDeep, depth);
        // slow moving caustic bands
        float caustic = noise(vec2(vWorldPos.x*0.25 + uTime*0.2, vWorldPos.z*0.25));
        caustic = smoothstep(0.55, 0.9, caustic);
        col += vec3(0.35, 0.55, 0.7) * caustic * 0.18;
        // faint volumetric darkening at the tunnel-level horizon
        float hfade = smoothstep(0.0, 2.5, abs(vWorldPos.y - 1.5));
        col *= mix(1.0, 0.75, hfade * 0.4);
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
        <mesh position={[0, 2, centerZ]}>
            <boxGeometry args={[60, 22, length + 20]} />
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

// Small shoaling fish: travels a looping path along +Z with a sinuous lateral
// sway, wrapping back to startZ when it exits.
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
}) {
    const ref = useRef<THREE.Group>(null);
    const baseX = side * (HALLWAY_WIDTH / 2 + 1.6 + Math.abs(Math.sin(phase)) * 1.4);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const t = clock.getElapsedTime();
        const z = startZ + ((offsetZ + t * speed * 3.0) % length);
        const xOff = Math.sin(t * 1.6 + phase) * sway;
        const yOff = Math.sin(t * 0.9 + phase * 1.3) * 0.25;
        ref.current.position.set(baseX + xOff, y + yOff, z);
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

// A slow, arcing larger fish. Drifts from one end of the tunnel to the other,
// passing close enough to be visible through the glass.
function LargeFish({
    startZ,
    length,
    offsetZ,
    y,
    side,
    speed,
    phase,
    size,
}: {
    startZ: number;
    length: number;
    offsetZ: number;
    y: number;
    side: 1 | -1;
    speed: number;
    phase: number;
    size: number;
}) {
    const ref = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const t = clock.getElapsedTime();
        const z = startZ + ((offsetZ + t * speed * 5.0) % (length + 20)) - 10;
        const x = side * (HALLWAY_WIDTH / 2 + 3.2 + Math.sin(t * 0.3 + phase) * 1.6);
        const yOff = Math.sin(t * 0.35 + phase) * 0.7;
        ref.current.position.set(x, y + yOff, z);
        ref.current.rotation.y = side === 1 ? 0.1 : Math.PI - 0.1;
        ref.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.18;
    });
    const color = '#3a6a88';
    return (
        <group ref={ref}>
            <mesh>
                <sphereGeometry args={[size, 12, 10]} />
                <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
            </mesh>
            <mesh position={[-size * 1.05, 0, 0]} rotation={[0, 0, 0]}>
                <coneGeometry args={[size * 0.6, size * 1.1, 10]} />
                <meshStandardMaterial color={color} roughness={0.75} metalness={0.1} />
            </mesh>
            {/* Dorsal fin */}
            <mesh position={[0, size * 0.8, 0]} rotation={[0, 0, 0]}>
                <coneGeometry args={[size * 0.3, size * 0.9, 3]} />
                <meshStandardMaterial color={color} roughness={0.75} metalness={0.1} />
            </mesh>
        </group>
    );
}
