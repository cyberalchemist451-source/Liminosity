'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DwellerKind } from '@/lib/gallery/types';

/*
 * Dwellers are the rare humanoid figures that occasionally stand in the
 * deeper rooms of the museum. They don't move, patrol, or react - stillness
 * is what makes them unsettling - but they now breathe, blink, and shift
 * their weight ever so slightly so they don't read as obvious props.
 *
 * Each kind is built from segmented limbs (thigh/shin/foot,
 * upper-arm/forearm/hand) anchored around a breathing torso. The whole
 * skeleton lives in a single group that yaws and floats by fractions of a
 * degree. Animation is deliberately low-amplitude: the moment the figure
 * visibly "acts", the uncanny effect collapses.
 */

type Props = {
    kind: DwellerKind;
    anchor: [number, number, number];
    facing: number;
};

export default function Dweller({ kind, anchor, facing }: Props) {
    const groupRef = useRef<THREE.Group>(null);
    // Deterministic per-dweller phase offset. Keeps nearby dwellers from
    // breathing and swaying in lockstep.
    const seed = useMemo(
        () => (anchor[0] * 13.37 + anchor[2] * 7.19) % (Math.PI * 2),
        [anchor],
    );

    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const t = clock.getElapsedTime();
        // Whole-body idle: very small yaw sway + a tiny vertical float, both
        // well under the threshold of "is it moving?". Combined with per-part
        // breathing inside each kind, it's enough to feel alive.
        groupRef.current.rotation.y = facing + Math.sin(t * 0.35 + seed) * 0.014;
        groupRef.current.position.y = Math.sin(t * 0.6 + seed) * 0.012;
    });

    return (
        <group ref={groupRef} position={anchor}>
            {renderKind(kind, seed)}
        </group>
    );
}

function renderKind(kind: DwellerKind, seed: number) {
    switch (kind) {
        case 'grey':
            return <GreyAlien seed={seed} />;
        case 'faceless-suit':
            return <FacelessSuit seed={seed} />;
        case 'slenderman':
            return <Slenderman seed={seed} />;
        case 'observer':
            return <Observer seed={seed} />;
        case 'mothman':
            return <Mothman seed={seed} />;
    }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// A breathing-torso wrapper. Subtly expands and contracts the mesh Y-scale
// and lifts the shoulders fractions of a centimetre each cycle.
function BreathingTorso({
    seed,
    rate = 0.55,
    amp = 0.015,
    children,
}: {
    seed: number;
    rate?: number;
    amp?: number;
    children: React.ReactNode;
}) {
    const ref = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        const t = clock.getElapsedTime() * rate + seed * 1.7;
        const s = 1 + Math.sin(t) * amp;
        ref.current.scale.set(1, s, 1);
        ref.current.position.y = Math.sin(t) * amp * 3.0;
    });
    return <group ref={ref}>{children}</group>;
}

