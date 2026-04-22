import type { RoomSpec, Pillar, Vec3, DwellerSpec, DwellerKind, HallwayVariant } from './types';
import { getTheme, MILESTONE_THEMES, SCRIPTED_THEMES } from './themes';
import { rand, randInt, rngFor, pick, type Rng } from './rng';

export const HALLWAY_LENGTH = 28;
export const HALLWAY_WIDTH = 3.6;
export const HALLWAY_HEIGHT = 3.0;
export const DOORWAY_WIDTH = 2.2;
export const DOORWAY_HEIGHT = 2.6;

// Compute world-space origin of the room at `index`. Rooms are stacked along +Z
// separated by hallway segments. Origin is center of the room on the floor.
export function computeRoomOrigin(
    index: number,
    rooms: Pick<RoomSpec, 'origin' | 'depth'>[],
): Vec3 {
    if (index === 0) return [0, 0, 0];
    const prev = rooms[index - 1];
    if (!prev) {
        throw new Error(`computeRoomOrigin requires room ${index - 1} to be generated first`);
    }
    const prevBackZ = prev.origin[2] + prev.depth / 2;
    return [0, 0, prevBackZ + HALLWAY_LENGTH /* hallway */];
}

// A room is "free-form" (procedurally themed, eligible for cathedral ceilings
// and dwellers) if it's not one of the first three scripted rooms and not a
// hand-pinned milestone like the Fractal Chapel or Marine Biology.
function isFreeformRoom(index: number): boolean {
    if (index < SCRIPTED_THEMES.length) return false;
    if (MILESTONE_THEMES[index]) return false;
    return true;
}

function pickDwellerKind(rng: Rng, index: number): DwellerKind {
    // Early "dweller" rooms bias towards the classic grey / faceless pair;
    // deeper rooms unlock slenderman, then observer / mothman.
    const depth = index - 10;
    const pool: DwellerKind[] = ['grey', 'faceless-suit'];
    if (depth >= 5) pool.push('slenderman', 'grey');
    if (depth >= 10) pool.push('observer');
    if (depth >= 13) pool.push('mothman', 'slenderman');
    return pick(rng, pool);
}

function rollDweller(
    rng: Rng,
    index: number,
    width: number,
    depth: number,
): DwellerSpec | undefined {
    // Dwellers only start appearing at SECTION 011 and beyond, and only in
    // free-form rooms. Probability ramps gently so they stay rare.
    if (index < 10) return undefined;
    const prob = Math.min(0.38, (index - 9) * 0.045);
    if (rng() >= prob) return undefined;

    // Stand off-center, at least 2.5m from any wall, well clear of the central
    // plinth (radius ~2.2) and the door axis (x near 0 at the front/back).
    const quadX = rng() < 0.5 ? -1 : 1;
    const quadZ = rng() < 0.5 ? -1 : 1;
    const px = quadX * rand(rng, 3.2, Math.max(3.5, width / 2 - 2.0));
    const pz = quadZ * rand(rng, 3.2, Math.max(3.5, depth / 2 - 2.0));

    // Facing: a coin flip between looking at the room's center (observing the
    // plinth) and looking at the far wall (facing away from the player). Both
    // are more unsettling than random directions.
    const facing =
        rng() < 0.5
            ? Math.atan2(-px, -pz) // face room center
            : Math.atan2(0, pz > 0 ? 1 : -1); // face the near wall

    return {
        kind: pickDwellerKind(rng, index),
        position: [px, pz],
        facing,
    };
}

