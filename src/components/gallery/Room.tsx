'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { RoomSpec, FloorMaterial } from '@/lib/gallery/types';
import Infographic from './Infographic';
import { RoomLights } from './Lighting';
import UFOArtifact from './artifacts/UFOArtifact';
import AIHistoryArtifact from './artifacts/AIHistoryArtifact';
import EsotericArtifact from './artifacts/EsotericArtifact';
import ProceduralArtifact from './artifacts/ProceduralArtifact';
import MarineArtifact from './artifacts/MarineArtifact';
import MarsArtifact from './artifacts/MarsArtifact';
import SilenceArtifact from './artifacts/SilenceArtifact';
import WendigoArtifact from './artifacts/WendigoArtifact';
import { getSubjectArtifact } from './artifacts/SubjectArtifacts';
import FractalRoom from './FractalRoom';
import ForestRoom from './ForestRoom';
import VoidShaftRoom from './VoidShaftRoom';
import SolarSystemRoom from './SolarSystemRoom';
import BridgeOfFacesRoom from './BridgeOfFacesRoom';
import Dweller from './Dweller';
import SilenceWatchers from './SilenceWatchers';
import ArtifactSpotlight from './ArtifactSpotlight';

const WALL_T = 0.2;

function floorMaterialProps(m: FloorMaterial, color: string): THREE.MeshStandardMaterialParameters {
    switch (m) {
        case 'tile':
            return { color, metalness: 0.15, roughness: 0.35 };
        case 'carpet':
            return { color, metalness: 0.0, roughness: 0.95 };
        case 'concrete':
            return { color, metalness: 0.05, roughness: 0.85 };
        case 'vinyl':
            return { color, metalness: 0.1, roughness: 0.55 };
        case 'wood':
            return { color, metalness: 0.05, roughness: 0.7 };
    }
}

// Darken/ lighten utility
function shade(hex: string, amt: number) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

type Props = {
    spec: RoomSpec;
    hasNext: boolean;
    hasPrev: boolean;
    // When true the player has already walked past this room. We keep the
    // shell visible (so glancing back doesn't show a void) but skip the
    // expensive per-room extras: centerpiece artifact, infographic text,
    // active point light. This is the primary "deload" optimisation.
    behind?: boolean;
};

