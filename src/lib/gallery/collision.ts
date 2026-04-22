import type { RoomSpec } from './types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH } from './roomGenerator';

// The stairs hallway climbs up over the first 6m and then holds its new
// altitude for the rest of the corridor. The rise is one-way: every room
// past a stairs hallway lives at the new elevation permanently, and the
// museum's baseline floor height accumulates as the player climbs more
// staircases. The PLATEAU constant is the flat portion after the rise.
export const STAIRS_RUN = 6.0;
export const STAIRS_RISE = 2.8;
export const STAIRS_PLATEAU = 22.0;

// Jog hallway: two 90-degree turns in a single straight-Z footprint so
// neighbouring rooms still stack directly along +Z.
export const JOG_STEM_LEN = 7.0;
export const JOG_MIDDLE_LEN = 7.0;

// L-shaped "side exit" hallway. The exit doorway is cut from the room's
// left or right wall near its back corner; the corridor leaves the room
// perpendicular to +Z for L_SIDE_LEN metres, turns 90 degrees, and then
// runs the usual HALLWAY_LENGTH metres along +Z to the next room's front
// doorway. L_DOORWAY_SETBACK is the distance from the exit room's back
// wall to the centre of the side doorway (and to the forward segment's
// centreline); a small setback keeps the corner square entirely outside
// the room rather than inside it.
export const L_SIDE_LEN = 8.0;
export const L_DOORWAY_SETBACK = 2.6;

export type AABB = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};

// A single hallway may consist of one or more axis-aligned walkable
// rectangles (two in the case of the L variant: a perpendicular spur
// plus a +Z forward stretch that meet at a corner). Callers that only
// need the outer bounding box use getHallwayBounds; callers doing
// proper 2D clamping use getHallwaySegments.
export function getHallwaySegments(room: RoomSpec): AABB[] {
    const variant = room.hallwayVariant ?? 'straight';
    const ox = room.origin[0];
    const oz = room.origin[2];
    const backZ = oz + room.depth / 2;
    const hwHalf = HALLWAY_WIDTH / 2;

    if (variant === 'l-right' || variant === 'l-left') {
        const side = variant === 'l-right' ? 1 : -1;
        const cornerX = ox + side * (room.width / 2 + L_SIDE_LEN);
        const doorwayZ = backZ - L_DOORWAY_SETBACK;
        // Spur runs from the exit room's side wall outward to the corner.
        const spur: AABB =
            side === 1
                ? {
                      minX: ox + room.width / 2,
                      maxX: cornerX + hwHalf,
                      minZ: doorwayZ - hwHalf,
                      maxZ: doorwayZ + hwHalf,
                  }
                : {
                      minX: cornerX - hwHalf,
                      maxX: ox - room.width / 2,
                      minZ: doorwayZ - hwHalf,
                      maxZ: doorwayZ + hwHalf,
                  };
        // Forward runs from the corner +Z for HALLWAY_LENGTH metres so
        // the next room's front doorway aligns with cornerX on the X axis.
        const forward: AABB = {
            minX: cornerX - hwHalf,
            maxX: cornerX + hwHalf,
            minZ: doorwayZ - hwHalf,
            maxZ: doorwayZ + HALLWAY_LENGTH,
        };
        return [spur, forward];
    }

    // Jog: the corridor doglegs sideways by `hallwayJogOffset` in the
    // middle stretch, so the walkable footprint's X extent covers both
    // the stem (centred on ox) AND the offset middle. Fine-grained
    // clamping per sub-segment is done by getJogHallwayXRange in
    // resolveSliding; the segment returned here is just the outer
    // bounding box so the "player is inside this hallway" test accepts
    // the middle stretch. Without this, a player walking into the jog's
    // offset middle falls out of every hallway match and the collision
    // fallback teleports them into the farthest pre-generated room.
    if (variant === 'jog') {
        const off = room.hallwayJogOffset ?? 0;
        const minOff = Math.min(0, off);
        const maxOff = Math.max(0, off);
        return [
            {
                minX: ox + minOff - hwHalf,
                maxX: ox + maxOff + hwHalf,
                minZ: backZ,
                maxZ: backZ + HALLWAY_LENGTH,
            },
        ];
    }

    // All remaining variants (straight / curved / stairs / bridge /
    // aquarium) share the same straight +Z footprint centred on the
    // exit room's origin.x.
    return [
        {
            minX: ox - hwHalf,
            maxX: ox + hwHalf,
            minZ: backZ,
            maxZ: backZ + HALLWAY_LENGTH,
        },
    ];
}

