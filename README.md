# Liminosity

A procedurally generated liminal museum rendered with React Three Fiber.
Wander an unbounded corridor of rooms whose themes, artifacts, infographics, and
architecture drift further from the ordinary the deeper you go.

## Controls

| Input            | Action              |
| ---------------- | ------------------- |
| Click            | Capture mouse       |
| `W` `A` `S` `D`  | Move                |
| Mouse            | Look                |
| `Space`          | Jump                |
| `Esc`            | Release mouse / menu |
| `F3`             | Toggle diagnostics  |

## Running locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Scripts

- `npm run dev` - Next.js dev server (Turbopack)
- `npm run build` - production build
- `npm start` - start the production server
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript check

## Notable rooms

- **Room 1** UFO hall
- **Room 2** AI history
- **Room 3** Apocrypha / forbidden lore
- **Room 8** Museum of Rust (Mars + Phobos + Deimos)
- **Room 9** Fractal Chapel (Alex Grey style)
- **Room 15** Marine Biology
- **Room 17** The Grove (outdoor moonlit forest)
- **Room 22** The Fractal Hole (Mandelbrot fall)
- **Room 27** Bridge of Faces
- **Room 33** Solar System

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- React Three Fiber + drei + three.js
- Zustand state management
- Procedural audio via Web Audio API
- Procedural textures via Canvas 2D