// A head with independent micro-movements: small pan, occasional tilt, very
// rare eye-blink via Y-scale compression of a child mesh. Children render
// inside the tilt group so eyes/features tilt with the head.
function LivingHead({
    seed,
    blinkEyes = false,
    position,
    children,
}: {
    seed: number;
    blinkEyes?: boolean;
    position: [number, number, number];
    children: React.ReactNode;
}) {
    const yawRef = useRef<THREE.Group>(null);
    const tiltRef = useRef<THREE.Group>(null);
    const blinkRef = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (yawRef.current) {
            yawRef.current.rotation.y = Math.sin(t * 0.22 + seed) * 0.04;
        }
        if (tiltRef.current) {
            tiltRef.current.rotation.z = Math.sin(t * 0.17 + seed * 1.4) * 0.025;
            tiltRef.current.rotation.x = Math.sin(t * 0.13 + seed * 2.1) * 0.02;
        }
        if (blinkEyes && blinkRef.current) {
            // Rare, fast blink: most of the time scale.y = 1; every ~6-9s
            // it snaps to ~0.05 for ~0.15s.
            const cyc = (t + seed * 11.0) % 7.2;
            const blink = cyc > 6.9 && cyc < 7.05 ? 0.05 : 1.0;
            blinkRef.current.scale.y = blink;
        }
    });
    return (
        <group position={position}>
            <group ref={yawRef}>
                <group ref={tiltRef}>
                    {blinkEyes ? <group ref={blinkRef}>{children}</group> : children}
                </group>
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Grey Alien (~1.25m) - small, pale-grey, bulbous head, huge almond eyes.
// Segmented limbs, subtle skin sheen via MeshPhysicalMaterial clearcoat.
// ---------------------------------------------------------------------------

function GreyAlien({ seed }: { seed: number }) {
    const skin = '#b8c2b0';
    const skinShadow = '#8d9989';
    const dark = '#050608';

    return (
        <group>
            {/* Feet */}
            <mesh position={[-0.09, 0.025, 0.04]} castShadow>
                <boxGeometry args={[0.07, 0.05, 0.16]} />
                <meshStandardMaterial color={skinShadow} roughness={0.85} />
            </mesh>
            <mesh position={[0.09, 0.025, 0.04]} castShadow>
                <boxGeometry args={[0.07, 0.05, 0.16]} />
                <meshStandardMaterial color={skinShadow} roughness={0.85} />
            </mesh>

            {/* Shins */}
            <mesh position={[-0.09, 0.22, 0]} castShadow>
                <capsuleGeometry args={[0.045, 0.32, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.25} />
            </mesh>
            <mesh position={[0.09, 0.22, 0]} castShadow>
                <capsuleGeometry args={[0.045, 0.32, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.25} />
            </mesh>

            {/* Knees */}
            <mesh position={[-0.09, 0.42, 0]} castShadow>
                <sphereGeometry args={[0.055, 12, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.3} />
            </mesh>
            <mesh position={[0.09, 0.42, 0]} castShadow>
                <sphereGeometry args={[0.055, 12, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.3} />
            </mesh>

            {/* Thighs */}
            <mesh position={[-0.09, 0.62, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.34, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.25} />
            </mesh>
            <mesh position={[0.09, 0.62, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.34, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.25} />
            </mesh>

            {/* Hips */}
            <mesh position={[0, 0.82, 0]} castShadow>
                <sphereGeometry args={[0.14, 16, 12]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.2} />
            </mesh>

            <BreathingTorso seed={seed} rate={0.6} amp={0.02}>
                {/* Torso: narrow, pear-shaped */}
                <mesh position={[0, 1.0, 0]} scale={[1.0, 1.0, 0.85]} castShadow>
                    <sphereGeometry args={[0.19, 18, 14]} />
                    <meshPhysicalMaterial
                        color={skin}
                        roughness={0.5}
                        clearcoat={0.3}
                        clearcoatRoughness={0.6}
                    />
                </mesh>
                {/* Faint sternum shadow */}
                <mesh position={[0, 0.96, 0.17]}>
                    <planeGeometry args={[0.04, 0.18]} />
                    <meshBasicMaterial color={skinShadow} transparent opacity={0.35} />
                </mesh>

                {/* Shoulders */}
                <mesh position={[-0.2, 1.12, 0]} castShadow>
                    <sphereGeometry args={[0.075, 14, 10]} />
                    <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.25} />
                </mesh>
                <mesh position={[0.2, 1.12, 0]} castShadow>
                    <sphereGeometry args={[0.075, 14, 10]} />
                    <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.25} />
                </mesh>
            </BreathingTorso>

            {/* Upper arms */}
            <mesh position={[-0.22, 0.93, 0]} rotation={[0, 0, 0.08]} castShadow>
                <capsuleGeometry args={[0.032, 0.32, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.2} />
            </mesh>
            <mesh position={[0.22, 0.93, 0]} rotation={[0, 0, -0.08]} castShadow>
                <capsuleGeometry args={[0.032, 0.32, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.2} />
            </mesh>

            {/* Elbows */}
            <mesh position={[-0.25, 0.76, 0]} castShadow>
                <sphereGeometry args={[0.04, 10, 8]} />
                <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.25} />
            </mesh>
            <mesh position={[0.25, 0.76, 0]} castShadow>
                <sphereGeometry args={[0.04, 10, 8]} />
                <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.25} />
            </mesh>

            {/* Forearms */}
            <mesh position={[-0.26, 0.58, 0]} castShadow>
                <capsuleGeometry args={[0.028, 0.32, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.2} />
            </mesh>
            <mesh position={[0.26, 0.58, 0]} castShadow>
                <capsuleGeometry args={[0.028, 0.32, 6, 10]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.2} />
            </mesh>

            {/* Hands + four long digits each (suggested by thin cylinders) */}
            <GreyHand seed={seed + 1} position={[-0.27, 0.38, 0]} flip />
            <GreyHand seed={seed + 2} position={[0.27, 0.38, 0]} />

            {/* Neck */}
            <mesh position={[0, 1.2, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.055, 0.12, 12]} />
                <meshPhysicalMaterial color={skin} roughness={0.5} clearcoat={0.25} />
            </mesh>

            <LivingHead seed={seed} blinkEyes position={[0, 1.4, 0]}>
                {/* Head: large almond ellipsoid, tapered chin */}
                <mesh scale={[1.0, 1.28, 0.93]} castShadow>
                    <sphereGeometry args={[0.22, 28, 20]} />
                    <meshPhysicalMaterial
                        color={skin}
                        roughness={0.45}
                        clearcoat={0.45}
                        clearcoatRoughness={0.4}
                    />
                </mesh>
                {/* Brow ridge - a subtle darker band */}
                <mesh position={[0, 0.04, 0.18]} scale={[1.0, 0.25, 0.4]}>
                    <sphereGeometry args={[0.2, 20, 12]} />
                    <meshStandardMaterial color={skinShadow} transparent opacity={0.4} />
                </mesh>
                {/* Nostril dimples */}
                <mesh position={[-0.025, -0.04, 0.205]}>
                    <sphereGeometry args={[0.012, 8, 6]} />
                    <meshStandardMaterial color="#2a302c" />
                </mesh>
                <mesh position={[0.025, -0.04, 0.205]}>
                    <sphereGeometry args={[0.012, 8, 6]} />
                    <meshStandardMaterial color="#2a302c" />
                </mesh>
                {/* Mouth - a single dark slit */}
                <mesh position={[0, -0.12, 0.2]}>
                    <boxGeometry args={[0.06, 0.008, 0.005]} />
                    <meshStandardMaterial color="#12100f" />
                </mesh>

                {/* Almond eyes: outer lid + inner glossy orb for depth */}
                <group position={[-0.09, 0.01, 0.19]} rotation={[0, 0, 0.45]}>
                    <mesh>
                        <sphereGeometry args={[0.072, 18, 14]} />
                        <meshStandardMaterial
                            color={dark}
                            roughness={0.12}
                            metalness={0.2}
                        />
                    </mesh>
                    {/* Wet highlight */}
                    <mesh position={[-0.018, 0.02, 0.05]}>
                        <sphereGeometry args={[0.012, 8, 6]} />
                        <meshBasicMaterial color="#f0f2ff" />
                    </mesh>
                </group>
                <group position={[0.09, 0.01, 0.19]} rotation={[0, 0, -0.45]}>
                    <mesh>
                        <sphereGeometry args={[0.072, 18, 14]} />
                        <meshStandardMaterial
                            color={dark}
                            roughness={0.12}
                            metalness={0.2}
                        />
                    </mesh>
                    <mesh position={[0.018, 0.02, 0.05]}>
                        <sphereGeometry args={[0.012, 8, 6]} />
                        <meshBasicMaterial color="#f0f2ff" />
                    </mesh>
                </group>
            </LivingHead>
        </group>
    );
}

function GreyHand({
    position,
    flip = false,
    seed,
}: {
    position: [number, number, number];
    flip?: boolean;
    seed: number;
}) {
    const skin = '#b8c2b0';
    const sgn = flip ? -1 : 1;
    const ref = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        if (!ref.current) return;
        // Tiny finger-flex illusion: entire hand rotates by ~1 degree
        const t = clock.getElapsedTime();
        ref.current.rotation.z = Math.sin(t * 0.45 + seed) * 0.03;
    });
    return (
        <group ref={ref} position={position}>
            {/* Palm */}
            <mesh castShadow>
                <boxGeometry args={[0.05, 0.07, 0.03]} />
                <meshPhysicalMaterial color={skin} roughness={0.6} clearcoat={0.15} />
            </mesh>
            {/* Four long digits */}
            {[-0.018, -0.006, 0.006, 0.018].map((fx, i) => (
                <mesh
                    key={i}
                    position={[sgn * (fx + 0.0), -0.08, 0]}
                    rotation={[0, 0, sgn * 0.04]}
                    castShadow
                >
                    <capsuleGeometry args={[0.007, 0.07 + i * 0.005, 4, 6]} />
                    <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.15} />
                </mesh>
            ))}
            {/* Thumb */}
            <mesh
                position={[sgn * 0.03, -0.04, 0.008]}
                rotation={[0, 0, sgn * 0.8]}
                castShadow
            >
                <capsuleGeometry args={[0.009, 0.04, 4, 6]} />
                <meshPhysicalMaterial color={skin} roughness={0.55} clearcoat={0.15} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Faceless Suit (~1.88m) - a man-shaped suit with a perfectly smooth head.
// Now with proper lapels, collar, tie, segmented limbs, and glossy shoes.
// Also exported so the Silence Room can build a ring of watchers that track
// the player's head without going through the Dweller wrapper.
// ---------------------------------------------------------------------------

export function FacelessSuit({ seed }: { seed: number }) {
    const suit = '#141414';
    const suitHL = '#1f1f1f';
    const shirt = '#e9e9e4';
    const skin = '#dacdb8';
    const tieColor = '#551f24';

    return (
        <group>
            {/* Shoes */}
            <mesh position={[-0.12, 0.035, 0.06]} castShadow>
                <boxGeometry args={[0.12, 0.07, 0.28]} />
                <meshPhysicalMaterial
                    color="#0a0a0a"
                    roughness={0.28}
                    metalness={0.1}
                    clearcoat={0.8}
                    clearcoatRoughness={0.3}
                />
            </mesh>
            <mesh position={[0.12, 0.035, 0.06]} castShadow>
                <boxGeometry args={[0.12, 0.07, 0.28]} />
                <meshPhysicalMaterial
                    color="#0a0a0a"
                    roughness={0.28}
                    metalness={0.1}
                    clearcoat={0.8}
                    clearcoatRoughness={0.3}
                />
            </mesh>

            {/* Shins (trousers) */}
            <mesh position={[-0.12, 0.3, 0]} castShadow>
                <capsuleGeometry args={[0.095, 0.4, 6, 10]} />
                <meshStandardMaterial color={suit} roughness={0.8} />
            </mesh>
            <mesh position={[0.12, 0.3, 0]} castShadow>
                <capsuleGeometry args={[0.095, 0.4, 6, 10]} />
                <meshStandardMaterial color={suit} roughness={0.8} />
            </mesh>
            {/* Knees */}
            <mesh position={[-0.12, 0.55, 0.01]} castShadow>
                <sphereGeometry args={[0.1, 12, 10]} />
                <meshStandardMaterial color={suit} roughness={0.8} />
            </mesh>
            <mesh position={[0.12, 0.55, 0.01]} castShadow>
                <sphereGeometry args={[0.1, 12, 10]} />
                <meshStandardMaterial color={suit} roughness={0.8} />
            </mesh>
            {/* Thighs */}
            <mesh position={[-0.12, 0.78, 0]} castShadow>
                <capsuleGeometry args={[0.11, 0.4, 6, 10]} />
                <meshStandardMaterial color={suit} roughness={0.8} />
            </mesh>
            <mesh position={[0.12, 0.78, 0]} castShadow>
                <capsuleGeometry args={[0.11, 0.4, 6, 10]} />
                <meshStandardMaterial color={suit} roughness={0.8} />
            </mesh>
            {/* Hip/belt */}
            <mesh position={[0, 1.02, 0]} castShadow>
                <boxGeometry args={[0.5, 0.08, 0.34]} />
                <meshStandardMaterial color="#080808" roughness={0.6} metalness={0.2} />
            </mesh>

            <BreathingTorso seed={seed} rate={0.48} amp={0.012}>
                {/* Jacket */}
                <mesh position={[0, 1.32, 0]} castShadow>
                    <boxGeometry args={[0.56, 0.55, 0.34]} />
                    <meshStandardMaterial color={suit} roughness={0.85} />
                </mesh>
                {/* Jacket shoulders (rounded caps) */}
                <mesh position={[-0.32, 1.5, 0]} castShadow>
                    <sphereGeometry args={[0.13, 14, 10]} />
                    <meshStandardMaterial color={suit} roughness={0.85} />
                </mesh>
                <mesh position={[0.32, 1.5, 0]} castShadow>
                    <sphereGeometry args={[0.13, 14, 10]} />
                    <meshStandardMaterial color={suit} roughness={0.85} />
                </mesh>

                {/* Shirt front (visible strip) */}
                <mesh position={[0, 1.3, 0.172]}>
                    <planeGeometry args={[0.11, 0.5]} />
                    <meshStandardMaterial color={shirt} roughness={0.5} />
                </mesh>

                {/* Lapels - angled dark panels over the jacket front */}
                <mesh position={[-0.095, 1.4, 0.173]} rotation={[0, 0, -0.3]}>
                    <planeGeometry args={[0.13, 0.32]} />
                    <meshStandardMaterial color={suitHL} roughness={0.7} />
                </mesh>
                <mesh position={[0.095, 1.4, 0.173]} rotation={[0, 0, 0.3]}>
                    <planeGeometry args={[0.13, 0.32]} />
                    <meshStandardMaterial color={suitHL} roughness={0.7} />
                </mesh>

                {/* Collar wings */}
                <mesh position={[-0.05, 1.58, 0.17]} rotation={[0, 0, -0.35]}>
                    <planeGeometry args={[0.06, 0.1]} />
                    <meshStandardMaterial color={shirt} roughness={0.5} />
                </mesh>
                <mesh position={[0.05, 1.58, 0.17]} rotation={[0, 0, 0.35]}>
                    <planeGeometry args={[0.06, 0.1]} />
                    <meshStandardMaterial color={shirt} roughness={0.5} />
                </mesh>

                {/* Tie */}
                <mesh position={[0, 1.55, 0.178]}>
                    <planeGeometry args={[0.048, 0.12]} />
                    <meshStandardMaterial color={tieColor} roughness={0.4} metalness={0.1} />
                </mesh>
                <mesh position={[0, 1.35, 0.178]}>
                    <planeGeometry args={[0.07, 0.34]} />
                    <meshStandardMaterial color={tieColor} roughness={0.4} metalness={0.1} />
                </mesh>
                {/* Tie tip */}
                <mesh position={[0, 1.17, 0.178]} rotation={[0, 0, Math.PI / 4]}>
                    <planeGeometry args={[0.05, 0.05]} />
                    <meshStandardMaterial color={tieColor} roughness={0.4} metalness={0.1} />
                </mesh>

                {/* Buttons */}
                {[1.36, 1.22].map((y, i) => (
                    <mesh key={i} position={[0.01, y, 0.181]}>
                        <circleGeometry args={[0.01, 10]} />
                        <meshStandardMaterial
                            color="#0b0b0b"
                            roughness={0.3}
                            metalness={0.3}
                        />
                    </mesh>
                ))}
            </BreathingTorso>

            {/* Arms: upper + forearm + hand */}
            <SuitArm side={-1} suit={suit} skin={skin} />
            <SuitArm side={1} suit={suit} skin={skin} />

            {/* Neck */}
            <mesh position={[0, 1.68, 0]} castShadow>
                <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
                <meshStandardMaterial color={skin} roughness={0.6} />
            </mesh>

            <LivingHead seed={seed} position={[0, 1.86, 0]}>
                {/* Smooth, featureless pale head */}
                <mesh castShadow>
                    <sphereGeometry args={[0.15, 28, 22]} />
                    <meshPhysicalMaterial
                        color={skin}
                        roughness={0.45}
                        clearcoat={0.25}
                        clearcoatRoughness={0.6}
                    />
                </mesh>
                {/* Ultra-faint forehead highlight so light catches the head */}
                <mesh position={[0, 0.03, 0.12]} scale={[0.5, 0.3, 0.1]}>
                    <sphereGeometry args={[0.15, 16, 10]} />
                    <meshBasicMaterial color="#f1eadb" transparent opacity={0.18} />
                </mesh>
            </LivingHead>
        </group>
    );
}

function SuitArm({ side, suit, skin }: { side: 1 | -1; suit: string; skin: string }) {
    return (
        <group>
            {/* Upper arm */}
            <mesh position={[side * 0.34, 1.36, 0]} rotation={[0, 0, side * 0.04]} castShadow>
                <capsuleGeometry args={[0.085, 0.34, 6, 10]} />
                <meshStandardMaterial color={suit} roughness={0.85} />
            </mesh>
            {/* Elbow */}
            <mesh position={[side * 0.36, 1.14, 0]} castShadow>
                <sphereGeometry args={[0.09, 12, 10]} />
                <meshStandardMaterial color={suit} roughness={0.85} />
            </mesh>
            {/* Forearm */}
            <mesh position={[side * 0.37, 0.93, 0]} rotation={[0, 0, side * 0.04]} castShadow>
                <capsuleGeometry args={[0.075, 0.34, 6, 10]} />
                <meshStandardMaterial color={suit} roughness={0.85} />
            </mesh>
            {/* Cuff (shirt sliver) */}
            <mesh position={[side * 0.38, 0.75, 0]}>
                <cylinderGeometry args={[0.076, 0.076, 0.03, 12]} />
                <meshStandardMaterial color="#ebe7d8" roughness={0.6} />
            </mesh>
            {/* Hand */}
            <mesh position={[side * 0.385, 0.7, 0]} castShadow>
                <sphereGeometry args={[0.062, 14, 10]} />
                <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
            {/* Fingers suggested by a small elongated box */}
            <mesh position={[side * 0.385, 0.625, 0.008]} castShadow>
                <boxGeometry args={[0.06, 0.09, 0.025]} />
                <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Slenderman (~2.6m) - impossibly thin tuxedo figure with extended arms and
// a faint halo of back tendrils. Now segmented, properly tailored.
// ---------------------------------------------------------------------------

function Slenderman({ seed }: { seed: number }) {
    const black = '#07070a';
    const blackHL = '#111116';
    const pale = '#ece1ce';
    const shirt = '#f7f3ea';
    const tendrilRefs = useRef<Array<THREE.Mesh | null>>([]);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        for (let i = 0; i < tendrilRefs.current.length; i++) {
            const m = tendrilRefs.current[i];
            if (!m) continue;
            m.rotation.x = 0.25 + Math.sin(t * 0.4 + seed + i * 1.3) * 0.08;
            m.rotation.z = Math.sin(t * 0.35 + seed * 2 + i * 0.9) * 0.12;
        }
    });

    return (
        <group>
            {/* Shoes */}
            <mesh position={[-0.1, 0.04, 0.06]} castShadow>
                <boxGeometry args={[0.09, 0.07, 0.22]} />
                <meshPhysicalMaterial
                    color="#030305"
                    roughness={0.25}
                    clearcoat={0.9}
                    clearcoatRoughness={0.2}
                />
            </mesh>
            <mesh position={[0.1, 0.04, 0.06]} castShadow>
                <boxGeometry args={[0.09, 0.07, 0.22]} />
                <meshPhysicalMaterial
                    color="#030305"
                    roughness={0.25}
                    clearcoat={0.9}
                    clearcoatRoughness={0.2}
                />
            </mesh>

            {/* Shins */}
            <mesh position={[-0.11, 0.4, 0]} castShadow>
                <capsuleGeometry args={[0.048, 0.58, 6, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            <mesh position={[0.11, 0.4, 0]} castShadow>
                <capsuleGeometry args={[0.048, 0.58, 6, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            {/* Knees */}
            <mesh position={[-0.11, 0.78, 0.01]} castShadow>
                <sphereGeometry args={[0.055, 10, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            <mesh position={[0.11, 0.78, 0.01]} castShadow>
                <sphereGeometry args={[0.055, 10, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            {/* Thighs */}
            <mesh position={[-0.11, 1.04, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.54, 6, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            <mesh position={[0.11, 1.04, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.54, 6, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>

            <BreathingTorso seed={seed} rate={0.38} amp={0.008}>
                {/* Slim torso */}
                <mesh position={[0, 1.68, 0]} castShadow>
                    <capsuleGeometry args={[0.14, 0.72, 8, 14]} />
                    <meshStandardMaterial color={black} roughness={0.85} />
                </mesh>
                {/* Shoulders */}
                <mesh position={[-0.23, 2.0, 0]} castShadow>
                    <sphereGeometry args={[0.095, 12, 10]} />
                    <meshStandardMaterial color={black} roughness={0.85} />
                </mesh>
                <mesh position={[0.23, 2.0, 0]} castShadow>
                    <sphereGeometry args={[0.095, 12, 10]} />
                    <meshStandardMaterial color={black} roughness={0.85} />
                </mesh>
                {/* Shirt front */}
                <mesh position={[0, 1.78, 0.14]}>
                    <planeGeometry args={[0.06, 0.4]} />
                    <meshStandardMaterial color={shirt} roughness={0.5} />
                </mesh>
                {/* Lapels */}
                <mesh position={[-0.06, 1.92, 0.141]} rotation={[0, 0, -0.28]}>
                    <planeGeometry args={[0.09, 0.22]} />
                    <meshStandardMaterial color={blackHL} roughness={0.7} />
                </mesh>
                <mesh position={[0.06, 1.92, 0.141]} rotation={[0, 0, 0.28]}>
                    <planeGeometry args={[0.09, 0.22]} />
                    <meshStandardMaterial color={blackHL} roughness={0.7} />
                </mesh>
                {/* Black tie */}
                <mesh position={[0, 1.8, 0.144]}>
                    <planeGeometry args={[0.03, 0.3]} />
                    <meshStandardMaterial color="#050507" roughness={0.3} metalness={0.25} />
                </mesh>
            </BreathingTorso>

            {/* Extra-long segmented arms. Upper, elbow, forearm, hand. */}
            <SlenderArm side={-1} black={black} pale={pale} />
            <SlenderArm side={1} black={black} pale={pale} />

            {/* Neck (unnaturally long) */}
            <mesh position={[0, 2.22, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.055, 0.2, 14]} />
                <meshStandardMaterial color={pale} roughness={0.55} />
            </mesh>

            {/* Tendrils from back */}
            {[0, 1, 2, 3].map((i) => {
                const side = i < 2 ? -1 : 1;
                const y = 1.85 + (i % 2) * 0.18;
                const x = side * (0.12 + (i % 2) * 0.05);
                return (
                    <mesh
                        key={i}
                        ref={(el: THREE.Mesh | null) => {
                            tendrilRefs.current[i] = el;
                        }}
                        position={[x, y, -0.1]}
                    >
                        <capsuleGeometry args={[0.018, 0.9, 4, 6]} />
                        <meshStandardMaterial color={black} roughness={0.95} />
                    </mesh>
                );
            })}

            <LivingHead seed={seed} position={[0, 2.42, 0]}>
                {/* Slightly tall, smooth head */}
                <mesh scale={[0.95, 1.08, 0.95]} castShadow>
                    <sphereGeometry args={[0.17, 28, 22]} />
                    <meshPhysicalMaterial
                        color={pale}
                        roughness={0.4}
                        clearcoat={0.3}
                        clearcoatRoughness={0.5}
                    />
                </mesh>
                {/* Faint dark hollows where features should be */}
                <mesh position={[0, -0.02, 0.15]} scale={[0.8, 0.12, 0.05]}>
                    <sphereGeometry args={[0.15, 18, 10]} />
                    <meshStandardMaterial color="#50463c" transparent opacity={0.28} />
                </mesh>
            </LivingHead>
        </group>
    );
}

function SlenderArm({ side, black, pale }: { side: 1 | -1; black: string; pale: string }) {
    return (
        <group>
            {/* Upper arm */}
            <mesh position={[side * 0.24, 1.72, 0]} rotation={[0, 0, side * 0.03]} castShadow>
                <capsuleGeometry args={[0.038, 0.58, 6, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            {/* Elbow */}
            <mesh position={[side * 0.26, 1.4, 0]} castShadow>
                <sphereGeometry args={[0.045, 12, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            {/* Forearm */}
            <mesh position={[side * 0.27, 1.04, 0]} rotation={[0, 0, side * 0.04]} castShadow>
                <capsuleGeometry args={[0.033, 0.68, 6, 10]} />
                <meshStandardMaterial color={black} roughness={0.85} />
            </mesh>
            {/* Cuff */}
            <mesh position={[side * 0.28, 0.65, 0]}>
                <cylinderGeometry args={[0.034, 0.034, 0.025, 10]} />
                <meshStandardMaterial color="#f4efe4" roughness={0.5} />
            </mesh>
            {/* Long hand */}
            <mesh position={[side * 0.29, 0.55, 0]} castShadow>
                <capsuleGeometry args={[0.028, 0.15, 4, 8]} />
                <meshStandardMaterial color={pale} roughness={0.55} />
            </mesh>
            {/* Fingers */}
            {[-0.01, 0.0, 0.01, 0.02].map((fx, i) => (
                <mesh
                    key={i}
                    position={[side * (0.29 + fx), 0.45, 0]}
                    castShadow
                >
                    <capsuleGeometry args={[0.006, 0.1 + i * 0.01, 4, 6]} />
                    <meshStandardMaterial color={pale} roughness={0.55} />
                </mesh>
            ))}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Observer - cloaked presence with a single glowing eye. Adds layered cloak
// drapes, visible hands peeking from sleeves, and a subtle float.
// ---------------------------------------------------------------------------

function Observer({ seed }: { seed: number }) {
    const cloak = '#0c0a12';
    const cloakDeep = '#040308';
    const glow = '#ffb552';
    const pale = '#d4c7b3';

    const cloakRef = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
        if (!cloakRef.current) return;
        const t = clock.getElapsedTime();
        cloakRef.current.rotation.y = Math.sin(t * 0.2 + seed) * 0.03;
        cloakRef.current.position.y = Math.sin(t * 0.3 + seed) * 0.04;
    });

    return (
        <group ref={cloakRef}>
            {/* Conical main cloak */}
            <mesh position={[0, 1.0, 0]} castShadow>
                <coneGeometry args={[0.6, 2.05, 20, 1, true]} />
                <meshStandardMaterial
                    color={cloak}
                    roughness={0.95}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Second inner drape for layering */}
            <mesh position={[0, 0.92, 0]} rotation={[0, 0.2, 0]}>
                <coneGeometry args={[0.48, 1.85, 16, 1, true]} />
                <meshStandardMaterial
                    color={cloakDeep}
                    roughness={0.95}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Front drape flap */}
            <mesh position={[0, 1.05, 0.1]} rotation={[0.05, 0, 0]}>
                <planeGeometry args={[0.5, 1.9]} />
                <meshStandardMaterial
                    color={cloakDeep}
                    roughness={0.95}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* Sleeves hanging at sides */}
            <mesh position={[-0.4, 1.45, 0]} rotation={[0, 0, 0.2]} castShadow>
                <coneGeometry args={[0.11, 0.55, 10, 1, true]} />
                <meshStandardMaterial
                    color={cloak}
                    roughness={0.95}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <mesh position={[0.4, 1.45, 0]} rotation={[0, 0, -0.2]} castShadow>
                <coneGeometry args={[0.11, 0.55, 10, 1, true]} />
                <meshStandardMaterial
                    color={cloak}
                    roughness={0.95}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Pale hands peeking from sleeves */}
            <mesh position={[-0.43, 1.17, 0.03]} castShadow>
                <sphereGeometry args={[0.045, 12, 10]} />
                <meshStandardMaterial color={pale} roughness={0.6} />
            </mesh>
            <mesh position={[0.43, 1.17, 0.03]} castShadow>
                <sphereGeometry args={[0.045, 12, 10]} />
                <meshStandardMaterial color={pale} roughness={0.6} />
            </mesh>

            {/* Hood: deeper, more enclosing */}
            <group position={[0, 2.04, 0]}>
                <mesh castShadow>
                    <sphereGeometry
                        args={[0.26, 22, 18, 0, Math.PI * 2, 0, Math.PI / 1.4]}
                    />
                    <meshStandardMaterial
                        color={cloak}
                        roughness={0.95}
                        side={THREE.DoubleSide}
                    />
                </mesh>
                {/* Inner hood void - absolute black */}
                <mesh position={[0, -0.02, 0.05]}>
                    <sphereGeometry args={[0.18, 20, 14]} />
                    <meshBasicMaterial color="#000000" />
                </mesh>
            </group>

            {/* The eye */}
            <mesh position={[0, 2.0, 0.18]}>
                <sphereGeometry args={[0.042, 14, 12]} />
                <meshStandardMaterial
                    color={glow}
                    emissive={glow}
                    emissiveIntensity={2.8}
                    roughness={0.2}
                />
            </mesh>
            {/* Eye highlight */}
            <mesh position={[-0.015, 2.015, 0.22]}>
                <sphereGeometry args={[0.008, 8, 6]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
            <pointLight
                position={[0, 2.0, 0.28]}
                color={glow}
                intensity={0.38}
                distance={3.0}
            />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Mothman (~2m) - dark winged cryptid. Better structured wings with ribs,
// clawed hands, glowing red eyes with highlight glints.
// ---------------------------------------------------------------------------

function Mothman({ seed }: { seed: number }) {
    const dark = '#0a0708';
    const darker = '#030102';
    const eye = '#ff2622';
    const wingRefs = useRef<Array<THREE.Group | null>>([]);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        // Wings slowly flex open and closed in a very shallow arc
        const flex = Math.sin(t * 0.5 + seed) * 0.08;
        if (wingRefs.current[0]) wingRefs.current[0].rotation.y = 0.35 + flex;
        if (wingRefs.current[1]) wingRefs.current[1].rotation.y = -0.35 - flex;
    });

    return (
        <group>
            {/* Feet / talons */}
            <mesh position={[-0.11, 0.04, 0.06]} castShadow>
                <boxGeometry args={[0.1, 0.06, 0.18]} />
                <meshStandardMaterial color={darker} roughness={0.9} />
            </mesh>
            <mesh position={[0.11, 0.04, 0.06]} castShadow>
                <boxGeometry args={[0.1, 0.06, 0.18]} />
                <meshStandardMaterial color={darker} roughness={0.9} />
            </mesh>

            {/* Legs - thin, inhuman */}
            <mesh position={[-0.11, 0.35, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.5, 6, 10]} />
                <meshStandardMaterial color={dark} roughness={0.92} />
            </mesh>
            <mesh position={[0.11, 0.35, 0]} castShadow>
                <capsuleGeometry args={[0.06, 0.5, 6, 10]} />
                <meshStandardMaterial color={dark} roughness={0.92} />
            </mesh>

            <BreathingTorso seed={seed} rate={0.52} amp={0.02}>
                {/* Chest */}
                <mesh position={[0, 1.05, 0]} castShadow>
                    <capsuleGeometry args={[0.25, 0.5, 8, 14]} />
                    <meshStandardMaterial color={dark} roughness={0.92} />
                </mesh>
                {/* Abdomen taper */}
                <mesh position={[0, 0.75, 0]} castShadow>
                    <capsuleGeometry args={[0.18, 0.2, 6, 12]} />
                    <meshStandardMaterial color={dark} roughness={0.92} />
                </mesh>
                {/* Feathered chest ruff */}
                {[-0.05, 0, 0.05].map((fx, i) => (
                    <mesh
                        key={i}
                        position={[fx * 2.5, 1.28, 0.22]}
                        rotation={[0.3, 0, 0]}
                    >
                        <coneGeometry args={[0.05, 0.18, 6, 1, true]} />
                        <meshStandardMaterial
                            color={darker}
                            roughness={0.95}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                ))}

                {/* Shoulders */}
                <mesh position={[-0.25, 1.3, 0]} castShadow>
                    <sphereGeometry args={[0.11, 14, 10]} />
                    <meshStandardMaterial color={dark} roughness={0.92} />
                </mesh>
                <mesh position={[0.25, 1.3, 0]} castShadow>
                    <sphereGeometry args={[0.11, 14, 10]} />
                    <meshStandardMaterial color={dark} roughness={0.92} />
                </mesh>
            </BreathingTorso>

            {/* Wings (folded at back) with visible ribs */}
            <group ref={(el) => { wingRefs.current[0] = el; }} position={[-0.3, 1.35, -0.15]}>
                <MothWing side={-1} dark={dark} />
            </group>
            <group ref={(el) => { wingRefs.current[1] = el; }} position={[0.3, 1.35, -0.15]}>
                <MothWing side={1} dark={dark} />
            </group>

            {/* Arms - long, thin, ending in claws */}
            <MothArm side={-1} dark={dark} />
            <MothArm side={1} dark={dark} />

            {/* Neck stub */}
            <mesh position={[0, 1.48, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.09, 0.1, 12]} />
                <meshStandardMaterial color={dark} roughness={0.92} />
            </mesh>

            <LivingHead seed={seed} position={[0, 1.65, 0]}>
                {/* Head - slightly flattened, slightly wider than tall */}
                <mesh scale={[1.15, 1.0, 1.05]} castShadow>
                    <sphereGeometry args={[0.2, 22, 16]} />
                    <meshStandardMaterial color={dark} roughness={0.9} />
                </mesh>
                {/* Big red compound eyes */}
                <mesh position={[-0.09, 0.015, 0.17]}>
                    <sphereGeometry args={[0.065, 16, 12]} />
                    <meshStandardMaterial
                        color={eye}
                        emissive={eye}
                        emissiveIntensity={2.4}
                        roughness={0.2}
                    />
                </mesh>
                <mesh position={[0.09, 0.015, 0.17]}>
                    <sphereGeometry args={[0.065, 16, 12]} />
                    <meshStandardMaterial
                        color={eye}
                        emissive={eye}
                        emissiveIntensity={2.4}
                        roughness={0.2}
                    />
                </mesh>
                {/* Eye highlights */}
                <mesh position={[-0.075, 0.03, 0.225]}>
                    <sphereGeometry args={[0.01, 8, 6]} />
                    <meshBasicMaterial color="#ffd8c8" />
                </mesh>
                <mesh position={[0.105, 0.03, 0.225]}>
                    <sphereGeometry args={[0.01, 8, 6]} />
                    <meshBasicMaterial color="#ffd8c8" />
                </mesh>
                {/* Small antennae */}
                <mesh
                    position={[-0.06, 0.18, 0.08]}
                    rotation={[0.3, 0, -0.2]}
                    castShadow
                >
                    <capsuleGeometry args={[0.006, 0.16, 4, 6]} />
                    <meshStandardMaterial color={darker} roughness={0.95} />
                </mesh>
                <mesh
                    position={[0.06, 0.18, 0.08]}
                    rotation={[0.3, 0, 0.2]}
                    castShadow
                >
                    <capsuleGeometry args={[0.006, 0.16, 4, 6]} />
                    <meshStandardMaterial color={darker} roughness={0.95} />
                </mesh>
            </LivingHead>
            <pointLight
                position={[0, 1.67, 0.32]}
                color={eye}
                intensity={0.32}
                distance={2.6}
            />
        </group>
    );
}

function MothWing({ side, dark }: { side: 1 | -1; dark: string }) {
    return (
        <group rotation={[0, 0, side * 0.18]}>
            {/* Main membrane */}
            <mesh castShadow>
                <planeGeometry args={[1.0, 1.6]} />
                <meshStandardMaterial
                    color={dark}
                    roughness={0.97}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.88}
                />
            </mesh>
            {/* Ribs - thin lines radiating from shoulder point */}
            {[-0.35, -0.15, 0.05, 0.25, 0.45].map((rib, i) => (
                <mesh
                    key={i}
                    position={[side * rib * 0.6, 0, 0.002]}
                    rotation={[0, 0, side * (0.05 + i * 0.04)]}
                >
                    <planeGeometry args={[0.012, 1.4]} />
                    <meshStandardMaterial
                        color="#1d1318"
                        roughness={0.9}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}
            {/* Secondary smaller wing tucked under main one */}
            <mesh position={[side * 0.1, -0.3, -0.03]} rotation={[0, 0, side * 0.25]}>
                <planeGeometry args={[0.55, 0.9]} />
                <meshStandardMaterial
                    color="#0a0405"
                    roughness={0.97}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.8}
                />
            </mesh>
        </group>
    );
}

function MothArm({ side, dark }: { side: 1 | -1; dark: string }) {
    return (
        <group>
            {/* Upper arm */}
            <mesh position={[side * 0.27, 1.14, 0]} rotation={[0, 0, side * 0.12]} castShadow>
                <capsuleGeometry args={[0.05, 0.36, 6, 10]} />
                <meshStandardMaterial color={dark} roughness={0.92} />
            </mesh>
            {/* Forearm */}
            <mesh position={[side * 0.3, 0.84, 0]} rotation={[0, 0, side * 0.1]} castShadow>
                <capsuleGeometry args={[0.042, 0.36, 6, 10]} />
                <meshStandardMaterial color={dark} roughness={0.92} />
            </mesh>
            {/* Clawed hand: three long curved talons */}
            <group position={[side * 0.32, 0.6, 0]}>
                {[-0.02, 0, 0.02].map((fx, i) => (
                    <mesh
                        key={i}
                        position={[side * fx, -0.04, 0]}
                        rotation={[0.35, 0, side * (0.08 + i * 0.04)]}
                        castShadow
                    >
                        <coneGeometry args={[0.011, 0.14, 6]} />
                        <meshStandardMaterial color="#050305" roughness={0.9} metalness={0.1} />
                    </mesh>
                ))}
            </group>
        </group>
    );
}
