'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH, HALLWAY_HEIGHT } from '@/lib/gallery/roomGenerator';
import { mulberry32 } from '@/lib/gallery/rng';

const WALL_T = 0.12;
const RAIL_HEIGHT = 0.9;
const VOID_RADIUS = 160; // how far the star shell sits
const PORTAL_HEIGHT = HALLWAY_HEIGHT;

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// A narrow walkway suspended in an open starfield. Walls and ceiling are
// replaced with a thin railing and a hemispheric void shell; the walkable
// AABB stays identical to a straight hallway so existing collision simply
// keeps the player centered on the bridge.
export default function BridgeHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const length = HALLWAY_LENGTH;
    const endZ = startZ + length;
    const midZ = startZ + length / 2;
    const wHalf = HALLWAY_WIDTH / 2;

    const floorColor = '#0d111a';
    const railColor = '#28323f';
    const glowColor = fromRoom.theme.lightColor;

    // Deterministic scatter of pale asteroid points rendered via the stars
    // shader. Additionally we provide a few larger "floaters" that drift
    // slowly across the view.
    const floaters = useMemo(() => {
        const out: Array<{
            pos: [number, number, number];
            size: number;
            phase: number;
        }> = [];
        const rnd = mulberry32(0xdeadbeef ^ Math.floor(startZ * 13.7));
        for (let i = 0; i < 10; i++) {
            const side = rnd() < 0.5 ? -1 : 1;
            const x = side * (8 + rnd() * 24);
            const y = -4 + rnd() * 20;
            const z = startZ + rnd() * length;
            out.push({ pos: [x, y, z], size: 0.4 + rnd() * 1.3, phase: rnd() * Math.PI * 2 });
        }
        return out;
    }, [startZ, length]);

    return (
        <group>
            <VoidShell centerZ={midZ} />
            <Starfield centerZ={midZ} />

            {/* Bridge deck */}
            <mesh
                position={[0, -0.01, midZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, length]} />
                <meshStandardMaterial color={floorColor} roughness={0.55} metalness={0.35} />
            </mesh>

            {/* Deck underside bevel */}
            <mesh position={[0, -0.18, midZ]} receiveShadow>
                <boxGeometry args={[HALLWAY_WIDTH - 0.1, 0.3, length]} />
                <meshStandardMaterial color="#05070b" roughness={0.9} metalness={0.1} />
            </mesh>

            {/* Left & right rails (top bar + verticals) */}
            <mesh position={[-wHalf - WALL_T / 2, RAIL_HEIGHT, midZ]} castShadow receiveShadow>
                <boxGeometry args={[WALL_T, 0.08, length]} />
                <meshStandardMaterial color={railColor} roughness={0.5} metalness={0.7} />
            </mesh>
            <mesh position={[wHalf + WALL_T / 2, RAIL_HEIGHT, midZ]} castShadow receiveShadow>
                <boxGeometry args={[WALL_T, 0.08, length]} />
                <meshStandardMaterial color={railColor} roughness={0.5} metalness={0.7} />
            </mesh>
            <mesh position={[-wHalf - WALL_T / 2, RAIL_HEIGHT - 0.35, midZ]} castShadow receiveShadow>
                <boxGeometry args={[WALL_T, 0.04, length]} />
                <meshStandardMaterial color={railColor} roughness={0.6} metalness={0.6} />
            </mesh>
            <mesh position={[wHalf + WALL_T / 2, RAIL_HEIGHT - 0.35, midZ]} castShadow receiveShadow>
                <boxGeometry args={[WALL_T, 0.04, length]} />
                <meshStandardMaterial color={railColor} roughness={0.6} metalness={0.6} />
            </mesh>

            {/* Vertical stanchions at regular intervals */}
            {Array.from({ length: 10 }, (_, i) => {
                const t = (i + 0.5) / 10;
                const z = startZ + t * length;
                return (
                    <group key={`stan${i}`}>
                        <mesh position={[-wHalf - WALL_T / 2, RAIL_HEIGHT / 2, z]} castShadow>
                            <boxGeometry args={[WALL_T, RAIL_HEIGHT, 0.06]} />
                            <meshStandardMaterial color={railColor} roughness={0.55} metalness={0.65} />
                        </mesh>
                        <mesh position={[wHalf + WALL_T / 2, RAIL_HEIGHT / 2, z]} castShadow>
                            <boxGeometry args={[WALL_T, RAIL_HEIGHT, 0.06]} />
                            <meshStandardMaterial color={railColor} roughness={0.55} metalness={0.65} />
                        </mesh>
                    </group>
                );
            })}

            {/* Low glowing strip under each rail - functions as path light + accent */}
            <mesh position={[-wHalf + 0.02, 0.02, midZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.05, length - 0.4]} />
                <meshBasicMaterial color={glowColor} transparent opacity={0.9} />
            </mesh>
            <mesh position={[wHalf - 0.02, 0.02, midZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.05, length - 0.4]} />
                <meshBasicMaterial color={glowColor} transparent opacity={0.9} />
            </mesh>

            {/* Drifting floaters outside the bridge */}
            {floaters.map((f, i) => (
                <Floater key={`f${i}`} pos={f.pos} size={f.size} phase={f.phase} />
            ))}

            {/* Soft up-light from the bridge itself so the player silhouette reads */}
            <pointLight
                position={[0, 0.9, midZ]}
                color={glowColor}
                intensity={0.7}
                distance={length * 0.9}
                decay={1.6}
            />
            <pointLight
                position={[0, 0.9, startZ + 4]}
                color={glowColor}
                intensity={0.4}
                distance={16}
                decay={1.8}
            />
            <pointLight
                position={[0, 0.9, endZ - 4]}
                color={glowColor}
                intensity={0.4}
                distance={16}
                decay={1.8}
            />

            {/* Dead-end cap (only if no next room yet) - a closed portal so the
                player can't walk into the void */}
            {!toRoom && (
                <mesh position={[0, PORTAL_HEIGHT / 2, endZ + 0.1]} castShadow>
                    <boxGeometry args={[HALLWAY_WIDTH, PORTAL_HEIGHT, 0.1]} />
                    <meshStandardMaterial color="#101418" roughness={0.9} />
                </mesh>
            )}
        </group>
    );
}

