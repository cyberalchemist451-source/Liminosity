import type { RoomSpec } from './types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH } from './roomGenerator';

// The stairs hallway climbs up over the first 6m and then holds its new
// altitude for the rest of the corridor. The rise is one-way: every room
// past a stairs hallway lives at the new elevation permanently, and the
// museum's baseline floor height accumulates as the player climbs more
// staircases. The PLATEAU constant is the flat portion after the rise.
export const STAIRS_RUN = 6.0;
export const STAIRS_RISE = 2.8;
// HALLWAY_LENGTH - STAIRS_RUN. Exported so StairsHallway doesn't have to
// re-derive it.
export const STAIRS_PLATEAU = 22.0;

// The jog hallway has two 90-degree turns. Entry and exit are both at x=0
// so neighbouring rooms still stack along +Z; between them the corridor
// detours laterally by JOG_OFFSET. Z footprint (28m) is partitioned:
// [0..7] stem1, [7..7+HW] corner1, [7+HW..14+HW] middle (at offset),
// [14+HW..14+2*HW] corner2, [14+2*HW..28] stem2.
export const JOG_STEM_LEN = 7.0;
export const JOG_MIDDLE_LEN = 7.0;

export type AABB = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};

// A hallway sits between room[i].backZ and room[i+1].frontZ, centered on x=0.
export function getHallwayBounds(room: RoomSpec): AABB {
    const startZ = room.origin[2] + room.depth / 2;
    return {
        minX: -HALLWAY_WIDTH / 2,
        maxX: HALLWAY_WIDTH / 2,
        minZ: startZ,
        maxZ: startZ + HALLWAY_LENGTH,
    };
}

// Returns the valid X range inside a jog hallway at a given world-space Z.
// The range depends on which of the 5 piecewise segments the point falls in.
// Callers then clamp the player's X into [minX+radius, maxX-radius].
export function getJogHallwayXRange(
    room: RoomSpec,
    z: number,
): { minX: number; maxX: number } {
    const startZ = room.origin[2] + room.depth / 2;
    const local = z - startZ;
    const HW = HALLWAY_WIDTH;
    const off = room.hallwayJogOffset ?? 5;
    const minSide = Math.min(0, off) - HW / 2;
    const maxSide = Math.max(0, off) + HW / 2;

    if (local <= JOG_STEM_LEN) {
        return { minX: -HW / 2, maxX: HW / 2 };
    }
    if (local <= JOG_STEM_LEN + HW) {
        return { minX: minSide, maxX: maxSide };
    }
    if (local <= JOG_STEM_LEN + HW + JOG_MIDDLE_LEN) {
        return { minX: off - HW / 2, maxX: off + HW / 2 };
    }
    if (local <= JOG_STEM_LEN + HW + JOG_MIDDLE_LEN + HW) {
        return { minX: minSide, maxX: maxSide };
    }
    return { minX: -HW / 2, maxX: HW / 2 };
}

export function getRoomBounds(room: RoomSpec): AABB {
    return {
        minX: room.origin[0] - room.width / 2,
        maxX: room.origin[0] + room.width / 2,
        minZ: room.origin[2] - room.depth / 2,
        maxZ: room.origin[2] + room.depth / 2,
    };
}

// Returns the signed axis-aligned bounds the player must stay inside right now.
// Rooms allow full AABB except the doorway gap; hallways have narrow x range.
// We approximate by snapping player to the closest bounds based on Z.
export function pointInBounds(bounds: AABB, x: number, z: number, radius: number) {
    return (
        x >= bounds.minX + radius &&
        x <= bounds.maxX - radius &&
        z >= bounds.minZ + radius &&
        z <= bounds.maxZ - radius
    );
}

export type CollisionContext = {
    rooms: RoomSpec[];
    radius: number;
    doorwayWidth: number;
};

// Figure out which structure the player's Z falls into: a room or a hallway.
// Returns also whether we're near a doorway (and should permit crossing).
export function resolveSliding(
    ctx: CollisionContext,
    px: number,
    pz: number,
): { x: number; z: number } {
    const { rooms, radius, doorwayWidth } = ctx;

    // Find which section contains us by Z.
    let x = px;
    let z = pz;

    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const rb = getRoomBounds(room);
        if (z >= rb.minZ && z <= rb.maxZ) {
            // inside room. Clamp to walls, but allow doorway gap at front/back.
            x = clampWithDoorway(x, rb.minX, rb.maxX, radius);
            // For front/back walls, only block if we are NOT within doorway x-range,
            // OR the adjacent hallway doesn't exist yet.
            const inDoorwayX = Math.abs(x) < doorwayWidth / 2 - radius * 0.5;
            const hasNext = !!rooms[i + 1];
            const hasPrev = i > 0;
            const backSealed = !!room.sealedBack;

            if (!inDoorwayX || !hasNext || backSealed) {
                if (z > rb.maxZ - radius) z = rb.maxZ - radius;
            }
            if (!inDoorwayX || !hasPrev) {
                if (z < rb.minZ + radius) z = rb.minZ + radius;
            }
            return { x, z };
        }
    }

    // Otherwise, we must be in a hallway trailing some room i.
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const hb = getHallwayBounds(room);
        if (z >= hb.minZ && z <= hb.maxZ) {
            if ((room.hallwayVariant ?? 'straight') === 'jog') {
                const xr = getJogHallwayXRange(room, z);
                x = clamp(x, xr.minX + radius, xr.maxX - radius);
            } else {
                x = clamp(x, hb.minX + radius, hb.maxX - radius);
            }
            const nextExists = !!rooms[i + 1];
            if (!nextExists && z > hb.maxZ - radius) z = hb.maxZ - radius;
            if (z < hb.minZ + radius) z = hb.minZ + radius;
            return { x, z };
        }
    }

    // Fallback: last known room bounds
    const last = rooms[rooms.length - 1];
    if (last) {
        const rb = getRoomBounds(last);
        x = clamp(x, rb.minX + radius, rb.maxX - radius);
        z = clamp(z, rb.minZ + radius, rb.maxZ - radius);
    }
    return { x, z };
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

// Vertical ground elevation at a world-space (x, z) point.
//
// Each room carries its absolute floor height in origin[1]. Straight-style
// hallways sit at the from-room's floor. A stairs-variant hallway ramps
// from the from-room's floor up to the next room's floor over the first
// STAIRS_RUN metres and holds that new altitude for the remaining
// STAIRS_PLATEAU metres; the next room lives at that new altitude
// permanently. This is how the museum gains elevation as the player
// climbs deeper.
export function groundYAt(rooms: RoomSpec[], _x: number, z: number): number {
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const rb = getRoomBounds(room);
        if (z >= rb.minZ && z <= rb.maxZ) {
            return room.origin[1];
        }
        const hb = getHallwayBounds(room);
        if (z >= hb.minZ && z <= hb.maxZ) {
            const base = room.origin[1];
            if ((room.hallwayVariant ?? 'straight') !== 'stairs') return base;
            const local = z - hb.minZ;
            if (local <= STAIRS_RUN) {
                return base + STAIRS_RISE * (local / STAIRS_RUN);
            }
            return base + STAIRS_RISE;
        }
    }
    return 0;
}

// Clamp x into a room, ignoring doorway (doorway is on z walls, not x walls).
function clampWithDoorway(x: number, minX: number, maxX: number, radius: number) {
    return clamp(x, minX + radius, maxX - radius);
}