export function generateRoom(index: number, seed: number, priorRooms: RoomSpec[]): RoomSpec {
    const rng = rngFor(seed, index);
    // Never-repeat: hand getTheme the set of theme ids already used so far so
    // procedural picks draw from the unused pool first. Combined with the
    // ~40-theme pool this keeps the player from re-seeing any milieu for a
    // very long run.
    const usedIds = new Set(priorRooms.map((r) => r.theme.id));
    const theme = getTheme(index, rng, usedIds);
    const freeform = isFreeformRoom(index);

    // The Grove (forest milestone) is a deliberately *vast* clearing so the
    // player can wander under the canopy; the Drop is a modest sealed cell.
    let width: number;
    let depth: number;
    if (theme.id === 'forest-grove') {
        width = 44;
        depth = 44;
    } else if (theme.id === 'void-shaft') {
        width = 14;
        depth = 14;
    } else if (theme.id === 'solar-system') {
        // A huge hall so the orbits have room to stretch out.
        width = 52;
        depth = 52;
    } else if (theme.id === 'bridge-of-faces') {
        // Extremely long corridor. The bridge runs almost the full depth
        // with the pit flanking either side, so depth dominates.
        width = 30;
        depth = 120;
    } else {
        width = Math.round(rand(rng, 16, 24));
        depth = Math.round(rand(rng, 16, 26));
    }

    // Base ceiling follows the theme; free-form rooms may roll a soaring
    // "cathedral" variant (~18% after SECTION 010) to break up the feeling of
    // repetition the player notices once themes start recycling.
    let ceilingHeight = theme.ceiling + rand(rng, -0.3, 0.3);
    let cathedral = false;
    if (freeform && index > 8 && rng() < 0.18) {
        ceilingHeight *= rand(rng, 1.9, 2.6);
        cathedral = true;
    }

    // The plinth sits at y=0 with top at y=1.0 and the centerpiece artifact
    // stacks on top of it. ProceduralArtifact.escalationFor(index) scales
    // artifact heights up to ~1.8x by index 18+, with obelisk-flavored
    // artifacts reaching ~3.4m before the factor. Guarantee the ceiling
    // always clears the plinth + the tallest artifact the generator might
    // produce plus a margin, so artifacts never clip through the ceiling.
    const ARTIFACT_BASE_MAX = 3.3;
    const MARGIN = 0.8;
    const PLINTH_TOP = 1.0;
    const escalation = 1 + Math.min(1.8, Math.max(0, index - 3) * 0.12);
    const minCeilingForArtifact = PLINTH_TOP + ARTIFACT_BASE_MAX * escalation + MARGIN;
    if (ceilingHeight < minCeilingForArtifact) {
        ceilingHeight = minCeilingForArtifact;
    }

    const tilt = Math.min(0.08, index * 0.007);

    const originCenter: Vec3 =
        index === 0
            ? [0, 0, 0]
            : (() => {
                  const prev = priorRooms[index - 1];
                  const frontOfRoomZ = prev.origin[2] + prev.depth / 2 + HALLWAY_LENGTH + depth / 2;
                  return [0, 0, frontOfRoomZ] as Vec3;
              })();

    const frontZ = originCenter[2] - depth / 2;
    const backZ = originCenter[2] + depth / 2;
    const entryZ = frontZ;
    const exitZ = backZ;

    // Pillars: 0 to ~4 scattered inside, avoiding the central artifact zone and
    // doorways. Cathedral rooms get slightly more pillars to avoid feeling
    // hollow.
    const pillarCountMax = cathedral ? 6 : 4;
    const pillarCount = randInt(rng, 0, pillarCountMax);
    const pillars: Pillar[] = [];
    for (let i = 0; i < pillarCount; i++) {
        const px = rand(rng, -width / 2 + 2, width / 2 - 2);
        const pz = rand(rng, -depth / 2 + 3, depth / 2 - 3);
        if (Math.hypot(px, pz) < 4) continue;
        if (
            Math.abs(px) < DOORWAY_WIDTH &&
            (Math.abs(pz + depth / 2) < 3 || Math.abs(pz - depth / 2) < 3)
        ) {
            continue;
        }
        const size: Vec3 = [rand(rng, 0.6, 1.3), ceilingHeight, rand(rng, 0.6, 1.3)];
        pillars.push({
            position: [originCenter[0] + px, ceilingHeight / 2, originCenter[2] + pz],
            size,
            color: theme.accentColor,
        });
    }

    const dweller = freeform ? rollDweller(rng, index, width, depth) : undefined;
    const sealedBack = theme.id === 'void-shaft';

    // Roll a variant for the hallway that leaves this room. Held to the
    // straight default for the opening few sections, and forced to straight
    // when the departure is architecturally fragile (the Drop drops the
    // player *into* this hallway so it must be flat and navigable).
    //
    // Weighted pool: jog hallways with their 90-degree corners appear more
    // often than any single other variant so the museum feels properly
    // winding. Roughly 32% of hallways get a variant overall, of which
    // jogs are ~40%.
    const hallwayVariant: HallwayVariant = (() => {
        if (index < 3) return 'straight';
        if (theme.id === 'void-shaft') return 'straight';
        if (theme.id === 'forest-grove') return 'straight';
        if (theme.id === 'solar-system') return 'straight';
        if (theme.id === 'bridge-of-faces') return 'straight';
        if (rng() >= 0.32) return 'straight';
        const weighted: HallwayVariant[] = [
            'jog', 'jog', 'jog', 'jog', // 4
            'curved', 'curved',          // 2
            'stairs', 'stairs',          // 2
            'bridge',                    // 1
            'aquarium',                  // 1
        ];
        return pick(rng, weighted);
    })();

    // Lateral offset for jog hallways: roll +/- 4-6m so the corner turn is
    // sharply visible without pushing the detour impractically wide.
    const hallwayJogOffset =
        hallwayVariant === 'jog'
            ? (rng() < 0.5 ? -1 : 1) * rand(rng, 4.0, 6.0)
            : undefined;

    // Custom-scene milestones render their own geometry so the plinth/
    // pillars would look out-of-place; drop any pillars there.
    const finalPillars =
        theme.id === 'forest-grove' ||
        theme.id === 'void-shaft' ||
        theme.id === 'solar-system' ||
        theme.id === 'bridge-of-faces'
            ? []
            : pillars;

    return {
        index,
        theme,
        width,
        depth,
        ceilingHeight,
        tilt,
        pillars: finalPillars,
        origin: originCenter,
        entryZ,
        exitZ,
        hallwayLength: HALLWAY_LENGTH,
        hallwayWidth: HALLWAY_WIDTH,
        doorwayWidth: DOORWAY_WIDTH,
        doorwayHeight: DOORWAY_HEIGHT,
        dweller,
        cathedral,
        sealedBack,
        hallwayVariant,
        hallwayJogOffset,
    };
}