// Backwards-compatible single-AABB helper: returns the outer bounding box
// that encloses every segment of the hallway. For straight-style variants
// this is identical to the walkable footprint; for L variants it's a
// loose outer envelope (callers that need strict clamping should go
// through resolveSliding / getHallwaySegments instead).
export function getHallwayBounds(room: RoomSpec): AABB {
    const segs = getHallwaySegments(room);
    let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
    for (const s of segs) {
        if (s.minX < minX) minX = s.minX;
        if (s.maxX > maxX) maxX = s.maxX;
        if (s.minZ < minZ) minZ = s.minZ;
        if (s.maxZ > maxZ) maxZ = s.maxZ;
    }
    return { minX, maxX, minZ, maxZ };
}

// Returns the valid X range inside a jog hallway at a given world-space Z.
// The range depends on which of the 5 piecewise segments the point falls in.
export function getJogHallwayXRange(
    room: RoomSpec,
    z: number,
): { minX: number; maxX: number } {
    const startZ = room.origin[2] + room.depth / 2;
    const local = z - startZ;
    const HW = HALLWAY_WIDTH;
    const off = room.hallwayJogOffset ?? 5;
    const ox = room.origin[0];
    const minSide = ox + Math.min(0, off) - HW / 2;
    const maxSide = ox + Math.max(0, off) + HW / 2;

    if (local <= JOG_STEM_LEN) {
        return { minX: ox - HW / 2, maxX: ox + HW / 2 };
    }
    if (local <= JOG_STEM_LEN + HW) {
        return { minX: minSide, maxX: maxSide };
    }
    if (local <= JOG_STEM_LEN + HW + JOG_MIDDLE_LEN) {
        return { minX: ox + off - HW / 2, maxX: ox + off + HW / 2 };
    }
    if (local <= JOG_STEM_LEN + HW + JOG_MIDDLE_LEN + HW) {
        return { minX: minSide, maxX: maxSide };
    }
    return { minX: ox - HW / 2, maxX: ox + HW / 2 };
}

export function getRoomBounds(room: RoomSpec): AABB {
    return {
        minX: room.origin[0] - room.width / 2,
        maxX: room.origin[0] + room.width / 2,
        minZ: room.origin[2] - room.depth / 2,
        maxZ: room.origin[2] + room.depth / 2,
    };
}

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

type ExitSide = 'forward' | 'left' | 'right';
function exitSideOf(room: RoomSpec): ExitSide {
    const v = room.hallwayVariant ?? 'straight';
    if (v === 'l-left') return 'left';
    if (v === 'l-right') return 'right';
    return 'forward';
}

// World-space Z of the centre of a side-wall doorway for an L-exit room.
export function sideDoorwayZ(room: RoomSpec): number {
    return room.origin[2] + room.depth / 2 - L_DOORWAY_SETBACK;
}

