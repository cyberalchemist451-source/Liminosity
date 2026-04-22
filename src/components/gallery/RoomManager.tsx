'use client';

import { useEffect } from 'react';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import Room from './Room';
import Hallway from './Hallway';

// How far ahead (in sections) we pre-generate. Keeping two rooms beyond the
// current one means the back wall of the current room always has a doorway,
// and the doorway leads into an already-built room - no deadlocks, no pop-in.
const PREGEN_AHEAD = 2;

// Rendering window. The scene only draws rooms in [currentIndex - RENDER_BEHIND,
// currentIndex + RENDER_AHEAD]. Everything else is unmounted so the GPU doesn't
// spend time rasterising corridors the player can't see through the fog anyway.
// This is the single biggest perf lever in the gallery: the scene cost stays
// roughly flat regardless of how deep the player has walked.
const RENDER_BEHIND = 1;
const RENDER_AHEAD = PREGEN_AHEAD;

export default function RoomManager() {
    const sections = useGalleryStore((s) => s.sections);
    const ensureRoomAt = useGalleryStore((s) => s.ensureRoomAt);
    const currentIndex = useGalleryStore((s) => s.currentIndex);

    // Ensure the first two rooms on mount.
    useEffect(() => {
        if (sections.length === 0) {
            ensureRoomAt(0);
            ensureRoomAt(1);
            ensureRoomAt(2);
        }
    }, [sections.length, ensureRoomAt]);

    // Whenever the player moves into a new section, make sure rooms further
    // ahead exist. This guarantees the current room's far doorway is open and
    // leads somewhere.
    useEffect(() => {
        for (let i = currentIndex; i <= currentIndex + PREGEN_AHEAD; i++) {
            if (!sections[i]) ensureRoomAt(i);
        }
    }, [currentIndex, sections, ensureRoomAt]);

    const minVis = Math.max(0, currentIndex - RENDER_BEHIND);
    const maxVis = currentIndex + RENDER_AHEAD;

    return (
        <group>
            {sections.map((room, i) => {
                if (i < minVis || i > maxVis) return null;
                const next = sections[i + 1];
                // Draw the hallway after this room if (a) the next room exists,
                // or (b) this is the last generated room and the next one is in
                // our window (so the dead-end cap shows correctly). Never draw
                // a hallway leading out of a hidden room.
                const showHallway =
                    next != null
                        ? i + 1 <= maxVis
                        : i === sections.length - 1;
                // "Deload" once the player has crossed into the next room.
                // Behind-rooms still render walls (so glances back are not
                // voids) but drop their artifact, infographic, and active
                // point light. Combined with the RENDER_BEHIND window this
                // is what keeps FPS stable as the gallery deepens.
                const isBehind = i < currentIndex;
                // Elevate the whole (room + outgoing hallway) pair by the
                // room's persistent floor height. Every interior component
                // can keep using local y = 0 for the floor while the gallery
                // accumulates altitude section by section.
                return (
                    <group
                        key={`section-${i}`}
                        position={[0, room.origin[1], 0]}
                    >
                        <Room
                            spec={room}
                            hasPrev={i > 0}
                            hasNext={!!next}
                            behind={isBehind}
                        />
                        {showHallway ? (
                            <Hallway fromRoom={room} toRoom={next} />
                        ) : null}
                    </group>
                );
            })}
        </group>
    );
}
