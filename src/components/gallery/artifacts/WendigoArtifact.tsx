'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';

// -----------------------------------------------------------------------------
// Room 6 centerpiece: an articulated, ten-foot antlered wendigo skeleton.
//
// This is a port of the Wendigo Skeleton generator script (meant for Blender)
// into procedural Three.js geometry so it renders directly in the browser with
// no asset pipeline. The same CONFIG values - total height, vertebra counts,
// rib flare, limb ratios, antler tines, pose angles - drive the same
// proportions; the only thing that changes is the target API (R3F meshes
// instead of bmesh).
//
// The skeleton stands upright on the plinth with a slight forward hunch,
// head jutted forward, arms hanging out to the sides with claws exposed,
// and digitigrade legs with bent knees. Everything is built from tapered
// cylinders (diaphysis), squashed spheres (joints / vertebral bodies), and
// cubic-Bezier-sampled rib tubes. The antlers branch procedurally from a
// seed derived from the room index so every visit draws the same rack.
// -----------------------------------------------------------------------------

// === CONFIG (mirrors wendigo_skeleton.py) ===================================
const CONFIG = {
    total_height: 3.048,
    // Tall, elk-sized rack. heightAdd = H * antler_height_ratio is the
    // vertical reach of each antler from its pedicle; ~0.85m reads as
    // a mature bull's trophy.
    antler_height_ratio: 0.28,

    bone_segments: 10,

    // Six points per side (brow, bez, trez, royal, surroyal, terminal
    // fork) - the classic North American elk silhouette.
    antler_tines_per_side: 6,
    antler_spread: 1.2,
    antler_curve_forward: 0.28,
    // Less taper so the beam stays thick up into the upper third, then
    // narrows to the forking tip. Combined with the doubled base radius
    // this is what gives the rack its heavy, mature-bull weight.
    antler_taper: 0.5,

    cervical_vertebrae: 7,
    thoracic_vertebrae: 12,
    lumbar_vertebrae: 5,
    rib_pairs: 12,
    rib_flare: 0.26,

    upper_arm_ratio: 0.20,
    lower_arm_ratio: 0.22,
    hand_ratio: 0.12,
    upper_leg_ratio: 0.20,
    lower_leg_ratio: 0.22,
    metatarsal_ratio: 0.09,
    toe_ratio: 0.05,

    finger_count: 5,
    finger_segments: 3,
    claw_length_ratio: 0.6,
    toe_count: 3,

    spine_forward_lean: 0.15,
    neck_forward_angle: 0.22,
    arm_outward_angle: 0.42,
    arm_downward_angle: 0.18,
    knee_bend_angle: 0.28,
    shoulder_elevation: 0.10,
};

// Convenience - total height
const H = CONFIG.total_height;
const SEG = CONFIG.bone_segments;

// Deterministic PRNG seeded by the room index (port of mulberry32).
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// === Shared materials =======================================================
// Warm off-white ivory, matching the Blender material config. We share the
// same material instance across every bone so Three.js batches them well.
function useBoneMaterials() {
    return useMemo(() => {
        const bone = new THREE.MeshStandardMaterial({
            color: '#d6cbac',
            roughness: 0.82,
            metalness: 0.04,
        });
        const boneDark = new THREE.MeshStandardMaterial({
            color: '#a89a78',
            roughness: 0.9,
            metalness: 0.02,
        });
        const claw = new THREE.MeshStandardMaterial({
            color: '#1a1612',
            roughness: 0.55,
            metalness: 0.25,
        });
        const teeth = new THREE.MeshStandardMaterial({
            color: '#e8dec2',
            roughness: 0.4,
            metalness: 0.15,
        });
        return { bone, boneDark, claw, teeth };
    }, []);
}

type Materials = ReturnType<typeof useBoneMaterials>;

// === Primitives =============================================================