// Surrounding black shell - closes the sky around the bridge so the player
// doesn't see the adjacent rooms through the open sides.
function VoidShell({ centerZ }: { centerZ: number }) {
    return (
        <mesh position={[0, 0, centerZ]}>
            <sphereGeometry args={[VOID_RADIUS, 24, 16]} />
            <meshBasicMaterial color="#02030a" side={THREE.BackSide} />
        </mesh>
    );
}

// Shader-rendered starfield painted onto the inside of a smaller sphere.
const STAR_VERT = /* glsl */ `
    varying vec3 vDir;
    void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const STAR_FRAG = /* glsl */ `
    precision mediump float;
    varying vec3 vDir;
    uniform float uTime;
    float hash(vec3 p){
        p = fract(p*0.3183099+.1);
        p*=17.0;
        return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
    }
    void main() {
        vec3 d = normalize(vDir);
        float scale = 120.0;
        vec3 gp = floor(d * scale);
        float h = hash(gp);
        float star = smoothstep(0.9965, 1.0, h);
        // subtle twinkle
        star *= 0.7 + 0.3*sin(uTime*1.3 + h*40.0);
        // a low nebula gradient so the void isn't dead black
        float neb = smoothstep(0.2, -0.4, d.y) * 0.12 + 0.02;
        vec3 nebCol = mix(vec3(0.02,0.02,0.07), vec3(0.08,0.03,0.15), smoothstep(-1.0,1.0,d.x));
        vec3 col = nebCol * neb + vec3(star);
        gl_FragColor = vec4(col, 1.0);
    }
`;

function Starfield({ centerZ }: { centerZ: number }) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
    useFrame(({ clock }) => {
        if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    });
    return (
        <mesh position={[0, 0, centerZ]}>
            <sphereGeometry args={[VOID_RADIUS * 0.6, 32, 20]} />
            <shaderMaterial
                ref={matRef}
                vertexShader={STAR_VERT}
                fragmentShader={STAR_FRAG}
                uniforms={uniforms}
                side={THREE.BackSide}
                depthWrite={false}
            />
        </mesh>
    );
}

function Floater({
    pos,
    size,
    phase,
}: {
    pos: [number, number, number];
    size: number;
    phase: number;
}) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const t = clock.getElapsedTime();
        ref.current.position.y = pos[1] + Math.sin(t * 0.15 + phase) * 0.6;
        ref.current.rotation.x = t * 0.08 + phase;
        ref.current.rotation.y = t * 0.06 + phase * 0.7;
    });
    return (
        <mesh ref={ref} position={pos}>
            <dodecahedronGeometry args={[size, 0]} />
            <meshStandardMaterial
                color="#1a1e2a"
                roughness={0.95}
                metalness={0.1}
                emissive="#050814"
                emissiveIntensity={0.3}
            />
        </mesh>
    );
}