export default function Room({ spec, hasNext, hasPrev, behind = false }: Props) {
    const {
        origin,
        width,
        depth,
        ceilingHeight,
        theme,
        pillars,
        doorwayWidth,
        doorwayHeight,
    } = spec;
    const floorColor = useMemo(() => shade(theme.wallColor, -0.22), [theme.wallColor]);
    const ceilingColor = useMemo(() => shade(theme.wallColor, 0.1), [theme.wallColor]);

    // Milestone themes replace the entire geometry pipeline. They branch
    // *after* all hook declarations so hook order stays stable.
    if (theme.id === 'fractal-chapel') {
        return <FractalRoom spec={spec} hasPrev={hasPrev} hasNext={hasNext} behind={behind} />;
    }
    if (theme.id === 'forest-grove') {
        return <ForestRoom spec={spec} hasPrev={hasPrev} hasNext={hasNext} behind={behind} />;
    }
    if (theme.id === 'void-shaft') {
        return <VoidShaftRoom spec={spec} hasPrev={hasPrev} hasNext={hasNext} behind={behind} />;
    }
    if (theme.id === 'solar-system') {
        return <SolarSystemRoom spec={spec} hasPrev={hasPrev} hasNext={hasNext} behind={behind} />;
    }
    if (theme.id === 'bridge-of-faces') {
        return <BridgeOfFacesRoom spec={spec} hasPrev={hasPrev} hasNext={hasNext} behind={behind} />;
    }

    const [ox, , oz] = origin;
    const dHalf = depth / 2;
    const wHalf = width / 2;
    const dw = doorwayWidth;
    const dh = doorwayHeight;
    const sideW = (width - dw) / 2;

    const renderArtifact = () => {
        switch (theme.id) {
            case 'ufo':
                return <UFOArtifact spec={spec} />;
            case 'ai-history':
                return <AIHistoryArtifact spec={spec} />;
            case 'forbidden-knowledge':
                return <EsotericArtifact spec={spec} />;
            case 'marine-biology':
                return <MarineArtifact spec={spec} />;
            case 'museum-of-rust':
                return <MarsArtifact spec={spec} />;
            case 'silence':
                return <SilenceArtifact spec={spec} />;
            case 'wendigo-reliquary':
                return <WendigoArtifact spec={spec} />;
            default: {
                // For procedural themes with a strong concrete subject
                // (library, bone orchard, mirror loop, etc.) we render a
                // bespoke statue instead of the generic abstract sculpture.
                const Subject = getSubjectArtifact(theme.id);
                if (Subject) return <Subject spec={spec} />;
                return <ProceduralArtifact spec={spec} />;
            }
        }
    };

    return (
        <group>
            {/* Floor */}
            <mesh
                position={[ox, -0.01, oz]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial {...floorMaterialProps(theme.floorMaterial, floorColor)} />
            </mesh>

            {/* Ceiling */}
            <mesh
                position={[ox, ceilingHeight, oz]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>

            {/* Side walls (east / west) */}
            <mesh
                position={[ox - wHalf - WALL_T / 2, ceilingHeight / 2, oz]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight, depth]} />
                <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
            </mesh>
            <mesh
                position={[ox + wHalf + WALL_T / 2, ceilingHeight / 2, oz]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight, depth]} />
                <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
            </mesh>

            {/* Front wall (minZ = entry from previous hallway) */}
            {hasPrev ? (
                <>
                    {/* Left of doorway */}
                    <mesh
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                    </mesh>
                    {/* Right of doorway */}
                    <mesh
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                    </mesh>
                    {/* Above doorway (lintel) */}
                    <mesh
                        position={[ox, (ceilingHeight + dh) / 2, oz - dHalf - WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[dw, ceilingHeight - dh, WALL_T]} />
                        <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                    </mesh>
                </>
            ) : (
                <mesh
                    position={[ox, ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[width, ceilingHeight, WALL_T]} />
                    <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                </mesh>
            )}

            {/* Back wall (maxZ = exit to next hallway) */}
            {hasNext ? (
                <>
                    <mesh
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz + dHalf + WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                    </mesh>
                    <mesh
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz + dHalf + WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                    </mesh>
                    <mesh
                        position={[ox, (ceilingHeight + dh) / 2, oz + dHalf + WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[dw, ceilingHeight - dh, WALL_T]} />
                        <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                    </mesh>
                </>
            ) : (
                <mesh
                    position={[ox, ceilingHeight / 2, oz + dHalf + WALL_T / 2]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[width, ceilingHeight, WALL_T]} />
                    <meshStandardMaterial color={theme.wallColor} roughness={0.75} />
                </mesh>
            )}

            {/* Interior pillars */}
            {pillars.map((p, i) => (
                <mesh key={i} position={p.position} castShadow receiveShadow>
                    <boxGeometry args={p.size} />
                    <meshStandardMaterial color={p.color} roughness={0.6} metalness={0.2} />
                </mesh>
            ))}

            {/* Infographic, centerpiece, and active lighting only render for
                the current room and rooms ahead. Rooms the player has
                already passed skip these to reclaim GPU / draw-call budget. */}
            {!behind && (
                <>
                    <Infographic
                        theme={theme}
                        position={[ox - wHalf + 0.15, ceilingHeight * 0.55, oz]}
                        rotationY={Math.PI / 2}
                        maxWidth={Math.min(6.5, depth * 0.72)}
                        maxHeight={Math.min(3.6, ceilingHeight * 0.72)}
                    />

                    <group position={[ox, 0, oz]}>
                        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                            <boxGeometry args={[2.2, 1.0, 2.2]} />
                            <meshStandardMaterial
                                color={shade(theme.wallColor, -0.35)}
                                roughness={0.55}
                                metalness={0.1}
                            />
                        </mesh>
                        {renderArtifact()}
                        <ArtifactSpotlight
                            ceilingHeight={ceilingHeight}
                            color={theme.lightColor}
                        />
                    </group>

                    <RoomLights
                        theme={theme}
                        origin={origin}
                        width={width}
                        depth={depth}
                        ceilingHeight={ceilingHeight}
                    />

                    {spec.dweller ? (
                        <Dweller
                            kind={spec.dweller.kind}
                            anchor={[
                                ox + spec.dweller.position[0],
                                0,
                                oz + spec.dweller.position[1],
                            ]}
                            facing={spec.dweller.facing}
                        />
                    ) : null}

                    {theme.id === 'silence' ? (
                        <SilenceWatchers spec={spec} />
                    ) : null}
                </>
            )}
        </group>
    );
}