// Resolve an attempted player position (px, pz) into a valid position by
// sliding along walls. Dispatch is 2D: we try rooms first (AABB test),
// then hallway segments. When the player is inside a room, doorway gaps
// on the appropriate wall are honoured so they can step through.
export function resolveSliding(
    ctx: CollisionContext,
    px: number,
    pz: number,
): { x: number; z: number } {
    const { rooms, radius, doorwayWidth } = ctx;

    // ---- Room interior pass ----------------------------------------
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const rb = getRoomBounds(room);
        // A player that's passed through a doorway briefly sits right on
        // the boundary; include that edge in the "inside" test so we
        // still clamp them to the doorway gap on the outgoing frame.
        if (
            pz >= rb.minZ &&
            pz <= rb.maxZ &&
            px >= rb.minX &&
            px <= rb.maxX
        ) {
            return clampInRoom(room, i, rooms, px, pz, radius, doorwayWidth);
        }
    }

    // ---- Hallway pass ----------------------------------------------
    //
    // When the player is in one hallway's segments, clamp to whichever
    // segment rectangle they're closest to. Because spur + forward share
    // the corner square for L hallways, this naturally lets the player
    // round the turn: both segments project the player to the same point
    // with d2=0 inside the overlap.
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const variant = room.hallwayVariant ?? 'straight';
        const segs = getHallwaySegments(room);
        // 2D bbox test against the union of segments (with a small pad
        // so a player stepping through a doorway at exactly the edge is
        // claimed by the hallway rather than falling to the fallback).
        const inAny = segs.some(
            (s) =>
                px >= s.minX - 0.01 &&
                px <= s.maxX + 0.01 &&
                pz >= s.minZ - 0.01 &&
                pz <= s.maxZ + 0.01,
        );
        if (!inAny) continue;

        const nextExists = !!rooms[i + 1];

        if (variant === 'jog') {
            // Jog stays on a single straight-Z extent; piecewise X range.
            const hb = segs[0];
            let x = px;
            let z = pz;
            const xr = getJogHallwayXRange(room, z);
            x = clamp(x, xr.minX + radius, xr.maxX - radius);
            if (!nextExists && z > hb.maxZ - radius) z = hb.maxZ - radius;
            if (z < hb.minZ + radius) z = hb.minZ + radius;
            return { x, z };
        }

        if (variant === 'l-left' || variant === 'l-right') {
            // Project into the closest segment. Inside either segment,
            // distance is zero and the player keeps their attempted
            // position; outside both, they slide to the nearest edge.
            //
            // The spur's *room-facing* X edge is not actually a wall
            // inside the side doorway Z range (that's where the doorway
            // is). Relax that clamp on the spur segment only so a player
            // crossing the threshold from room -> spur doesn't get
            // kicked across by radius and smooth-walks through.
            const side = variant === 'l-right' ? 1 : -1;
            const doorwayZc = sideDoorwayZ(room);
            const doorHalfInner = doorwayWidth / 2 - radius * 0.5;
            const inDoorwayRow = Math.abs(pz - doorwayZc) < doorHalfInner;

            let best = { x: px, z: pz, d2: Infinity };
            for (let si = 0; si < segs.length; si++) {
                const s = segs[si];
                const isForward = si === 1;
                const sealFar = isForward && !nextExists;
                let minX = s.minX + radius;
                let maxX = s.maxX - radius;
                if (!isForward && inDoorwayRow) {
                    if (side === 1) minX = s.minX - radius;
                    else maxX = s.maxX + radius;
                }
                const maxZ = sealFar ? s.maxZ - radius : s.maxZ;
                const cx = clamp(px, minX, maxX);
                const cz = clamp(pz, s.minZ + radius, maxZ);
                const dx = px - cx;
                const dz = pz - cz;
                const d2 = dx * dx + dz * dz;
                if (d2 < best.d2) best = { x: cx, z: cz, d2 };
            }
            return { x: best.x, z: best.z };
        }

        // Default straight-style variant (straight / curved / stairs /
        // bridge / aquarium): single AABB.
        const hb = segs[0];
        const x = clamp(px, hb.minX + radius, hb.maxX - radius);
        let z = pz;
        if (!nextExists && z > hb.maxZ - radius) z = hb.maxZ - radius;
        if (z < hb.minZ + radius) z = hb.minZ + radius;
        return { x, z };
    }

    // ---- Fallback --------------------------------------------------
    //
    // The proposed point lies in no room AND no hallway - usually a tiny
    // numerical slip at a doorway edge. Clamp to the room whose centre
    // is *nearest* in Z so we don't yank the player across the gallery
    // (which would happen if we always fell back to rooms[last]).
    if (rooms.length === 0) return { x: px, z: pz };
    let nearest = rooms[0];
    let nearestD = Math.abs(pz - nearest.origin[2]);
    for (let i = 1; i < rooms.length; i++) {
        const d = Math.abs(pz - rooms[i].origin[2]);
        if (d < nearestD) {
            nearest = rooms[i];
            nearestD = d;
        }
    }
    const rb = getRoomBounds(nearest);
    const x = clamp(px, rb.minX + radius, rb.maxX - radius);
    const z = clamp(pz, rb.minZ + radius, rb.maxZ - radius);
    return { x, z };
}

