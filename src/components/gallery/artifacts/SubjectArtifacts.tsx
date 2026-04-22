'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec, ThemeId } from '@/lib/gallery/types';
import { rngFor, rand, randInt } from '@/lib/gallery/rng';

/*
 * Statues whose subject matter matches the room's theme, used in place of the
 * generic procedural sculpture when a theme has a strong concrete image. These
 * deliberately prefer silhouette legibility over visual complexity - the point
 * is that the player should read "ah, that's a <thing>" within a second.
 */

type Props = { spec: RoomSpec };

// ---------------------------------------------------------------------------
// mycelium-cathedral: tall mushroom cluster with an emissive cap

function MyceliumArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const stem = '#cfb68a';

    return (
        <group>
            {/* Main mushroom */}
            <mesh position={[0, 1.6, 0]} castShadow>
                <cylinderGeometry args={[0.2, 0.3, 2.2, 14]} />
                <meshStandardMaterial color={stem} roughness={0.85} />
            </mesh>
            <mesh position={[0, 2.9, 0]} castShadow>
                <sphereGeometry args={[0.85, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial
                    color={accent}
                    emissive={accent}
                    emissiveIntensity={0.5}
                    roughness={0.4}
                />
            </mesh>
            {/* Gills underneath */}
            <mesh position={[0, 2.68, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.8, 0.25, 18]} />
                <meshStandardMaterial color="#7a5a3a" roughness={0.9} />
            </mesh>
            {/* Satellite mushrooms */}
            {[
                [0.8, 0.45, -0.3, 0.9],
                [-0.6, 0.3, 0.7, 0.7],
                [0.35, 0.35, 0.9, 0.8],
                [-0.9, 0.25, -0.4, 0.6],
            ].map(([x, y, z, s], i) => (
                <group key={i} position={[x, 0.5, z]} scale={s}>
                    <mesh position={[0, y, 0]} castShadow>
                        <cylinderGeometry args={[0.06, 0.08, y * 2, 10]} />
                        <meshStandardMaterial color={stem} roughness={0.85} />
                    </mesh>
                    <mesh position={[0, y * 2, 0]} castShadow>
                        <sphereGeometry
                            args={[0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
                        />
                        <meshStandardMaterial
                            color={accent}
                            emissive={accent}
                            emissiveIntensity={0.45}
                            roughness={0.5}
                        />
                    </mesh>
                </group>
            ))}
            {/* Spore glow */}
            <pointLight position={[0, 2.9, 0]} color={accent} intensity={0.9} distance={5.5} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// infinite-library: a leaning tower of books

function LibraryArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const rng = useMemo(() => rngFor(spec.index ^ 0xbeef, spec.index * 31 + 5), [spec.index]);

    const books = useMemo(() => {
        const items: Array<{
            y: number;
            w: number;
            h: number;
            d: number;
            color: string;
            rot: number;
        }> = [];
        let y = 0.1;
        const palette = ['#8b2e2e', '#2e5b8b', '#6b5a2e', '#3c2e8b', '#2e8b5a', '#8b6a2e'];
        for (let i = 0; i < 18; i++) {
            const w = rand(rng, 0.5, 0.9);
            const h = rand(rng, 0.08, 0.14);
            const d = rand(rng, 0.35, 0.5);
            const color = palette[randInt(rng, 0, palette.length - 1)];
            const rot = rand(rng, -0.18, 0.18);
            items.push({ y: y + h / 2, w, h, d, color, rot });
            y += h + 0.005;
        }
        return items;
    }, [rng]);

    return (
        <group>
            {books.map((b, i) => (
                <mesh
                    key={i}
                    position={[rand(rng, -0.06, 0.06), b.y, 0]}
                    rotation={[0, b.rot, 0]}
                    castShadow
                >
                    <boxGeometry args={[b.w, b.h, b.d]} />
                    <meshStandardMaterial color={b.color} roughness={0.75} />
                </mesh>
            ))}
            {/* A single open book resting on top */}
            <mesh position={[0, books[books.length - 1].y + 0.12, 0]} rotation={[0, 0.2, 0]}>
                <boxGeometry args={[0.8, 0.04, 0.55]} />
                <meshStandardMaterial color="#efe3c7" roughness={0.75} />
            </mesh>
            <mesh
                position={[0, books[books.length - 1].y + 0.14, 0]}
                rotation={[0, 0.2, 0]}
            >
                <boxGeometry args={[0.78, 0.01, 0.5]} />
                <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
            </mesh>
            <pointLight position={[0, 2.6, 0]} color={accent} intensity={0.7} distance={5.2} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// bone-orchard: a pale ribcage rising from the plinth

function BoneOrchardArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const bone = '#e5ddc6';
    const rng = useMemo(() => rngFor(spec.index ^ 0xb0ae, spec.index * 11 + 3), [spec.index]);

    return (
        <group>
            {/* Spine */}
            <mesh position={[0, 1.6, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.09, 2.0, 10]} />
                <meshStandardMaterial color={bone} roughness={0.55} />
            </mesh>
            {/* Vertebra discs along the spine */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <mesh key={`v-${i}`} position={[0, 0.8 + i * 0.26, 0]} castShadow>
                    <cylinderGeometry args={[0.14, 0.14, 0.08, 14]} />
                    <meshStandardMaterial color={bone} roughness={0.5} />
                </mesh>
            ))}
            {/* Ribs curving to the front */}
            {[-2, -1, 0, 1, 2, 3, 4].map((i) => {
                const y = 1.1 + i * 0.18;
                const size = 0.55 + Math.sin((i + 2) * 0.3) * 0.08;
                return (
                    <mesh
                        key={`r-${i}`}
                        position={[0, y, 0.1]}
                        rotation={[Math.PI / 2, 0, 0]}
                        castShadow
                    >
                        <torusGeometry
                            args={[size, 0.035, 10, 40, Math.PI * 1.1]}
                        />
                        <meshStandardMaterial color={bone} roughness={0.5} />
                    </mesh>
                );
            })}
            {/* Skull on top */}
            <group position={[0, 2.75, 0]}>
                <mesh castShadow>
                    <sphereGeometry args={[0.32, 20, 16]} />
                    <meshStandardMaterial color={bone} roughness={0.45} />
                </mesh>
                {/* Jaw */}
                <mesh position={[0, -0.22, 0.05]}>
                    <boxGeometry args={[0.32, 0.1, 0.26]} />
                    <meshStandardMaterial color={bone} roughness={0.5} />
                </mesh>
                {/* Eye sockets */}
                <mesh position={[-0.11, 0.03, 0.26]}>
                    <sphereGeometry args={[0.06, 12, 10]} />
                    <meshStandardMaterial color="#07060a" roughness={0.95} />
                </mesh>
                <mesh position={[0.11, 0.03, 0.26]}>
                    <sphereGeometry args={[0.06, 12, 10]} />
                    <meshStandardMaterial color="#07060a" roughness={0.95} />
                </mesh>
                {/* Nasal cavity */}
                <mesh position={[0, -0.1, 0.28]}>
                    <coneGeometry args={[0.04, 0.1, 6]} />
                    <meshStandardMaterial color="#07060a" roughness={0.95} />
                </mesh>
            </group>
            {/* A few scattered small bones on the plinth */}
            {Array.from({ length: 5 }).map((_, i) => (
                <mesh
                    key={`sb-${i}`}
                    position={[
                        rand(rng, -0.8, 0.8),
                        0.58,
                        rand(rng, -0.8, 0.8),
                    ]}
                    rotation={[0, rand(rng, 0, Math.PI * 2), rand(rng, 0, Math.PI)]}
                    castShadow
                >
                    <cylinderGeometry args={[0.04, 0.04, 0.32, 8]} />
                    <meshStandardMaterial color={bone} roughness={0.55} />
                </mesh>
            ))}
            <pointLight position={[0, 2.6, 0]} color={accent} intensity={0.6} distance={5.0} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// mirror-loop: a cluster of mirror-faced obelisks

function MirrorLoopArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const mirror = '#d8d8de';
    const groupRef = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
        }
    });
    const tall = [
        { x: 0, z: 0, h: 2.6 },
        { x: 0.55, z: -0.35, h: 1.85 },
        { x: -0.55, z: -0.35, h: 2.05 },
        { x: 0.35, z: 0.55, h: 1.5 },
        { x: -0.35, z: 0.55, h: 1.3 },
    ];
    return (
        <group ref={groupRef}>
            {tall.map((t, i) => (
                <mesh key={i} position={[t.x, t.h / 2 + 0.55, t.z]} castShadow>
                    <boxGeometry args={[0.3, t.h, 0.3]} />
                    <meshStandardMaterial
                        color={mirror}
                        metalness={0.95}
                        roughness={0.08}
                        envMapIntensity={1.2}
                    />
                </mesh>
            ))}
            {/* Accent glow above */}
            <mesh position={[0, 2.9, 0]}>
                <sphereGeometry args={[0.12, 14, 10]} />
                <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.0} />
            </mesh>
            <pointLight position={[0, 2.9, 0]} color={accent} intensity={0.9} distance={5.5} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// hollow-saint: a robed, headless figurine, hands slightly extended

function HollowSaintArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const robe = '#d5cbb2';
    return (
        <group>
            {/* Cloak (cone for the bottom) */}
            <mesh position={[0, 1.1, 0]} castShadow>
                <coneGeometry args={[0.6, 1.6, 18, 1, true]} />
                <meshStandardMaterial
                    color={robe}
                    roughness={0.85}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Shoulders */}
            <mesh position={[0, 2.1, 0]} castShadow>
                <cylinderGeometry args={[0.32, 0.4, 0.25, 16]} />
                <meshStandardMaterial color={robe} roughness={0.8} />
            </mesh>
            {/* Arms extended forward */}
            <mesh position={[-0.35, 1.75, 0.15]} rotation={[-0.55, 0, 0.05]} castShadow>
                <cylinderGeometry args={[0.09, 0.08, 0.7, 12]} />
                <meshStandardMaterial color={robe} roughness={0.8} />
            </mesh>
            <mesh position={[0.35, 1.75, 0.15]} rotation={[-0.55, 0, -0.05]} castShadow>
                <cylinderGeometry args={[0.09, 0.08, 0.7, 12]} />
                <meshStandardMaterial color={robe} roughness={0.8} />
            </mesh>
            {/* A glowing offering hovering above the cupped palms */}
            <mesh position={[0, 1.92, 0.55]}>
                <icosahedronGeometry args={[0.14, 0]} />
                <meshStandardMaterial
                    color={accent}
                    emissive={accent}
                    emissiveIntensity={2.2}
                    metalness={0.5}
                />
            </mesh>
            <pointLight
                position={[0, 1.92, 0.55]}
                color={accent}
                intensity={0.85}
                distance={4.2}
            />
            {/* No head. Just an empty neck stump. */}
            <mesh position={[0, 2.3, 0]}>
                <cylinderGeometry args={[0.14, 0.16, 0.08, 14]} />
                <meshStandardMaterial color="#2a2620" roughness={0.95} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------
// red-vending: a standing vending machine silhouette (the eternal red glow)

function RedVendingArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const glow = '#ff2e2e';
    return (
        <group>
            {/* Frame */}
            <mesh position={[0, 1.5, 0]} castShadow>
                <boxGeometry args={[1.1, 1.9, 0.55]} />
                <meshStandardMaterial color="#7a1414" roughness={0.7} metalness={0.3} />
            </mesh>
            {/* Front glass (emissive for the red-lit interior) */}
            <mesh position={[0, 1.6, 0.29]}>
                <boxGeometry args={[0.9, 1.4, 0.02]} />
                <meshStandardMaterial
                    color={glow}
                    emissive={glow}
                    emissiveIntensity={1.2}
                    transparent
                    opacity={0.85}
                />
            </mesh>
            {/* Rows of bottle silhouettes */}
            {[0, 1, 2].map((row) =>
                [-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
                    <mesh
                        key={`b-${row}-${i}`}
                        position={[x, 1.15 + row * 0.4, 0.32]}
                    >
                        <cylinderGeometry args={[0.05, 0.05, 0.28, 10]} />
                        <meshStandardMaterial color="#100607" roughness={0.9} />
                    </mesh>
                )),
            )}
            {/* Coin slot */}
            <mesh position={[0.42, 1.75, 0.29]}>
                <boxGeometry args={[0.12, 0.05, 0.02]} />
                <meshStandardMaterial color="#1a0607" roughness={0.9} />
            </mesh>
            {/* Collection bay at the bottom */}
            <mesh position={[0, 0.7, 0.29]}>
                <boxGeometry args={[0.5, 0.18, 0.02]} />
                <meshStandardMaterial color="#1a0607" roughness={0.9} />
            </mesh>
            <pointLight position={[0, 1.6, 0.8]} color={glow} intensity={1.0} distance={5.5} />
            {/* Flicker accent */}
            <pointLight position={[0, 2.4, 0]} color={accent} intensity={0.3} distance={3.5} />
        </group>
    );
}

// ---------------------------------------------------------------------------

const SUBJECT_ARTIFACTS: Partial<Record<ThemeId, React.ComponentType<Props>>> = {
    'mycelium-cathedral': MyceliumArtifact,
    'infinite-library': LibraryArtifact,
    'bone-orchard': BoneOrchardArtifact,
    'mirror-loop': MirrorLoopArtifact,
    'hollow-saint': HollowSaintArtifact,
    'red-vending': RedVendingArtifact,
};

export function getSubjectArtifact(themeId: ThemeId): React.ComponentType<Props> | undefined {
    return SUBJECT_ARTIFACTS[themeId];
}

export default SUBJECT_ARTIFACTS;
