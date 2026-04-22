export type Vec3 = [number, number, number];

export type FloorMaterial = 'carpet' | 'tile' | 'concrete' | 'vinyl' | 'wood';

export type ThemeId =
    | 'ufo'
    | 'ai-history'
    | 'forbidden-knowledge'
    | 'silence'
    | 'wendigo-reliquary'
    | 'mycelium-cathedral'
    | 'mirror-loop'
    | 'infinite-library'
    | 'drowned-office'
    | 'tangerine-void'
    | 'hall-of-unfinished-prayers'
    | 'static-cathedral'
    | 'bone-orchard'
    | 'red-vending'
    | 'hollow-saint'
    | 'last-color'
    | 'carpet-forever'
    | 'tiled-sea'
    | 'fractal-chapel'
    | 'marine-biology'
    | 'forest-grove'
    | 'void-shaft'
    | 'solar-system'
    | 'bridge-of-faces'
    | 'pool-at-midnight'
    | 'server-farm'
    | 'dental-suite'
    | 'parking-garage'
    | 'waiting-room-eternal'
    | 'observation-mirror'
    | 'preservation-jars'
    | 'wax-museum'
    | 'cold-storage'
    | 'subway-afterhours'
    | 'abandoned-greenhouse'
    | 'clockwork-atrium'
    | 'radio-relay'
    | 'museum-of-rust'
    | 'motel-203'
    | 'corridor-to-self'
    | 'anechoic-foam'
    | 'taxidermy-lounge'
    | 'nursery-frozen'
    | 'phonograph-archive'
    | 'art-gallery-wrong'
    | 'locker-room-endless'
    | 'hospital-wing'
    | 'observatory-room'
    | 'dripping-chapel'
    | 'childhood-wrong'
    | 'wallpaper-archive'
    | 'gravity-adjusted'
    | 'procedural';

// Rare humanoid entities that occasionally stand in deeper rooms. Purely
// decorative - they don't block the player, but the silhouette breaks the
// assumption that the player is alone in the museum.
export type DwellerKind =
    | 'grey'
    | 'faceless-suit'
    | 'slenderman'
    | 'observer'
    | 'mothman';

export type DwellerSpec = {
    kind: DwellerKind;
    // Local (x, z) offset from the room origin; height is fixed to 0 (floor).
    position: [number, number];
    // Facing angle around Y, radians.
    facing: number;
};

export type FontKey =
    | 'default'
    | 'cinzel'
    | 'plex-mono'
    | 'cormorant'
    | 'major-mono'
    | 'syne-mono'
    | 'fraktur'
    | 'space-mono'
    | 'unifraktur';

export type AudioTone = {
    // Base drone frequency (Hz). 30-65 feels museum-subterranean; 65-120 is brighter.
    baseHz: number;
    // Harmonic partials (multipliers of baseHz).
    partials: number[];
    // LFO rate on filter sweep (Hz). Slow = ~0.04, fluttery = ~0.2.
    lfoHz: number;
    // Bandpass centre of the noise bed (Hz).
    noiseCenterHz: number;
    // Noise bed gain (0..1).
    noiseGain: number;
    // Pitch of a sparse melodic bell (semitones above baseHz, as a ratio).
    bellRatio: number;
    // How often bells ring (seconds average).
    bellEverySec: number;
};

export type Theme = {
    id: ThemeId;
    name: string;
    subtitle: string;
    wallColor: string;
    accentColor: string;
    floorMaterial: FloorMaterial;
    lightColor: string;
    lightIntensity: number;
    ceiling: number;
    font: FontKey;
    titleLetterSpacing?: number;
    bodyAlign?: 'center' | 'left' | 'right';
    audioTone: AudioTone;
    infographic: {
        title: string;
        body: string[];
    };
};

export type Pillar = {
    position: Vec3;
    size: Vec3;
    color: string;
};

// Variants for the corridor that leads OUT of a room.
//
// Most variants share a straight-AABB walkable footprint along +Z centered
// on the from-room's origin.x, with the exit doorway cut from the back
// wall. 'stairs' additionally adds a one-way climb.
//
// The two 'l-' variants are different: they exit through the *side* wall
// of the from-room (left or right, near the back), travel perpendicular
// for a short spur, turn 90 degrees, and then continue +Z to the next
// room's front doorway. This also laterally offsets the next room's
// origin so the gallery snakes sideways instead of running in a perfect
// column.
export type HallwayVariant =
    | 'straight'
    | 'curved'
    | 'stairs'
    | 'bridge'
    | 'aquarium'
    | 'jog'
    | 'l-left'
    | 'l-right';

export type RoomSpec = {
    index: number;
    theme: Theme;
    width: number;
    depth: number;
    ceilingHeight: number;
    tilt: number;
    pillars: Pillar[];
    origin: Vec3;
    entryZ: number;
    exitZ: number;
    hallwayLength: number;
    hallwayWidth: number;
    doorwayWidth: number;
    doorwayHeight: number;
    // Optional surprise: a silhouette figure standing somewhere in the room.
    dweller?: DwellerSpec;
    // When true the generator has rolled a dramatic soaring ceiling for this
    // room - used by ceiling-aware artifacts that want to reach higher.
    cathedral?: boolean;
    // When true the back wall has no doorway (collision blocks it). Used for
    // milestones like the Void Shaft where the only way forward is the hole
    // in the floor.
    sealedBack?: boolean;
    // Optional: the variant of the hallway that leads OUT of this room toward
    // the next one. Defaults to 'straight' when absent.
    hallwayVariant?: HallwayVariant;
    // Lateral offset of the middle segment for 'jog' variant hallways.
    // Positive values jog right (+X), negative values jog left (-X). Unused
    // for other variants.
    hallwayJogOffset?: number;
};
