# Liminal Gallery — Design Spec

A first-person, browser-based walking simulator that feels like drifting through a
half-remembered, twisted museum. Rooms are procedurally selected and stitched
together by long, featureless hallways. Each room houses a themed artifact
(statue / model / infographic) that hints at the room's subject.

Route: `/qualia-fields/liminal-gallery`

---

## 1. Goals & Tone

- **Liminal / backrooms**: empty, over-lit, slightly wrong. Hum of fluorescents.
- **Cohesive but varied**: common material language (drywall, carpet, concrete,
  tile, vinyl), varied proportions, lighting temps, ceiling heights.
- **Contained**: player is always within walls, can never leave the gallery.
- **Progressive surrealism**: rooms become steadily weirder (off-kilter walls,
  impossible geometry, wrong colors) as the player moves deeper.
- **Browser-perf friendly**: pure primitives (boxes, cylinders, spheres, text),
  no external assets.

## 2. Controls

| Input | Action |
|-------|--------|
| `W/A/S/D` (or arrows) | Move |
| Mouse | Look (pointer-locked) |
| `Space` | Jump |
| `Shift` | Sprint (optional polish) |
| `Esc` | Release mouse / open pause menu |
| `P` | Pause |
| `F2` | Screenshot |

First-person camera at eye height `1.65`. Player radius `0.35`. Simple gravity
(`-24 m/s²`), jump impulse `8 m/s`.

## 3. World Layout

The gallery is built along the `+Z` axis. Sections alternate:

```
[Room 0] — [Hall 0] — [Room 1] — [Hall 1] — [Room 2] — ...
```

- **Room size**: 16×16 to 28×28 with ceiling 4–7.
- **Hallway length**: ≥ 24 units so next room has time to spawn.
- **Hallway width**: 3.5, ceiling 3.

The player's Z position is used to determine "current section". When they cross
into a hallway, the `RoomManager` generates the **next** room ahead of them if
it doesn't exist yet. Rooms two or more sections behind the player are culled
from the scene graph (kept in state) to keep triangle count bounded.

Walls/floors/ceilings are simple boxes. Doorways are represented as gaps in the
shared wall between room and hallway.

## 4. Procedural Generation

`roomGenerator.ts` consumes:

- `index` — section index (0, 1, 2, ...)
- `rng` — seeded `mulberry32` PRNG derived from a global seed + index
- `themeSpec` — selected theme for the room

Outputs a `RoomSpec`:

```ts
type RoomSpec = {
  index: number;
  theme: Theme;
  width: number;          // X
  depth: number;          // Z
  ceilingHeight: number;
  floorMaterial: 'carpet'|'tile'|'concrete'|'vinyl'|'wood';
  wallColor: THREE.ColorRepresentation;
  accentColor: THREE.ColorRepresentation;
  lightColor: THREE.ColorRepresentation;
  lightIntensity: number;
  tilt: number;           // 0..~0.08 — surreal twist, grows with depth
  pillars: Vec3[];        // decorative interior obstacles
  wallOffsets: { north, south, east, west };
  origin: Vec3;           // world position of room center
  entryZ: number;         // world Z of doorway from previous hallway
  exitZ: number;          // world Z of doorway to next hallway
};
```

Each room is positioned so its entry doorway aligns with the previous hallway's
exit.

### Theme selection

The first three rooms are **scripted**:

1. **UFO / Roswell** — metallic saucer centerpiece with rotating ring of light,
   "Known Sightings" infographic.
2. **AI History** — chrome bust of a thinking machine on a plinth, timeline
   infographic (Turing → perceptron → transformer).
3. **Forbidden Knowledge / Esoteric** — obelisk sigil tower with floating tome,
   "Tree of Unspeakable Names" diagram.

Rooms 4+ are drawn from a pool of surreal themes:

- Mycelium Cathedral, Mirror Loop, Infinite Library, The Drowned Office,
  Tangerine Void, Hall of Unfinished Prayers, Static Cathedral, Bone Orchard,
  Red Vending Machines (backrooms nod), Hollow Saint, The Last Color,
  Carpet Forever, Tiled Sea, etc.