// Clamp the player inside a given room's AABB, opening whichever wall
// carries this room's entry / exit doorway for the attempted crossing.
function clampInRoom(
    room: RoomSpec,
    index: number,
    rooms: RoomSpec[],
    px: number,
    pz: number,
    radius: number,
    doorwayWidth: number,
): { x: number; z: number } {
    const rb = getRoomBounds(room);
    const ox = room.origin[0];
    const exitSide = exitSideOf(room);
    const hasNext = !!rooms[index + 1];
    const hasPrev = index > 0;
    const backSealed = !!room.sealedBack;

    // Is the player lined up with the front doorway (always on the front
    // wall, centred on the room's origin.x) and the back doorway (only
    // when this room's exit goes forward)?
    const inFrontDoorwayX =
        Math.abs(px - ox) < doorwayWidth / 2 - radius * 0.5;
    const inBackDoorwayX = inFrontDoorwayX; // same geometry as front
    const sideZ = sideDoorwayZ(room);
    const inSideDoorwayZ =
        Math.abs(pz - sideZ) < doorwayWidth / 2 - radius * 0.5;

    const leftOpen = hasNext && exitSide === 'left' && inSideDoorwayZ;
    const rightOpen = hasNext && exitSide === 'right' && inSideDoorwayZ;

    let x = px;
    let z = pz;

    // X walls: left / right.
    if (!leftOpen && x < rb.minX + radius) x = rb.minX + radius;
    if (!rightOpen && x > rb.maxX - radius) x = rb.maxX - radius;

    // Front wall: always sealed except at the entry doorway on the
    // front wall, which is open iff this room has a predecessor.
    if (!inFrontDoorwayX || !hasPrev) {
        if (z < rb.minZ + radius) z = rb.minZ + radius;
    }

    // Back wall: open only if the exit goes forward and a next room
    // exists (and the back isn't explicitly sealed by the theme).
    const backOpen =
        hasNext && exitSide === 'forward' && !backSealed && inBackDoorwayX;
    if (!backOpen) {
        if (z > rb.maxZ - radius) z = rb.maxZ - radius;
    }

    return { x, z };
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

// Vertical ground elevation at a world-space (x, z) point.
//
// Each room carries its absolute floor height in origin[1]. Straight-style
// hallways sit at the from-room's floor; stairs ramps up over STAIRS_RUN
// metres to the next room's floor and plateaus for the rest. L hallways
// are always flat at the from-room's floor.
export function groundYAt(rooms: RoomSpec[], x: number, z: number): number {
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const rb = getRoomBounds(room);
        if (x >= rb.minX && x <= rb.maxX && z >= rb.minZ && z <= rb.maxZ) {
            return room.origin[1];
        }
        const segs = getHallwaySegments(room);
        for (let si = 0; si < segs.length; si++) {
            const s = segs[si];
            if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
                const base = room.origin[1];
                const variant = room.hallwayVariant ?? 'straight';
                if (variant !== 'stairs') return base;
                const local = z - s.minZ;
                if (local <= STAIRS_RUN) {
                    return base + STAIRS_RISE * (local / STAIRS_RUN);
                }
                return base + STAIRS_RISE;
            }
        }
    }
    return 0;
}