// A tapered bone shaft (diaphysis) with epiphysis caps. Oriented along +Y
// by default; callers rotate the group to aim it wherever it needs to go.
function Bone({
    length,
    baseRadius,
    tipRadius,
    mat,
}: {
    length: number;
    baseRadius: number;
    tipRadius: number;
    mat: THREE.Material;
}) {
    return (
        <group>
            {/* Shaft: slight mid-shaft narrowing is handled by using
                max(base, tip) * 0.85 at the ends via the CylinderGeometry's
                taper. Close enough for a statue at spot-light distance. */}
            <mesh position={[0, length / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry
                    args={[tipRadius * 0.95, baseRadius * 0.95, length, SEG, 1]}
                />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Epiphysis caps (joint bulges) */}
            <mesh position={[0, 0, 0]} castShadow>
                <sphereGeometry args={[baseRadius * 1.35, SEG, SEG / 2]} />
                <primitive attach="material" object={mat} />
            </mesh>
            <mesh position={[0, length, 0]} castShadow>
                <sphereGeometry args={[tipRadius * 1.35, SEG, SEG / 2]} />
                <primitive attach="material" object={mat} />
            </mesh>
        </group>
    );
}

// A squashed sphere used for vertebral bodies.
function Vertebra({
    radius,
    flatten = 0.55,
    mat,
    y,
    forwardOffset = 0,
}: {
    radius: number;
    flatten?: number;
    mat: THREE.Material;
    y: number;
    forwardOffset?: number;
}) {
    return (
        <group position={[0, y, forwardOffset]}>
            <mesh castShadow>
                <sphereGeometry args={[radius, SEG, SEG / 2]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Spinous process - a little bony fin pointing back */}
            <mesh position={[0, 0, -radius * 1.2]} scale={[0.3, 0.5, 1.2]} castShadow>
                <boxGeometry args={[radius * 0.8, radius * 1.2, radius * 0.9]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* The flatten is applied by scaling the group Y; we do it in
                the caller so nested transforms stay pose-friendly. */}
            <primitive object={new THREE.Object3D()} scale={[1, flatten, 1]} />
        </group>
    );
}

// Sampled rib rendered as a TubeGeometry along a quadratic Bezier. Matches
// the Blender make_curved_rib helper.
function Rib({
    start,
    flare,
    end,
    radius,
    mat,
}: {
    start: THREE.Vector3;
    flare: THREE.Vector3;
    end: THREE.Vector3;
    radius: number;
    mat: THREE.Material;
}) {
    const geometry = useMemo(() => {
        const curve = new THREE.QuadraticBezierCurve3(start, flare, end);
        return new THREE.TubeGeometry(curve, 24, radius, 8, false);
    }, [start, flare, end, radius]);
    return (
        <mesh geometry={geometry} castShadow receiveShadow>
            <primitive attach="material" object={mat} />
        </mesh>
    );
}

// A single antler branch drawn as a tapered TubeGeometry along a curve.
function AntlerBranch({
    curve,
    baseRadius,
    mat,
}: {
    curve: THREE.CatmullRomCurve3;
    baseRadius: number;
    mat: THREE.Material;
}) {
    const geometry = useMemo(() => {
        // Build the tube with a taper by post-scaling along the length.
        // TubeGeometry uses a constant radius, so to get a taper we fake it
        // via a custom geometry: sample N rings along the curve and lerp
        // the radius from base down to tip.
        const samples = 32;
        const ringSegs = 8;
        const positions: number[] = [];
        const indices: number[] = [];
        const frame = new THREE.Vector3();
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const p = curve.getPointAt(t);
            const tan = curve.getTangentAt(t).normalize();
            // Pick any vector not parallel to tangent, build a local frame.
            const up = Math.abs(tan.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
            const right = new THREE.Vector3().crossVectors(tan, up).normalize();
            const up2 = new THREE.Vector3().crossVectors(right, tan).normalize();
            const r = baseRadius * (1 - t * (1 - CONFIG.antler_taper));
            for (let s = 0; s < ringSegs; s++) {
                const a = (s / ringSegs) * Math.PI * 2;
                frame.copy(right).multiplyScalar(Math.cos(a) * r)
                    .addScaledVector(up2, Math.sin(a) * r);
                positions.push(p.x + frame.x, p.y + frame.y, p.z + frame.z);
            }
        }
        for (let i = 0; i < samples; i++) {
            for (let s = 0; s < ringSegs; s++) {
                const a = i * ringSegs + s;
                const b = i * ringSegs + ((s + 1) % ringSegs);
                const c = (i + 1) * ringSegs + ((s + 1) % ringSegs);
                const d = (i + 1) * ringSegs + s;
                indices.push(a, b, c, a, c, d);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }, [curve, baseRadius]);

    return (
        <mesh geometry={geometry} castShadow receiveShadow>
            <primitive attach="material" object={mat} />
        </mesh>
    );
}

// Entire antler rack (one side), rooted at the given origin and curving up
// and outward by `side` ∈ {-1, +1}. Tines branch off the main beam at
// evenly-spaced parameters, each spraying further out the same side.
function Antler({
    origin,
    side,
    mat,
    rng,
}: {
    origin: THREE.Vector3;
    side: number;
    mat: THREE.Material;
    rng: () => number;
}) {
    // Main beam curve. Elk-style s-sweep: rises nearly vertical, dips
    // slightly rearward at the pedicle, then sweeps up-out-forward so
    // the tip finishes well ahead of the skull. The curve is sampled
    // from five control points and produces the heavy arc you see on a
    // mature bull.
    const mainCurve = useMemo(() => {
        const spread = CONFIG.antler_spread;
        const forward = CONFIG.antler_curve_forward;
        const heightAdd = H * CONFIG.antler_height_ratio;
        const pts = [
            origin.clone(),
            origin.clone().add(
                new THREE.Vector3(side * spread * 0.08, heightAdd * 0.28, -forward * 0.18),
            ),
            origin.clone().add(
                new THREE.Vector3(side * spread * 0.32, heightAdd * 0.6, forward * 0.12),
            ),
            origin.clone().add(
                new THREE.Vector3(side * spread * 0.72, heightAdd * 0.92, forward * 0.62),
            ),
            origin.clone().add(
                new THREE.Vector3(side * spread * 1.0, heightAdd * 1.18, forward * 1.0),
            ),
        ];
        return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    }, [origin, side]);

    // Tines branch off the main beam. Elk tines project mostly FORWARD
    // from the beam with a slight outward and upward bias; each is long
    // and heavy near the base (brow, bez, trez) and shorter near the
    // top. Length / jitter are seeded so each room's rack is stable.
    const tines = useMemo(() => {
        const count = CONFIG.antler_tines_per_side;
        const out: {
            curve: THREE.CatmullRomCurve3;
            baseRadius: number;
        }[] = [];
        for (let i = 0; i < count; i++) {
            // Spread tines from low on the beam (brow, right above the
            // pedicle) up to near the tip for the terminal fork.
            const t = 0.1 + (i / count) * 0.82;
            const rootP = mainCurve.getPointAt(t);
            // Forward-biased direction: mostly +Z with a slight outward
            // lean and small upward rise, so tines look like a row of
            // prongs fanning forward off the beam rather than spraying
            // sideways like a moose paddle.
            const jitter = (rng() - 0.5) * 0.22;
            const dir = new THREE.Vector3(
                side * (0.22 + jitter * 0.5),
                0.18 + (1 - t) * 0.15, // brow tines rise more sharply
                0.92,
            ).normalize();
            // Bigger rack overall: base tines reach ~0.42m, upper tines
            // ~0.22m. First two tines (brow + bez) get an extra bump so
            // they look like the forward-pointing "eye guards" that elk
            // are famous for.
            const lenScale =
                (i === 0 ? 1.15 : i === 1 ? 1.05 : 0.85) *
                (0.55 + (1 - t) * 0.55 * (0.8 + rng() * 0.45));
            const tineLen = H * 0.2 * lenScale;
            const tip = rootP.clone().addScaledVector(dir, tineLen);
            // Slight upward arc for every tine so they curve skyward as
            // they reach forward.
            const mid = rootP
                .clone()
                .lerp(tip, 0.55)
                .addScaledVector(new THREE.Vector3(0, 1, 0), tineLen * 0.22);
            const curve = new THREE.CatmullRomCurve3(
                [rootP, mid, tip],
                false,
                'catmullrom',
                0.35,
            );
            // Tines are noticeably chunkier than before; brow tine is
            // the thickest to match its real-world prominence.
            const tineBase = 0.042 * (i === 0 ? 1.1 : 0.9 + (1 - t) * 0.4);
            out.push({ curve, baseRadius: tineBase });
        }
        return out;
    }, [mainCurve, side, rng]);

    return (
        <group>
            {/* Pedicle / burr: a thick ring where the beam attaches to
                the skull. Sells the weight of the rack. */}
            <mesh position={origin} castShadow>
                <sphereGeometry args={[0.062, 14, 10]} />
                <primitive attach="material" object={mat} />
            </mesh>
            <AntlerBranch curve={mainCurve} baseRadius={0.078} mat={mat} />
            {tines.map((t, i) => (
                <AntlerBranch key={i} curve={t.curve} baseRadius={t.baseRadius} mat={mat} />
            ))}
        </group>
    );
}

// Skull: deformed sphere for the cranium, a two-segment tapered cow-like
// snout with a rounded muzzle, a matching long lower jaw, and a row of
// tooth cones at the snout tip. Origin is at the base of the skull
// (occipital condyle). The skull orients forward along +Z.
function Skull({ mat, teethMat }: { mat: THREE.Material; teethMat: THREE.Material }) {
    const skullR = 0.18;
    // Long ungulate snout geometry. The snout is modelled as two
    // stacked tapered cylinders laid along +Z: a thicker "back"
    // section where it attaches to the cranium, and a narrower "front"
    // section that runs out to the muzzle. Total snout length is about
    // 2.3x cranium radius so the skull reads as clearly bovine rather
    // than humanoid.
    const snoutStartZ = skullR * 0.55; // where snout attaches to cranium
    const snoutBackLen = skullR * 1.1;
    const snoutFrontLen = skullR * 1.2;
    const snoutY = skullR * 0.78; // centreline of the muzzle
    const snoutBackCenterZ = snoutStartZ + snoutBackLen / 2;
    const snoutFrontCenterZ = snoutStartZ + snoutBackLen + snoutFrontLen / 2;
    const muzzleTipZ = snoutStartZ + snoutBackLen + snoutFrontLen;
    // Three incisor-like cones across the front of the upper muzzle.
    const teeth = useMemo(
        () =>
            Array.from({ length: 4 }, (_, i) => ({
                x: (i - 1.5) * 0.026,
                i,
            })),
        [],
    );
    return (
        <group>
            {/* Cranium - elongated sphere */}
            <mesh position={[0, skullR, 0]} scale={[1, 1.1, 1.15]} castShadow>
                <sphereGeometry args={[skullR, 18, 14]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Brow ridge - sits above the eye sockets and is where the
                antler pedicles emerge from. */}
            <mesh position={[0, skullR * 1.4, skullR * 0.45]} castShadow>
                <boxGeometry args={[skullR * 1.55, skullR * 0.2, skullR * 0.4]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Eye sockets - deep-set dark spheres at the base of the
                cranium, just behind where the snout starts. */}
            <mesh position={[-skullR * 0.42, skullR * 1.05, skullR * 0.6]}>
                <sphereGeometry args={[skullR * 0.2, 10, 8]} />
                <meshStandardMaterial color="#050505" roughness={0.9} />
            </mesh>
            <mesh position={[skullR * 0.42, skullR * 1.05, skullR * 0.6]}>
                <sphereGeometry args={[skullR * 0.2, 10, 8]} />
                <meshStandardMaterial color="#050505" roughness={0.9} />
            </mesh>

            {/* --- Upper snout: two tapered cylinders along +Z -------- */}
            {/* Back section: wider end against the cranium, narrower at
                the midpoint transition. */}
            <mesh
                position={[0, snoutY, snoutBackCenterZ]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry
                    args={[skullR * 0.6, skullR * 0.78, snoutBackLen, 18, 1]}
                />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Front section: tapers further toward the muzzle tip. */}
            <mesh
                position={[0, snoutY, snoutFrontCenterZ]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry
                    args={[skullR * 0.46, skullR * 0.6, snoutFrontLen, 16, 1]}
                />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Rounded muzzle cap so the nose isn't a flat disc. */}
            <mesh position={[0, snoutY, muzzleTipZ]} castShadow>
                <sphereGeometry args={[skullR * 0.46, 14, 10]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Dorsal nasal ridge - a slight raised spine along the top
                of the snout that reads as skeletal when lit from above. */}
            <mesh
                position={[0, snoutY + skullR * 0.38, snoutBackCenterZ + snoutFrontLen * 0.25]}
                castShadow
            >
                <boxGeometry args={[skullR * 0.22, skullR * 0.1, snoutBackLen + snoutFrontLen * 0.6]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Nasal cavity - the iconic dark heart-shaped hollow at
                the front of a cow skull. Built from two offset dark
                spheres so it reads as a split opening, not a round
                nostril. */}
            <mesh position={[-skullR * 0.16, snoutY + skullR * 0.08, muzzleTipZ - skullR * 0.22]}>
                <sphereGeometry args={[skullR * 0.16, 10, 8]} />
                <meshStandardMaterial color="#070504" roughness={0.95} />
            </mesh>
            <mesh position={[skullR * 0.16, snoutY + skullR * 0.08, muzzleTipZ - skullR * 0.22]}>
                <sphereGeometry args={[skullR * 0.16, 10, 8]} />
                <meshStandardMaterial color="#070504" roughness={0.95} />
            </mesh>

            {/* --- Lower jaw: matches the upper snout length -------- */}
            <group
                position={[0, skullR * 0.4, snoutStartZ * 0.6]}
                rotation={[0.05, 0, 0]}
            >
                {/* Jaw bar running along +Z, tapered to match the snout. */}
                <mesh
                    position={[0, 0, (snoutBackLen + snoutFrontLen) / 2]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <cylinderGeometry
                        args={[
                            skullR * 0.38,
                            skullR * 0.55,
                            snoutBackLen + snoutFrontLen,
                            14,
                            1,
                        ]}
                    />
                    <primitive attach="material" object={mat} />
                </mesh>
                {/* Chin cap */}
                <mesh
                    position={[0, 0, snoutBackLen + snoutFrontLen]}
                    castShadow
                >
                    <sphereGeometry args={[skullR * 0.38, 12, 10]} />
                    <primitive attach="material" object={mat} />
                </mesh>
            </group>

            {/* Teeth: a small row of incisor cones at the muzzle tip
                (cows have no upper incisors - these are the lower
                incisors poking up past the jawline). */}
            {teeth.map(({ x, i }) => (
                <mesh
                    key={i}
                    position={[x, snoutY - skullR * 0.28, muzzleTipZ - skullR * 0.05]}
                    rotation={[Math.PI, 0, 0]}
                    castShadow
                >
                    <coneGeometry args={[0.009, 0.055, 6]} />
                    <primitive attach="material" object={teethMat} />
                </mesh>
            ))}
        </group>
    );
}

// One hand with five clawed fingers. Root origin is the wrist; fingers
// splay along +Z (forward of the body).
function Hand({ mat, clawMat, length }: { mat: THREE.Material; clawMat: THREE.Material; length: number }) {
    const palmLen = length * 0.35;
    const fingerLen = length * 0.65;
    const fingerCount = CONFIG.finger_count;
    const segs = CONFIG.finger_segments;
    return (
        <group>
            {/* Palm: short flattened slab */}
            <mesh position={[0, 0, palmLen / 2]} castShadow>
                <boxGeometry args={[length * 0.4, length * 0.1, palmLen]} />
                <primitive attach="material" object={mat} />
            </mesh>
            {/* Fingers spreading from the far edge of the palm */}
            {Array.from({ length: fingerCount }).map((_, i) => {
                const fx = (i - (fingerCount - 1) / 2) * length * 0.11;
                // Thumb (index 0) is offset sideways and angled back.
                const isThumb = i === 0;
                const rootZ = palmLen + length * 0.02;
                const splay = (i - (fingerCount - 1) / 2) * 0.1;
                const segLen = fingerLen / segs;
                return (
                    <group
                        key={i}
                        position={[isThumb ? -length * 0.22 : fx, 0, isThumb ? palmLen * 0.5 : rootZ]}
                        rotation={[0, isThumb ? -0.8 : splay, 0]}
                    >
                        {/* Each phalanx is a short tapered cylinder */}
                        {Array.from({ length: segs }).map((__, s) => {
                            const r = length * 0.024 * (1 - s * 0.2);
                            return (
                                <group
                                    key={s}
                                    position={[0, 0, s * segLen]}
                                    rotation={[-0.05 - s * 0.06, 0, 0]}
                                >
                                    <mesh
                                        position={[0, 0, segLen / 2]}
                                        rotation={[Math.PI / 2, 0, 0]}
                                        castShadow
                                    >
                                        <cylinderGeometry args={[r * 0.85, r, segLen, 8]} />
                                        <primitive attach="material" object={mat} />
                                    </mesh>
                                    {/* Knuckle bulge */}
                                    <mesh castShadow>
                                        <sphereGeometry args={[r * 1.2, 8, 6]} />
                                        <primitive attach="material" object={mat} />
                                    </mesh>
                                </group>
                            );
                        })}
                        {/* Claw at the tip */}
                        <mesh
                            position={[0, 0, fingerLen + length * 0.04]}
                            rotation={[-0.25, 0, 0]}
                            castShadow
                        >
                            <coneGeometry
                                args={[length * 0.02, fingerLen * CONFIG.claw_length_ratio, 8]}
                            />
                            <primitive attach="material" object={clawMat} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

// Digitigrade foot: toes splayed forward, metatarsal rising to the ankle.
function Foot({ mat, clawMat, length }: { mat: THREE.Material; clawMat: THREE.Material; length: number }) {
    const toeCount = CONFIG.toe_count;
    return (
        <group>
            {/* Toe pads fanning forward */}
            {Array.from({ length: toeCount }).map((_, i) => {
                const splay = (i - (toeCount - 1) / 2) * 0.35;
                return (
                    <group key={i} rotation={[0, splay, 0]}>
                        <mesh position={[0, 0, length * 0.5]} castShadow>
                            <cylinderGeometry
                                args={[length * 0.05, length * 0.06, length, 8]}
                            />
                            <primitive attach="material" object={mat} />
                        </mesh>
                        <mesh
                            position={[0, 0, length + length * 0.2]}
                            rotation={[-0.4, 0, 0]}
                            castShadow
                        >
                            <coneGeometry
                                args={[length * 0.06, length * 0.55, 8]}
                            />
                            <primitive attach="material" object={clawMat} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

// === The skeleton ===========================================================
function Skeleton({ seed }: { seed: number }) {
    const mats = useBoneMaterials();
    const rng = useMemo(() => mulberry32(seed), [seed]);
    return (
        <>
            <Legs mats={mats} />
            <Pelvis mats={mats} />
            <Spine mats={mats} />
            <Ribcage mats={mats} />
            <ArmsAndShoulders mats={mats} />
            <NeckAndSkull mats={mats} rng={rng} />
        </>
    );
}

// All spinal layout is centralised here so every part can compute its
// attachment heights from the same anatomy table.
function anatomy() {
    // Leg heights
    const footH = H * CONFIG.metatarsal_ratio * 0.45; // rise from ground to ankle
    const tibiaL = H * CONFIG.lower_leg_ratio;
    const femurL = H * CONFIG.upper_leg_ratio;
    const hipY = footH + tibiaL * 0.92 + femurL * 0.95;

    const pelvisTop = hipY + 0.09;
    const lumbarStart = pelvisTop + 0.02;
    const lumbarPer = 0.055;
    const lumbarEnd = lumbarStart + CONFIG.lumbar_vertebrae * lumbarPer;

    const thoracicStart = lumbarEnd;
    const thoracicPer = 0.052;
    const thoracicEnd = thoracicStart + CONFIG.thoracic_vertebrae * thoracicPer;

    const cervicalStart = thoracicEnd + 0.05;
    const cervicalPer = 0.042;
    const cervicalEnd = cervicalStart + CONFIG.cervical_vertebrae * cervicalPer;

    const skullBase = cervicalEnd + 0.02;

    return {
        footH,
        tibiaL,
        femurL,
        hipY,
        pelvisTop,
        lumbarStart,
        lumbarPer,
        lumbarEnd,
        thoracicStart,
        thoracicPer,
        thoracicEnd,
        cervicalStart,
        cervicalPer,
        cervicalEnd,
        skullBase,
    };
}

function Legs({ mats }: { mats: Materials }) {
    const a = anatomy();
    const hipHalf = 0.16;
    const knee = CONFIG.knee_bend_angle;
    return (
        <>
            {[-1, 1].map((side) => (
                <group key={side} position={[side * hipHalf, 0, 0]}>
                    {/* Foot (digitigrade plant) */}
                    <group position={[0, 0, 0.05]}>
                        <Foot mat={mats.bone} clawMat={mats.claw} length={0.16} />
                    </group>
                    {/* Metatarsal (rises slanted from toes to ankle) */}
                    <mesh
                        position={[0, a.footH / 2, 0.02]}
                        rotation={[-0.45, 0, 0]}
                        castShadow
                    >
                        <cylinderGeometry
                            args={[0.022, 0.03, a.footH + 0.08, 10]}
                        />
                        <primitive attach="material" object={mats.bone} />
                    </mesh>
                    {/* Tibia - leans slightly forward for digitigrade knee bend */}
                    <group position={[0, a.footH, 0]} rotation={[-knee * 0.45, 0, 0]}>
                        <Bone
                            length={a.tibiaL}
                            baseRadius={0.036}
                            tipRadius={0.028}
                            mat={mats.bone}
                        />
                        {/* Femur - tilts back at the knee to complete the digitigrade Z */}
                        <group
                            position={[0, a.tibiaL, 0]}
                            rotation={[knee, 0, 0]}
                        >
                            <Bone
                                length={a.femurL}
                                baseRadius={0.042}
                                tipRadius={0.034}
                                mat={mats.bone}
                            />
                            {/* Patella (kneecap) */}
                            <mesh position={[0, 0.04, 0.04]} castShadow>
                                <sphereGeometry args={[0.028, 10, 8]} />
                                <primitive attach="material" object={mats.bone} />
                            </mesh>
                        </group>
                    </group>
                </group>
            ))}
        </>
    );
}

function Pelvis({ mats }: { mats: Materials }) {
    const a = anatomy();
    return (
        <group position={[0, a.hipY, 0]}>
            {/* Iliac bowl - wide, scooped slab */}
            <mesh scale={[1, 0.55, 1]} castShadow>
                <sphereGeometry args={[0.22, 16, 12]} />
                <primitive attach="material" object={mats.bone} />
            </mesh>
            {/* Sacrum wedge on the back */}
            <mesh position={[0, 0.02, -0.1]} castShadow>
                <boxGeometry args={[0.14, 0.14, 0.1]} />
                <primitive attach="material" object={mats.bone} />
            </mesh>
        </group>
    );
}

function Spine({ mats }: { mats: Materials }) {
    const a = anatomy();
    // Lumbar + thoracic + cervical verts. The forwardOffset applies a soft
    // anterior curve so the column isn't a straight rod.
    const vertebrae: { y: number; r: number; fwd: number }[] = [];
    for (let i = 0; i < CONFIG.lumbar_vertebrae; i++) {
        const t = i / Math.max(1, CONFIG.lumbar_vertebrae - 1);
        vertebrae.push({
            y: a.lumbarStart + i * a.lumbarPer,
            r: 0.062 - t * 0.006,
            fwd: 0.02 * Math.sin(t * Math.PI),
        });
    }
    for (let i = 0; i < CONFIG.thoracic_vertebrae; i++) {
        const t = i / Math.max(1, CONFIG.thoracic_vertebrae - 1);
        vertebrae.push({
            y: a.thoracicStart + i * a.thoracicPer,
            r: 0.055 - t * 0.006,
            fwd: -0.02 * Math.sin(t * Math.PI),
        });
    }
    for (let i = 0; i < CONFIG.cervical_vertebrae; i++) {
        const t = i / Math.max(1, CONFIG.cervical_vertebrae - 1);
        vertebrae.push({
            y: a.cervicalStart + i * a.cervicalPer,
            r: 0.044 - t * 0.008,
            fwd: 0.04 * t + 0.02,
        });
    }
    return (
        <group rotation={[CONFIG.spine_forward_lean * 0.2, 0, 0]}>
            {vertebrae.map((v, i) => (
                <Vertebra
                    key={i}
                    y={v.y}
                    radius={v.r}
                    forwardOffset={v.fwd}
                    mat={mats.bone}
                />
            ))}
        </group>
    );
}

function Ribcage({ mats }: { mats: Materials }) {
    const a = anatomy();
    const pairs = CONFIG.rib_pairs;
    const flare = CONFIG.rib_flare;
    // Sternum: a vertical strip in front of the ribcage
    const sternumY = a.thoracicStart + (a.thoracicEnd - a.thoracicStart) * 0.55;
    const sternumLen = (a.thoracicEnd - a.thoracicStart) * 0.7;
    return (
        <group>
            {/* Sternum */}
            <mesh position={[0, sternumY, 0.18]} castShadow>
                <boxGeometry args={[0.04, sternumLen, 0.02]} />
                <primitive attach="material" object={mats.bone} />
            </mesh>
            {Array.from({ length: pairs }).map((_, i) => {
                const t = i / (pairs - 1);
                const y = a.thoracicStart + i * a.thoracicPer + 0.01;
                // Flare peaks around the middle pairs and pinches at both ends.
                const localFlare = flare * (0.4 + 0.85 * Math.sin(t * Math.PI));
                // Ribs tip slightly downward as they go out.
                const forwardReach = 0.2 + (1 - t) * 0.05;
                const endY = y - localFlare * 0.35;
                return (
                    <group key={i}>
                        {[-1, 1].map((side) => (
                            <Rib
                                key={side}
                                start={new THREE.Vector3(0, y, -0.04)}
                                flare={
                                    new THREE.Vector3(
                                        side * localFlare,
                                        y + 0.04 * (1 - t),
                                        0.05,
                                    )
                                }
                                end={new THREE.Vector3(side * 0.03, endY, forwardReach)}
                                radius={0.012 - t * 0.003}
                                mat={mats.bone}
                            />
                        ))}
                    </group>
                );
            })}
        </group>
    );
}

function ArmsAndShoulders({ mats }: { mats: Materials }) {
    const a = anatomy();
    const shoulderY = a.thoracicStart + CONFIG.thoracic_vertebrae * CONFIG.thoracic_vertebrae * 0; // placeholder
    // Shoulders sit at the top of the ribcage, lifted by shoulder_elevation.
    const topThoracic = a.thoracicEnd - 0.04 + CONFIG.shoulder_elevation;
    const shoulderHalf = 0.28;
    const upperArmL = H * CONFIG.upper_arm_ratio;
    const lowerArmL = H * CONFIG.lower_arm_ratio;
    const handL = H * CONFIG.hand_ratio;
    void shoulderY;
    return (
        <group>
            {/* Clavicles: thin horizontal struts that join the shoulders to the sternum */}
            {[-1, 1].map((side) => (
                <mesh
                    key={`clav-${side}`}
                    position={[side * shoulderHalf * 0.55, topThoracic - 0.05, 0.12]}
                    rotation={[0, side * 0.2, side * 0.4]}
                    castShadow
                >
                    <cylinderGeometry args={[0.012, 0.012, shoulderHalf * 0.9, 8]} />
                    <primitive attach="material" object={mats.bone} />
                </mesh>
            ))}

            {/* Arms. The humerus aims outward (abduction) and slightly forward;
                the forearm hangs nearly straight down with a soft elbow bend. */}
            {[-1, 1].map((side) => (
                <group
                    key={`arm-${side}`}
                    position={[side * shoulderHalf, topThoracic, 0]}
                >
                    {/* Scapular bulge / shoulder joint */}
                    <mesh castShadow>
                        <sphereGeometry args={[0.07, 12, 10]} />
                        <primitive attach="material" object={mats.bone} />
                    </mesh>
                    {/* Humerus, oriented down with arm_outward_angle sweep */}
                    <group
                        rotation={[
                            CONFIG.arm_downward_angle,
                            0,
                            side * (Math.PI + CONFIG.arm_outward_angle),
                        ]}
                    >
                        <Bone
                            length={upperArmL}
                            baseRadius={0.036}
                            tipRadius={0.028}
                            mat={mats.bone}
                        />
                        {/* Elbow + forearm (two bones side-by-side for radius + ulna look) */}
                        <group position={[0, upperArmL, 0]} rotation={[0.25, 0, 0]}>
                            <group position={[0.012, 0, 0]}>
                                <Bone
                                    length={lowerArmL}
                                    baseRadius={0.026}
                                    tipRadius={0.02}
                                    mat={mats.bone}
                                />
                            </group>
                            <group position={[-0.012, 0, 0]}>
                                <Bone
                                    length={lowerArmL * 0.97}
                                    baseRadius={0.022}
                                    tipRadius={0.018}
                                    mat={mats.bone}
                                />
                            </group>
                            {/* Hand */}
                            <group position={[0, lowerArmL, 0]} rotation={[0.4, 0, 0]}>
                                <Hand mat={mats.bone} clawMat={mats.claw} length={handL} />
                            </group>
                        </group>
                    </group>
                </group>
            ))}
        </group>
    );
}

function NeckAndSkull({ mats, rng }: { mats: Materials; rng: () => number }) {
    const a = anatomy();
    // Whole head/neck group leans forward slightly as called for in the
    // CONFIG's neck_forward_angle.
    const lean = CONFIG.neck_forward_angle;
    return (
        <group position={[0, a.thoracicEnd, 0.02]} rotation={[lean * 0.6, 0, 0]}>
            {/* Skull perched on top */}
            <group position={[0, a.skullBase - a.thoracicEnd + 0.03, 0.05]} rotation={[lean * 0.4, 0, 0]}>
                <Skull mat={mats.bone} teethMat={mats.teeth} />
                {/* Antlers: two racks rooted in thick pedicles above
                    the brow ridge. Origins are pushed slightly wider
                    and further back than the light-weight rack would
                    allow so the new elk-sized beams don't intersect
                    each other at the base. */}
                <Antler
                    origin={new THREE.Vector3(-0.1, 0.33, -0.015)}
                    side={-1}
                    mat={mats.boneDark}
                    rng={rng}
                />
                <Antler
                    origin={new THREE.Vector3(0.1, 0.33, -0.015)}
                    side={1}
                    mat={mats.boneDark}
                    rng={rng}
                />
            </group>
        </group>
    );
}

// === Top-level component ====================================================
export default function WendigoArtifact({ spec }: { spec: RoomSpec }) {
    const rootRef = useRef<THREE.Group>(null);
    const seed = spec.index * 1337 + 91;

    // Barely-there sway: a slow breath in the skeleton's shoulders so the
    // statue doesn't feel nailed down. Amplitude is ~0.2 degrees.
    useFrame(({ clock }) => {
        if (!rootRef.current) return;
        const t = clock.getElapsedTime();
        rootRef.current.rotation.y = Math.sin(t * 0.08) * 0.03;
        rootRef.current.position.y = 1.0 + Math.sin(t * 0.5) * 0.0015;
    });

    // The skeleton stands ON the plinth. The plinth is 1 m tall with its
    // top at y=1. Feet at y=0 inside our group puts them at y=1 world
    // (the plinth surface). Slightly back-of-center so the chest leans
    // over the plinth edge toward the viewer.
    return (
        <group ref={rootRef} position={[0, 1.0, 0]}>
            <Skeleton seed={seed} />
        </group>
    );
}
