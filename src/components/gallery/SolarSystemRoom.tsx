'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { rngFor, rand } from '@/lib/gallery/rng';
import Infographic from './Infographic';

/*
 * SECTION 033 - Heliographic Hall.
 *
 * A huge 52x52x30 exhibit built as an orbital diorama of the solar system.
 * The cavernous room has starfield-painted inner surfaces, a luminous
 * central sun, the eight classical planets on scaled rings with Saturn's
 * ring plane and a sparse asteroid belt, and... one extra body.
 *
 * The catalogue plaque insists there are eight. The player, moving around
 * the hall, will eventually notice a ninth - unlisted, roughly Earth-sized,
 * orbiting on a slightly inclined path. It is an eye. Its iris tracks
 * them.
 */

type Props = {
    spec: RoomSpec;
    hasPrev: boolean;
    hasNext: boolean;
    behind?: boolean;
};

const WALL_T = 0.3;

type PlanetDef = {
    name: string;
    orbitR: number;
    size: number;
    color: string;
    speed: number;  // radians per second
    inclination: number;  // orbit tilt, radians
    spin: number;  // self-rotation speed
    ring?: { inner: number; outer: number; color: string };
};

export default function SolarSystemRoom({ spec, hasPrev, hasNext, behind = false }: Props) {
    const { origin, width, depth, ceilingHeight, theme, doorwayWidth, doorwayHeight } = spec;
    const [ox, , oz] = origin;
    const wHalf = width / 2;
    const dHalf = depth / 2;
    const dw = doorwayWidth;
    const dh = doorwayHeight;
    const sideW = (width - dw) / 2;

    // Center of the solar system in world coordinates. The sun sits at
    // mid-height in the room's center so orbital planes stay well clear of
    // the floor and ceiling.
    const cx = ox;
    const cy = ceilingHeight * 0.52;
    const cz = oz;

    const planets: PlanetDef[] = useMemo(
        () => [
            { name: 'Mercury', orbitR: 4.2, size: 0.3, color: '#8b8075', speed: 0.46, inclination: 0.02, spin: 0.6 },
            { name: 'Venus',   orbitR: 6.0, size: 0.55, color: '#d0a86a', speed: 0.32, inclination: 0.04, spin: -0.3 },
            { name: 'Earth',   orbitR: 8.0, size: 0.6,  color: '#3b6aa6', speed: 0.25, inclination: 0.0,  spin: 1.2 },
            { name: 'Mars',    orbitR: 10.2, size: 0.45, color: '#b4462c', speed: 0.2,  inclination: 0.03, spin: 1.1 },
            { name: 'Jupiter', orbitR: 14.5, size: 1.9,  color: '#c4a67c', speed: 0.11, inclination: 0.02, spin: 1.6 },
            {
                name: 'Saturn',
                orbitR: 18.5,
                size: 1.55,
                color: '#d9c18a',
                speed: 0.085,
                inclination: 0.05,
                spin: 1.5,
                ring: { inner: 2.2, outer: 3.4, color: '#cbb98a' },
            },
            { name: 'Uranus',  orbitR: 21.5, size: 1.0, color: '#9fd6d9', speed: 0.06, inclination: 0.06, spin: 0.9 },
            { name: 'Neptune', orbitR: 24.0, size: 0.95, color: '#4a6eb6', speed: 0.048, inclination: 0.04, spin: 0.95 },
        ],
        [],
    );

    // Starting orbital phases, deterministic per seed.
    const phases = useMemo(() => {
        const rng = rngFor(spec.index ^ 0xac05, 7);
        return planets.map(() => rand(rng, 0, Math.PI * 2));
    }, [spec.index, planets]);

    // Asteroid belt: deterministic scatter of small rocks between Mars and
    // Jupiter. Each has its own orbital radius, phase, and speed so the belt
    // rotates unevenly.
    const asteroids = useMemo(() => {
        const rng = rngFor(spec.index ^ 0xbea75, 11);
        const out: Array<{ r: number; phase: number; speed: number; size: number; y: number }> = [];
        for (let i = 0; i < 80; i++) {
            out.push({
                r: rand(rng, 11.2, 13.6),
                phase: rand(rng, 0, Math.PI * 2),
                speed: rand(rng, 0.14, 0.2),
                size: rand(rng, 0.04, 0.11),
                y: rand(rng, -0.4, 0.4),
            });
        }
        return out;
    }, [spec.index]);

    return (
        <group>
            {/* ---------- ROOM SHELL ----------
                All six inner surfaces are painted with a starfield skybox
                material. The player never notices a "wall" - the room reads
                as open space until they hit collision. */}
            <Starfield origin={[ox, ceilingHeight / 2, oz]} size={[width, ceilingHeight, depth]} />

            {/* Floor */}
            <mesh
                position={[ox, -0.01, oz]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial
                    color="#050410"
                    roughness={0.7}
                    metalness={0.2}
                />
            </mesh>

            {/* Faint concentric ring on the floor under the sun for a
                observatory-like accent. */}
            <mesh position={[ox, 0.005, oz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.8, 2.0, 64]} />
                <meshBasicMaterial color={theme.accentColor} transparent opacity={0.4} />
            </mesh>
            <mesh position={[ox, 0.005, oz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[3.4, 3.55, 64]} />
                <meshBasicMaterial color={theme.accentColor} transparent opacity={0.22} />
            </mesh>

            {/* Walls - solid boxes behind the starfield shell so the player
                can't walk into the void. Use doorway cut-outs like a normal
                room. */}

            {/* Side walls */}
            <mesh
                position={[ox - wHalf - WALL_T / 2, ceilingHeight / 2, oz]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight, depth]} />
                <meshStandardMaterial color="#02030a" />
            </mesh>
            <mesh
                position={[ox + wHalf + WALL_T / 2, ceilingHeight / 2, oz]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight, depth]} />
                <meshStandardMaterial color="#02030a" />
            </mesh>

            {/* Front wall (entry) with doorway */}
            {hasPrev ? (
                <>
                    <mesh
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color="#02030a" />
                    </mesh>
                    <mesh
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color="#02030a" />
                    </mesh>
                    <mesh
                        position={[ox, (ceilingHeight + dh) / 2, oz - dHalf - WALL_T / 2]}
                    >
                        <boxGeometry args={[dw, ceilingHeight - dh, WALL_T]} />
                        <meshStandardMaterial color="#02030a" />
                    </mesh>
                </>
            ) : (
                <mesh position={[ox, ceilingHeight / 2, oz - dHalf - WALL_T / 2]}>
                    <boxGeometry args={[width, ceilingHeight, WALL_T]} />
                    <meshStandardMaterial color="#02030a" />
                </mesh>
            )}

            {/* Back wall (exit) with doorway */}
            {hasNext ? (
                <>
                    <mesh
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz + dHalf + WALL_T / 2]}
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color="#02030a" />
                    </mesh>
                    <mesh
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz + dHalf + WALL_T / 2]}
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color="#02030a" />
                    </mesh>
                    <mesh
                        position={[ox, (ceilingHeight + dh) / 2, oz + dHalf + WALL_T / 2]}
                    >
                        <boxGeometry args={[dw, ceilingHeight - dh, WALL_T]} />
                        <meshStandardMaterial color="#02030a" />
                    </mesh>
                </>
            ) : (
                <mesh position={[ox, ceilingHeight / 2, oz + dHalf + WALL_T / 2]}>
                    <boxGeometry args={[width, ceilingHeight, WALL_T]} />
                    <meshStandardMaterial color="#02030a" />
                </mesh>
            )}

            {/* ---------- SUN ---------- */}
            {!behind && <Sun position={[cx, cy, cz]} accent={theme.accentColor} />}

            {/* ---------- ORBIT RINGS ---------- */}
            {planets.map((p, i) => (
                <OrbitRing
                    key={`orbit-${i}`}
                    center={[cx, cy, cz]}
                    radius={p.orbitR}
                    inclination={p.inclination}
                    color={theme.accentColor}
                />
            ))}

            {/* ---------- PLANETS ---------- */}
            {!behind && planets.map((p, i) => (
                <Planet
                    key={`p-${i}`}
                    def={p}
                    center={[cx, cy, cz]}
                    initialPhase={phases[i]}
                />
            ))}

            {/* ---------- ASTEROID BELT ---------- */}
            {!behind && (
                <AsteroidBelt center={[cx, cy, cz]} asteroids={asteroids} />
            )}

            {/* ---------- THE SURPRISE - AN EXTRA BODY ----------
                Listed on the plaque: eight planets. In the hall, there is a
                ninth. It has a slightly tilted, slower retrograde orbit and
                is an eye. Its iris tracks the player as they move around the
                room. */}
            {!behind && <WatchfulEye center={[cx, cy, cz]} />}

            {/* Infographic floats waist-high near the entrance, angled
                slightly inward. */}
            {!behind && (
                <Infographic
                    theme={theme}
                    position={[ox - wHalf * 0.68, 1.6, oz - dHalf * 0.75]}
                    rotationY={Math.PI / 6}
                    maxWidth={6.5}
                    maxHeight={3.6}
                />
            )}

            {/* Ambient fill light so planets on the far side stay visible
                even with the sun occluded. */}
            {!behind && (
                <hemisphereLight
                    color="#8da0c8"
                    groundColor="#050515"
                    intensity={0.25}
                />
            )}
        </group>
    );
}

