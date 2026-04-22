'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { rngFor, rand, randInt, pick } from '@/lib/gallery/rng';

type Props = { spec: RoomSpec };

type ArtifactFlavor =
    | 'tori'
    | 'obelisk'
    | 'cluster'
    | 'twist'
    | 'orbs'
    | 'shrine'
    | 'impossible'
    | 'flesh-clock'
    | 'inverted-pyramid'
    | 'eye-tree'
    | 'gravity-well'
    | 'tesseract'
    | 'mouth'
    | 'floating-organs'
    | 'spike-cathedral';

const FLAVORS: ArtifactFlavor[] = [
    'tori',
    'obelisk',
    'cluster',
    'twist',
    'orbs',
    'shrine',
    'impossible',
    'flesh-clock',
    'inverted-pyramid',
    'eye-tree',
    'gravity-well',
    'tesseract',
    'mouth',
    'floating-organs',
    'spike-cathedral',
];

// Map room depth (index) to an escalation factor in [1, 2.8]. Rooms 0-3 are
// scripted; so procedural starts at ~4. By index 20 we're fully surreal.
function escalationFor(index: number): number {
    const base = Math.max(0, index - 3);
    return 1 + Math.min(1.8, base * 0.12);
}

export default function ProceduralArtifact({ spec }: Props) {
    const rng = useMemo(
        () => rngFor(spec.index ^ 0xbadc0de, spec.index * 7 + 13),
        [spec.index],
    );
    const escal = useMemo(() => escalationFor(spec.index), [spec.index]);

    // Weight flavors to lean surreal as we go deeper. Extreme-depth rooms (20+)
    // unlock a second, even weirder pool so the menagerie never settles.
    const flavor = useMemo<ArtifactFlavor>(() => {
        const surrealPool: ArtifactFlavor[] = [
            'impossible',
            'flesh-clock',
            'inverted-pyramid',
            'eye-tree',
            'gravity-well',
        ];
        const deepPool: ArtifactFlavor[] = [
            'tesseract',
            'mouth',
            'floating-organs',
            'spike-cathedral',
            'eye-tree',
            'gravity-well',
        ];
        const mildPool = FLAVORS;
        const surrealProb = Math.min(0.88, 0.12 + (spec.index - 3) * 0.07);
        const deepProb = Math.max(0, Math.min(0.6, (spec.index - 18) * 0.06));
        if (rng() < deepProb) return pick(rng, deepPool);
        const pool = rng() < surrealProb ? surrealPool : mildPool;
        return pick(rng, pool);
    }, [rng, spec.index]);

    const groupRef = useRef<THREE.Group>(null);
    const satellitesRef = useRef<THREE.Group>(null);

    const spinRate = useMemo(() => rand(rng, 0.08, 0.28) * (1 + escal * 0.25), [rng, escal]);
    const bobAmp = useMemo(() => rand(rng, 0.04, 0.18) * escal, [rng, escal]);
    const bobRate = useMemo(() => rand(rng, 0.5, 1.1), [rng]);
    const tiltAmt = useMemo(
        () => (spec.index > 4 ? rand(rng, -0.18, 0.18) * (escal - 1) : 0),
        [rng, spec.index, escal],
    );

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (groupRef.current) {
            groupRef.current.rotation.y = t * spinRate;
            groupRef.current.rotation.z = tiltAmt;
            groupRef.current.position.y = 1.2 + Math.sin(t * bobRate) * bobAmp;
        }
        if (satellitesRef.current) {
            satellitesRef.current.rotation.y = -t * (spinRate * 0.6);
            satellitesRef.current.rotation.x = Math.sin(t * 0.3) * 0.2;
        }
    });

    const accent = spec.theme.accentColor;
    const wall = spec.theme.wallColor;
    const ceilingSpace = Math.max(2.4, spec.ceilingHeight - 2.0);
    // Overall mesh scale that grows with depth.
    const S = escal;

    const children = useMemo(() => {
        switch (flavor) {
            case 'tori': {
                const count = randInt(rng, 5, Math.round(8 + escal * 3));
                const items = [];
                for (let i = 0; i < count; i++) {
                    const r = (0.35 + i * 0.18) * S;
                    const y = i * 0.3 * S;
                    items.push(
                        <mesh
                            key={i}
                            position={[0, y, 0]}
                            rotation={[Math.PI / 2, 0, i * 0.2]}
                            castShadow
                        >
                            <torusGeometry args={[r, 0.055 * S, 12, 40]} />
                            <meshStandardMaterial
                                color={accent}
                                emissive={accent}
                                emissiveIntensity={0.6}
                                metalness={0.4}
                                roughness={0.3}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'obelisk': {
                const h = rand(rng, 2.4, 3.4) * S;
                return [
                    <mesh key="b" castShadow position={[0, h / 2, 0]}>
                        <boxGeometry args={[0.5 * S, h, 0.5 * S]} />
                        <meshStandardMaterial
                            color={wall}
                            emissive={accent}
                            emissiveIntensity={0.15}
                            roughness={0.4}
                            metalness={0.3}
                        />
                    </mesh>,
                    <mesh key="c" position={[0, h + 0.3 * S, 0]} castShadow>
                        <coneGeometry args={[0.3 * S, 0.6 * S, 4]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={0.8}
                        />
                    </mesh>,
                ];
            }
            case 'cluster': {
                const count = randInt(rng, 10, Math.round(14 + escal * 6));
                const items = [];
                for (let i = 0; i < count; i++) {
                    const a = rand(rng, 0, Math.PI * 2);
                    const r = rand(rng, 0.4, 1.2) * S;
                    const y = rand(rng, 0.2, 2.6 * S);
                    const s = rand(rng, 0.15, 0.4) * S;
                    items.push(
                        <mesh key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]} castShadow>
                            <sphereGeometry args={[s, 14, 12]} />
                            <meshStandardMaterial
                                color={i % 2 ? accent : wall}
                                emissive={accent}
                                emissiveIntensity={i % 2 ? 1.0 : 0.1}
                                metalness={0.2}
                                roughness={0.4}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'twist': {
                const steps = randInt(rng, 12, Math.round(16 + escal * 8));
                const items = [];
                for (let i = 0; i < steps; i++) {
                    const y = i * 0.26 * S;
                    const rot = (i / steps) * Math.PI * 2;
                    items.push(
                        <mesh key={i} position={[0, y, 0]} rotation={[0, rot, 0]} castShadow>
                            <boxGeometry
                                args={[
                                    Math.max(0.1, (1.0 - i * 0.025) * S),
                                    0.18 * S,
                                    0.34 * S,
                                ]}
                            />
                            <meshStandardMaterial
                                color={i % 2 === 0 ? accent : wall}
                                roughness={0.4}
                                metalness={0.3}
                                emissive={i % 3 === 0 ? accent : '#000'}
                                emissiveIntensity={0.3}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'orbs': {
                const count = randInt(rng, 4, Math.round(6 + escal * 2));
                const items = [];
                for (let i = 0; i < count; i++) {
                    const y = (0.6 + i * 0.65) * S;
                    const sz = (0.32 + (count - i) * 0.1) * S;
                    items.push(
                        <mesh key={i} position={[0, y, 0]} castShadow>
                            <sphereGeometry args={[sz, 24, 18]} />
                            <meshStandardMaterial
                                color={accent}
                                emissive={accent}
                                emissiveIntensity={0.55}
                                metalness={0.6}
                                roughness={0.2}
                                transparent
                                opacity={0.85}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'shrine': {
                return [
                    <mesh key="base" position={[0, 0.4 * S, 0]} castShadow>
                        <cylinderGeometry args={[1.0 * S, 1.0 * S, 0.18 * S, 20]} />
                        <meshStandardMaterial color={wall} roughness={0.6} />
                    </mesh>,
                    <mesh key="p1" position={[-0.55 * S, 1.2 * S, 0]} castShadow>
                        <cylinderGeometry args={[0.08 * S, 0.08 * S, 1.8 * S, 12]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={0.6}
                        />
                    </mesh>,
                    <mesh key="p2" position={[0.55 * S, 1.2 * S, 0]} castShadow>
                        <cylinderGeometry args={[0.08 * S, 0.08 * S, 1.8 * S, 12]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={0.6}
                        />
                    </mesh>,
                    <mesh key="top" position={[0, 2.2 * S, 0]} castShadow>
                        <boxGeometry args={[1.4 * S, 0.14 * S, 0.3 * S]} />
                        <meshStandardMaterial color={wall} roughness={0.5} />
                    </mesh>,
                    <mesh key="core" position={[0, 1.4 * S, 0]} castShadow>
                        <icosahedronGeometry args={[0.38 * S, 0]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={1.4}
                            metalness={0.5}
                            roughness={0.25}
                        />
                    </mesh>,
                ];
            }
            case 'impossible': {
                // Interlocking cubes + cantilevered bars suggesting impossible geometry.
                const items: React.ReactNode[] = [];
                const bars = randInt(rng, 5, 9);
                for (let i = 0; i < bars; i++) {
                    const len = rand(rng, 1.2, 2.2) * S;
                    const off = rand(rng, -0.8, 0.8) * S;
                    const y = (0.4 + i * 0.35) * S;
                    const rot = rand(rng, 0, Math.PI);
                    items.push(
                        <mesh
                            key={`b${i}`}
                            position={[off, y, 0]}
                            rotation={[0, rot, i * 0.12]}
                            castShadow
                        >
                            <boxGeometry args={[len, 0.14 * S, 0.14 * S]} />
                            <meshStandardMaterial
                                color={i % 2 === 0 ? accent : wall}
                                emissive={accent}
                                emissiveIntensity={0.3}
                                metalness={0.45}
                                roughness={0.35}
                            />
                        </mesh>,
                    );
                }
                // Central impossible cube (nested wireframe-ish solids).
                for (let j = 0; j < 3; j++) {
                    const sz = (1.0 - j * 0.28) * S;
                    items.push(
                        <mesh
                            key={`c${j}`}
                            position={[0, 1.8 * S, 0]}
                            rotation={[j * 0.2, j * 0.33, j * 0.17]}
                            castShadow
                        >
                            <boxGeometry args={[sz, sz, sz]} />
                            <meshStandardMaterial
                                color={accent}
                                wireframe
                                emissive={accent}
                                emissiveIntensity={1.0}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'flesh-clock': {
                // A huge circle with rotating irregular hands and smaller circles
                // orbiting. Intentionally too many hands.
                const ringR = 1.2 * S;
                const items: React.ReactNode[] = [
                    <mesh
                        key="face"
                        position={[0, 1.6 * S, 0]}
                        rotation={[Math.PI / 2, 0, 0]}
                        castShadow
                    >
                        <torusGeometry args={[ringR, 0.1 * S, 16, 48]} />
                        <meshStandardMaterial
                            color={wall}
                            emissive={accent}
                            emissiveIntensity={0.3}
                            metalness={0.3}
                            roughness={0.5}
                        />
                    </mesh>,
                    <mesh
                        key="dial"
                        position={[0, 1.6 * S, -0.04]}
                        rotation={[Math.PI / 2, 0, 0]}
                    >
                        <circleGeometry args={[ringR * 0.97, 40]} />
                        <meshStandardMaterial color="#0b0b10" roughness={0.9} />
                    </mesh>,
                ];
                const hands = randInt(rng, 5, 9);
                for (let i = 0; i < hands; i++) {
                    const len = rand(rng, 0.5, ringR * 0.95);
                    const rot = rand(rng, 0, Math.PI * 2);
                    items.push(
                        <mesh
                            key={`h${i}`}
                            position={[
                                Math.cos(rot) * (len / 2),
                                1.6 * S,
                                Math.sin(rot) * (len / 2),
                            ]}
                            rotation={[0, -rot, 0]}
                            castShadow
                        >
                            <boxGeometry args={[len, 0.04 * S, 0.04 * S]} />
                            <meshStandardMaterial
                                color={accent}
                                emissive={accent}
                                emissiveIntensity={0.9}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'inverted-pyramid': {
                // Upside-down floating pyramid above a suspended cube.
                return [
                    <mesh
                        key="cube"
                        position={[0, 0.9 * S, 0]}
                        rotation={[0.3, 0.7, 0]}
                        castShadow
                    >
                        <boxGeometry args={[0.9 * S, 0.9 * S, 0.9 * S]} />
                        <meshStandardMaterial
                            color={wall}
                            emissive={accent}
                            emissiveIntensity={0.3}
                            metalness={0.3}
                            roughness={0.5}
                        />
                    </mesh>,
                    <mesh
                        key="pyr"
                        position={[0, 2.4 * S, 0]}
                        rotation={[Math.PI, 0, 0]}
                        castShadow
                    >
                        <coneGeometry args={[1.0 * S, 1.5 * S, 4]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={0.7}
                            metalness={0.4}
                            roughness={0.3}
                        />
                    </mesh>,
                    <mesh key="glow" position={[0, 1.65 * S, 0]}>
                        <sphereGeometry args={[0.12 * S, 16, 12]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={2.5}
                        />
                    </mesh>,
                ];
            }
            case 'eye-tree': {
                // Twisting trunk with glowing eyeball nodes.
                const items: React.ReactNode[] = [
                    <mesh key="trunk" position={[0, 1.3 * S, 0]} castShadow>
                        <cylinderGeometry args={[0.15 * S, 0.3 * S, 2.6 * S, 10]} />
                        <meshStandardMaterial color={wall} roughness={0.8} />
                    </mesh>,
                ];
                const branches = randInt(rng, 4, 7);
                for (let i = 0; i < branches; i++) {
                    const theta = (i / branches) * Math.PI * 2 + rand(rng, -0.3, 0.3);
                    const len = rand(rng, 0.6, 1.2) * S;
                    const y = rand(rng, 0.8, 2.4) * S;
                    const tipX = Math.cos(theta) * len;
                    const tipZ = Math.sin(theta) * len;
                    items.push(
                        <group key={`br${i}`}>
                            <mesh
                                position={[tipX * 0.5, y, tipZ * 0.5]}
                                rotation={[0, -theta, Math.PI / 2 - 0.2]}
                                castShadow
                            >
                                <cylinderGeometry args={[0.04 * S, 0.06 * S, len, 8]} />
                                <meshStandardMaterial color={wall} roughness={0.8} />
                            </mesh>
                            <mesh position={[tipX, y, tipZ]} castShadow>
                                <sphereGeometry args={[0.2 * S, 16, 12]} />
                                <meshStandardMaterial
                                    color="#f5efe6"
                                    emissive={accent}
                                    emissiveIntensity={0.4}
                                    roughness={0.25}
                                />
                            </mesh>
                            <mesh position={[tipX, y, tipZ + 0.17 * S]}>
                                <sphereGeometry args={[0.1 * S, 12, 10]} />
                                <meshStandardMaterial
                                    color={accent}
                                    emissive={accent}
                                    emissiveIntensity={1.4}
                                />
                            </mesh>
                            <mesh position={[tipX, y, tipZ + 0.24 * S]}>
                                <sphereGeometry args={[0.045 * S, 10, 8]} />
                                <meshStandardMaterial color="#000" />
                            </mesh>
                        </group>,
                    );
                }
                return items;
            }
            case 'gravity-well': {
                // A spiral of debris being pulled into a dark core floating
                // well above the plinth.
                const items: React.ReactNode[] = [
                    <mesh key="core" position={[0, 2.2 * S, 0]} castShadow>
                        <sphereGeometry args={[0.38 * S, 24, 20]} />
                        <meshStandardMaterial
                            color="#05050a"
                            emissive={accent}
                            emissiveIntensity={0.25}
                            roughness={0.4}
                        />
                    </mesh>,
                    <mesh
                        key="halo"
                        position={[0, 2.2 * S, 0]}
                        rotation={[Math.PI / 2.2, 0, 0]}
                    >
                        <torusGeometry args={[0.85 * S, 0.03 * S, 10, 60]} />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={1.0}
                        />
                    </mesh>,
                ];
                const spiralCount = randInt(rng, 18, Math.round(24 + escal * 10));
                for (let i = 0; i < spiralCount; i++) {
                    const t = i / spiralCount;
                    const angle = t * Math.PI * 6 + rand(rng, 0, 0.4);
                    const r = (1.5 * S) * (1 - t * 0.85);
                    const y = 2.2 * S + (t - 0.5) * 1.2 * S;
                    const sz = rand(rng, 0.04, 0.14) * S;
                    items.push(
                        <mesh
                            key={`d${i}`}
                            position={[Math.cos(angle) * r, y, Math.sin(angle) * r]}
                            rotation={[rand(rng, 0, 3), rand(rng, 0, 3), rand(rng, 0, 3)]}
                            castShadow
                        >
                            <boxGeometry args={[sz, sz * 2, sz]} />
                            <meshStandardMaterial
                                color={i % 2 ? accent : wall}
                                emissive={accent}
                                emissiveIntensity={0.3}
                                roughness={0.4}
                                metalness={0.3}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'tesseract': {
                // Nested rotating cubes evoking a 4D projection.
                const items: React.ReactNode[] = [];
                for (let j = 0; j < 5; j++) {
                    const sz = (1.8 - j * 0.32) * S;
                    items.push(
                        <mesh
                            key={`t${j}`}
                            position={[0, 1.8 * S, 0]}
                            rotation={[j * 0.27, j * 0.41, j * 0.19]}
                            castShadow
                        >
                            <boxGeometry args={[sz, sz, sz]} />
                            <meshStandardMaterial
                                color={accent}
                                wireframe={j % 2 === 0}
                                emissive={accent}
                                emissiveIntensity={j % 2 === 0 ? 1.2 : 0.35}
                                metalness={0.5}
                                roughness={0.3}
                                transparent
                                opacity={j % 2 === 0 ? 1 : 0.35}
                            />
                        </mesh>,
                    );
                }
                // Vertex orbs at the corners of the outer cube.
                const outer = 0.9 * S;
                for (let sx = -1; sx <= 1; sx += 2) {
                    for (let sy = -1; sy <= 1; sy += 2) {
                        for (let sz2 = -1; sz2 <= 1; sz2 += 2) {
                            items.push(
                                <mesh
                                    key={`v-${sx}-${sy}-${sz2}`}
                                    position={[sx * outer, 1.8 * S + sy * outer, sz2 * outer]}
                                >
                                    <sphereGeometry args={[0.06 * S, 10, 8]} />
                                    <meshStandardMaterial
                                        color={accent}
                                        emissive={accent}
                                        emissiveIntensity={1.6}
                                    />
                                </mesh>,
                            );
                        }
                    }
                }
                return items;
            }
            case 'mouth': {
                // A pale disembodied mouth, teeth bared, floating upright.
                const lip = '#64201c';
                const tooth = '#efe5c8';
                const items: React.ReactNode[] = [
                    <mesh key="upper" position={[0, 2.0 * S, 0]} scale={[1.3, 0.35, 0.4]} castShadow>
                        <sphereGeometry args={[0.55 * S, 18, 12]} />
                        <meshStandardMaterial color={lip} roughness={0.6} />
                    </mesh>,
                    <mesh key="lower" position={[0, 1.6 * S, 0]} scale={[1.3, 0.3, 0.4]} castShadow>
                        <sphereGeometry args={[0.55 * S, 18, 12]} />
                        <meshStandardMaterial color={lip} roughness={0.6} />
                    </mesh>,
                    <mesh key="cavity" position={[0, 1.8 * S, 0]} scale={[1.1, 0.25, 0.3]}>
                        <sphereGeometry args={[0.5 * S, 14, 10]} />
                        <meshStandardMaterial color="#0a0306" roughness={1} />
                    </mesh>,
                ];
                // Upper and lower teeth
                const teethCount = 9;
                for (let i = 0; i < teethCount; i++) {
                    const t = (i / (teethCount - 1)) * 2 - 1;
                    items.push(
                        <mesh
                            key={`tu${i}`}
                            position={[t * 0.55 * S, 1.87 * S, 0.18 * S]}
                            rotation={[Math.PI, 0, 0]}
                        >
                            <coneGeometry args={[0.035 * S, 0.13 * S, 4]} />
                            <meshStandardMaterial color={tooth} roughness={0.5} />
                        </mesh>,
                        <mesh
                            key={`tl${i}`}
                            position={[t * 0.55 * S, 1.73 * S, 0.18 * S]}
                        >
                            <coneGeometry args={[0.035 * S, 0.13 * S, 4]} />
                            <meshStandardMaterial color={tooth} roughness={0.5} />
                        </mesh>,
                    );
                }
                // Tongue
                items.push(
                    <mesh
                        key="tongue"
                        position={[0, 1.78 * S, 0.1 * S]}
                        scale={[0.9, 0.2, 0.55]}
                    >
                        <sphereGeometry args={[0.3 * S, 14, 10]} />
                        <meshStandardMaterial color="#9a2a2a" roughness={0.75} />
                    </mesh>,
                );
                return items;
            }
            case 'floating-organs': {
                // A suspended collection of pulsing organ-like shapes.
                const items: React.ReactNode[] = [];
                const count = randInt(rng, 5, Math.round(7 + escal * 2));
                const flesh = ['#8c2a2a', '#6a2020', '#b15050', '#4a1818'];
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * Math.PI * 2 + rand(rng, -0.3, 0.3);
                    const r = rand(rng, 0.4, 1.2) * S;
                    const y = (1.2 + rand(rng, 0, 1.6)) * S;
                    const sz = rand(rng, 0.18, 0.35) * S;
                    items.push(
                        <mesh
                            key={`o${i}`}
                            position={[Math.cos(a) * r, y, Math.sin(a) * r]}
                            scale={[1, rand(rng, 0.7, 1.4), rand(rng, 0.7, 1.4)]}
                            castShadow
                        >
                            <sphereGeometry args={[sz, 16, 12]} />
                            <meshStandardMaterial
                                color={flesh[i % flesh.length]}
                                roughness={0.55}
                                metalness={0.0}
                                emissive={accent}
                                emissiveIntensity={0.12}
                            />
                        </mesh>,
                    );
                    // Tendons joining the organs
                    items.push(
                        <mesh
                            key={`n${i}`}
                            position={[Math.cos(a) * r * 0.55, y - 0.4 * S, Math.sin(a) * r * 0.55]}
                            rotation={[0, -a, Math.PI / 4]}
                        >
                            <cylinderGeometry
                                args={[0.02 * S, 0.025 * S, 0.9 * S, 6]}
                            />
                            <meshStandardMaterial color="#522222" roughness={0.8} />
                        </mesh>,
                    );
                }
                return items;
            }
            case 'spike-cathedral': {
                // A ring of tall black spikes with a core of white fire.
                const items: React.ReactNode[] = [
                    <mesh key="core" position={[0, 1.5 * S, 0]}>
                        <sphereGeometry args={[0.35 * S, 20, 16]} />
                        <meshStandardMaterial
                            color="#fff"
                            emissive={accent}
                            emissiveIntensity={2.4}
                        />
                    </mesh>,
                ];
                const spikes = randInt(rng, 8, Math.round(10 + escal * 4));
                for (let i = 0; i < spikes; i++) {
                    const a = (i / spikes) * Math.PI * 2;
                    const r = 0.9 * S;
                    const h = rand(rng, 1.8, 3.0) * S;
                    items.push(
                        <mesh
                            key={`sp${i}`}
                            position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]}
                            rotation={[0, -a, 0]}
                            castShadow
                        >
                            <coneGeometry args={[0.07 * S, h, 6]} />
                            <meshStandardMaterial
                                color={wall}
                                roughness={0.8}
                                metalness={0.3}
                            />
                        </mesh>,
                    );
                    // Tiny accent bead at the tip
                    items.push(
                        <mesh
                            key={`sb${i}`}
                            position={[Math.cos(a) * r, h, Math.sin(a) * r]}
                        >
                            <sphereGeometry args={[0.035 * S, 8, 6]} />
                            <meshStandardMaterial
                                color={accent}
                                emissive={accent}
                                emissiveIntensity={1.4}
                            />
                        </mesh>,
                    );
                }
                return items;
            }
        }
    }, [flavor, rng, accent, wall, S, escal]);

    // Orbiting satellites appear once the rooms are deeper; they add drift +
    // surreal extras floating around the main centerpiece.
    const satellites = useMemo(() => {
        if (escal < 1.2) return null;
        const count = Math.min(8, Math.round((escal - 1) * 6));
        const items: React.ReactNode[] = [];
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + rand(rng, 0, 0.4);
            const r = rand(rng, 1.4, 2.2) * S;
            const y = rand(rng, -0.4, 1.4) * S;
            const sz = rand(rng, 0.08, 0.22) * S;
            const shape = randInt(rng, 0, 3);
            const geom =
                shape === 0 ? (
                    <boxGeometry args={[sz, sz, sz]} />
                ) : shape === 1 ? (
                    <icosahedronGeometry args={[sz, 0]} />
                ) : shape === 2 ? (
                    <tetrahedronGeometry args={[sz]} />
                ) : (
                    <octahedronGeometry args={[sz, 0]} />
                );
            items.push(
                <mesh
                    key={`sat${i}`}
                    position={[Math.cos(a) * r, y + 1.6, Math.sin(a) * r]}
                    castShadow
                >
                    {geom}
                    <meshStandardMaterial
                        color={i % 2 ? accent : wall}
                        emissive={accent}
                        emissiveIntensity={0.8}
                        metalness={0.4}
                        roughness={0.35}
                    />
                </mesh>,
            );
        }
        return items;
    }, [rng, S, escal, accent, wall]);

    // Halo spotlight color scales brighter with escalation to keep reads.
    const haloIntensity = 0.6 + escal * 0.35;
    const haloReach = Math.min(ceilingSpace + 4, 12);

    return (
        <group>
            <group ref={groupRef} position={[0, 1.2, 0]}>
                {children}
            </group>
            <group ref={satellitesRef}>{satellites}</group>
            <pointLight
                position={[0, 2.4, 0]}
                color={accent}
                intensity={haloIntensity}
                distance={haloReach}
            />
        </group>
    );
}