Procedural artifacts use parametric primitives (tori, extruded text, stacks of
boxes) combined with the room's theme palette.

### Surreal drift

`tilt = min(0.08, index * 0.008)` applied to ceiling geometry & some pillars.
Light color drifts from clinical white toward sickly amber/teal/magenta.
Audio pitch/flicker also drift if we enable ambient audio later.

## 5. Artifacts

Every room has exactly one **centerpiece artifact** (statue / model) on a
plinth near the room center, plus one **infographic wall panel** on the main
back wall, rendered with `@react-three/drei`'s `Text` primitive.

Artifacts are React components keyed off `theme.id`; unknown themes fall back
to `ProceduralArtifact` which builds a stack of tori or a twisted column from
the theme's palette + rng.

## 6. Collision

Per-frame AABB check against:

- Current room's 4 walls (expanded to cover doorway only if not aligned).
- Current hallway's 2 long walls.
- End caps of the hallway (closed when neighbor room isn't generated yet).

Uses axis-separated sliding resolution (standard "push along normal" for each
axis separately). Player radius inflates the room AABB inward.

A doorway is a 2.2-wide gap centered on the hallway axis; when the player's
`|x - hallCenterX| < 1.1` while near the wall, collision is skipped for that
wall segment.

## 7. Lighting

- Global `ambientLight` at low intensity (0.08–0.12) for liminal gloom.
- Ceiling fluorescent fixtures in each room: `rectAreaLight` or `pointLight`
  with a flickering intensity modulator (rare drop, then return).
- Hallways: evenly spaced ceiling lights, every 4 units.
- All lights cast shadows (`castShadow` + receive on floors/walls).
- Shadow map: `PCFSoftShadowMap`, `mapSize 1024`.

## 8. UI / HUD

Overlay on top of the Canvas (standard absolute-positioned divs):

- **Top-left**: section counter + current theme name.
- **Top-right**: icon buttons — Pause, Screenshot, Exit.
- **Center**: crosshair dot.
- **Pause menu**: full-screen dim, Resume / Screenshot / Exit to hub.
- **Click-to-start** overlay until pointer is locked.

Screenshot implementation: reads the renderer canvas via `toDataURL('image/png')`
after a forced `gl.render()` call, triggers an `<a download>` click.

## 9. State

A single `galleryStore` (zustand):

```ts
{
  seed: number;
  sections: RoomSpec[];       // generated
  currentIndex: number;       // derived from player Z
  paused: boolean;
  pointerLocked: boolean;
  ensureRoomAt(i: number): RoomSpec;
}
```

## 10. File Layout

```
src/app/qualia-fields/liminal-gallery/
  page.tsx                     # entry route
  SPEC.md                      # (this file)

src/components/gallery/
  GalleryExperience.tsx        # client wrapper + Canvas + HUD
  GalleryScene.tsx             # R3F scene
  PlayerController.tsx         # WASD + pointer lock + physics + collision
  RoomManager.tsx              # monitors player, ensures next room exists
  Room.tsx                     # renders one RoomSpec
  Hallway.tsx                  # renders hallway between rooms
  Infographic.tsx              # wall panel w/ title + body text
  Lighting.tsx                 # fixture helpers
  GalleryHUD.tsx               # overlay UI
  artifacts/
    UFOArtifact.tsx
    AIHistoryArtifact.tsx
    EsotericArtifact.tsx
    ProceduralArtifact.tsx

src/lib/gallery/
  types.ts
  themes.ts                    # scripted + procedural theme pool
  rng.ts                       # mulberry32 + seeded helpers
  roomGenerator.ts             # RoomSpec factory
  galleryStore.ts              # zustand store
  collision.ts                 # AABB slide solver
```

## 11. Out of scope (for v1)

- Multiplayer, saving, leaderboards.
- Loaded GLTF meshes or textures.
- Spatial audio (can be added with `<PositionalAudio />` later).
- Mobile touch controls (desktop-first).