// ---------------------------------------------------------------------------
// STARFIELD SHELL - inside-facing box painted with a star shader. Sits inside
// the room so the walls "are" the sky.
// ---------------------------------------------------------------------------

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
        float scale = 140.0;
        vec3 gp = floor(d * scale);
        float h = hash(gp);
        float star = smoothstep(0.9968, 1.0, h);
        star *= 0.75 + 0.25*sin(uTime*1.2 + h*40.0);
        // faint milky nebula banding across equator
        float band = exp(-abs(d.y)*3.5);
        vec3 neb = mix(vec3(0.02,0.02,0.05), vec3(0.06,0.02,0.11), smoothstep(-1.0,1.0,d.x)) * band;
        vec3 col = neb + vec3(star);
        gl_FragColor = vec4(col, 1.0);
    }
`;

function Starfield({
    origin,
    size,
}: {
    origin: [number, number, number];
    size: [number, number, number];
}) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
    useFrame(({ clock }) => {
        if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    });
    return (
        <mesh position={origin}>
            <boxGeometry args={[size[0] - 0.4, size[1] - 0.4, size[2] - 0.4]} />
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

// ---------------------------------------------------------------------------
// SUN - an emissive sphere with a subtle pulsing corona. Casts a strong
// point light that lights the orbiting planets.
// ---------------------------------------------------------------------------

function Sun({
    position,
    accent,
}: {
    position: [number, number, number];
    accent: string;
}) {
    const coreRef = useRef<THREE.Mesh>(null);
    const coronaRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (coreRef.current) {
            const mat = coreRef.current.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 1.8 + Math.sin(t * 0.8) * 0.1;
        }
        if (coronaRef.current) {
            const s = 1 + Math.sin(t * 0.55) * 0.04;
            coronaRef.current.scale.set(s, s, s);
        }
    });
    return (
        <group position={position}>
            <mesh ref={coreRef}>
                <sphereGeometry args={[2.2, 48, 36]} />
                <meshStandardMaterial
                    color="#ffe08a"
                    emissive="#ffcc60"
                    emissiveIntensity={1.8}
                    roughness={0.5}
                    toneMapped={false}
                />
            </mesh>
            {/* Outer corona halo */}
            <mesh ref={coronaRef}>
                <sphereGeometry args={[2.7, 32, 24]} />
                <meshBasicMaterial
                    color={accent}
                    transparent
                    opacity={0.18}
                />
            </mesh>
            <pointLight color="#fff0c8" intensity={4.0} distance={70} decay={1.5} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// ORBIT RING - a faint torus marking a planet's orbital path.
// ---------------------------------------------------------------------------

function OrbitRing({
    center,
    radius,
    inclination,
    color,
}: {
    center: [number, number, number];
    radius: number;
    inclination: number;
    color: string;
}) {
    return (
        <mesh
            position={center}
            rotation={[Math.PI / 2 + inclination, 0, 0]}
        >
            <torusGeometry args={[radius, 0.015, 6, 128]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>
    );
}

// ---------------------------------------------------------------------------
// PLANET - orbits around the sun on its defined ring, spins on its own axis,
// carries optional rings (Saturn).
// ---------------------------------------------------------------------------

function Planet({
    def,
    center,
    initialPhase,
}: {
    def: PlanetDef;
    center: [number, number, number];
    initialPhase: number;
}) {
    const orbitRef = useRef<THREE.Group>(null);
    const selfRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (orbitRef.current) {
            const theta = initialPhase + t * def.speed;
            const x = Math.cos(theta) * def.orbitR;
            const z = Math.sin(theta) * def.orbitR;
            const y = Math.sin(theta + initialPhase) * def.inclination * def.orbitR * 0.3;
            orbitRef.current.position.set(center[0] + x, center[1] + y, center[2] + z);
        }
        if (selfRef.current) {
            selfRef.current.rotation.y = t * def.spin;
        }
    });
    return (
        <group ref={orbitRef}>
            <mesh ref={selfRef} castShadow receiveShadow>
                <sphereGeometry args={[def.size, 24, 18]} />
                <meshStandardMaterial
                    color={def.color}
                    roughness={0.78}
                    metalness={0.05}
                />
            </mesh>
            {def.ring ? (
                <mesh rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
                    <ringGeometry args={[def.ring.inner, def.ring.outer, 64]} />
                    <meshStandardMaterial
                        color={def.ring.color}
                        side={THREE.DoubleSide}
                        roughness={0.8}
                        transparent
                        opacity={0.85}
                    />
                </mesh>
            ) : null}
        </group>
    );
}

// ---------------------------------------------------------------------------
// ASTEROID BELT - instanced scatter of small rocks orbiting between Mars
// and Jupiter. Each asteroid has its own radius/phase/speed so the belt
// never looks static.
// ---------------------------------------------------------------------------

type AsteroidDef = { r: number; phase: number; speed: number; size: number; y: number };

function AsteroidBelt({
    center,
    asteroids,
}: {
    center: [number, number, number];
    asteroids: AsteroidDef[];
}) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const t = clock.getElapsedTime();
        for (let i = 0; i < asteroids.length; i++) {
            const a = asteroids[i];
            const theta = a.phase + t * a.speed;
            dummy.position.set(
                center[0] + Math.cos(theta) * a.r,
                center[1] + a.y,
                center[2] + Math.sin(theta) * a.r,
            );
            dummy.rotation.set(t * 0.8 + i, t * 0.6 + i, 0);
            dummy.scale.setScalar(a.size);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, asteroids.length]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#4a4238" roughness={0.95} metalness={0.02} />
        </instancedMesh>
    );
}

// ---------------------------------------------------------------------------
// THE WATCHFUL EYE - the surprise.
//
// An unlisted ninth body orbiting on a tilted retrograde path. At a glance
// it reads as another planet: pale, roughly Earth-sized. As the player
// moves closer they realize it's an eye - complete with sclera, iris, and
// a dark pupil - and the iris is slowly rotating to keep the player's
// camera in its line of sight. The eye blinks (an eyelid sweeps across)
// every ~11 seconds.
// ---------------------------------------------------------------------------

function WatchfulEye({ center }: { center: [number, number, number] }) {
    const bodyRef = useRef<THREE.Group>(null);
    const irisRef = useRef<THREE.Group>(null);
    const upperLidRef = useRef<THREE.Mesh>(null);
    const lowerLidRef = useRef<THREE.Mesh>(null);

    // Orbital parameters - an inclined, slow, retrograde orbit at radius 16
    // (between Saturn and Uranus) so the eye crosses the "proper" planets'
    // planes and catches the player off-guard from different angles.
    const orbitR = 16.0;
    const orbitSpeed = -0.07;
    const inclination = 0.38;
    const camera = useThree((s) => s.camera);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        const phase = 1.7 + t * orbitSpeed;
        const cx0 = center[0] + Math.cos(phase) * orbitR;
        const cz0 = center[2] + Math.sin(phase) * orbitR;
        const cy0 = center[1] + Math.sin(phase * 1.3) * orbitR * inclination * 0.6;
        if (bodyRef.current) {
            bodyRef.current.position.set(cx0, cy0, cz0);
        }
        // Iris tracks the player's camera. We rotate the iris group so it
        // always faces the camera position.
        if (irisRef.current && bodyRef.current) {
            const eye = bodyRef.current.position;
            const dir = new THREE.Vector3(
                camera.position.x - eye.x,
                camera.position.y - eye.y,
                camera.position.z - eye.z,
            ).normalize();
            // Place iris group slightly off-center toward the camera, then
            // have it look at the camera. The offset exaggerates the tracking.
            irisRef.current.position.set(dir.x * 0.6, dir.y * 0.6, dir.z * 0.6);
            irisRef.current.lookAt(
                camera.position.x,
                camera.position.y,
                camera.position.z,
            );
        }
        // Blink: the eyelids sweep together for ~0.18 s every ~11 s.
        const cyc = t % 11.0;
        let lidT = 0;
        if (cyc > 10.82) {
            // Compress lids toward the center. 0 = open, 1 = closed.
            lidT = Math.min(1, (cyc - 10.82) / 0.09);
        } else if (cyc > 10.91) {
            lidT = Math.max(0, 1 - (cyc - 10.91) / 0.09);
        }
        if (upperLidRef.current) {
            upperLidRef.current.position.y = 1.2 - lidT * 1.2;
        }
        if (lowerLidRef.current) {
            lowerLidRef.current.position.y = -1.2 + lidT * 1.2;
        }
    });

    return (
        <group ref={bodyRef}>
            {/* The sclera - pale spherical "body" that reads as a planet at
                distance. Veins painted faintly via emissive tint. */}
            <mesh>
                <sphereGeometry args={[1.2, 48, 36]} />
                <meshStandardMaterial
                    color="#e8ded0"
                    roughness={0.75}
                    emissive="#331a1a"
                    emissiveIntensity={0.18}
                />
            </mesh>
            {/* Red vein overlay - a darker tinted mesh a sliver above the
                sclera so it reads as surface veining. */}
            <mesh>
                <sphereGeometry args={[1.202, 24, 18]} />
                <meshBasicMaterial
                    color="#6b1313"
                    transparent
                    opacity={0.18}
                    depthWrite={false}
                />
            </mesh>

            {/* Iris + pupil assembly. Tracks the camera. */}
            <group ref={irisRef}>
                <mesh>
                    <circleGeometry args={[0.72, 48]} />
                    <meshStandardMaterial
                        color="#3a7dbd"
                        emissive="#0a2440"
                        emissiveIntensity={0.6}
                        roughness={0.35}
                        side={THREE.DoubleSide}
                    />
                </mesh>
                {/* Iris radial texture via overlayed dark ring */}
                <mesh position={[0, 0, 0.002]}>
                    <ringGeometry args={[0.45, 0.72, 64]} />
                    <meshBasicMaterial
                        color="#0e2a4e"
                        transparent
                        opacity={0.55}
                        side={THREE.DoubleSide}
                    />
                </mesh>
                {/* Pupil */}
                <mesh position={[0, 0, 0.005]}>
                    <circleGeometry args={[0.3, 48]} />
                    <meshBasicMaterial color="#000000" />
                </mesh>
                {/* Catch-light */}
                <mesh position={[-0.08, 0.12, 0.01]}>
                    <circleGeometry args={[0.07, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>

            {/* Eyelids - two hemispheres that sweep toward the center when
                blinking. Default position: well clear of the iris. */}
            <mesh ref={upperLidRef} position={[0, 1.2, 0]}>
                <sphereGeometry
                    args={[1.22, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
                />
                <meshStandardMaterial
                    color="#b09588"
                    roughness={0.85}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <mesh
                ref={lowerLidRef}
                position={[0, -1.2, 0]}
                rotation={[Math.PI, 0, 0]}
            >
                <sphereGeometry
                    args={[1.22, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
                />
                <meshStandardMaterial
                    color="#9a8076"
                    roughness={0.85}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Faint point-light emanation so the iris catches the sun's
                side too, keeping the eye visible on the dark half of its
                orbit. */}
            <pointLight color="#d8e8ff" intensity={0.35} distance={6} decay={1.5} />
        </group>
    );
}
