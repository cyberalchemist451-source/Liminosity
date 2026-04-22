export type Rng = () => number;

export function mulberry32(seed: number): Rng {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hash2(a: number, b: number): number {
    let h = 2166136261 >>> 0;
    h = Math.imul(h ^ a, 16777619);
    h = Math.imul(h ^ b, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 16777619);
    return h >>> 0;
}

export function rngFor(seed: number, index: number): Rng {
    return mulberry32(hash2(seed, index));
}

export function rand(rng: Rng, min: number, max: number): number {
    return min + rng() * (max - min);
}

export function randInt(rng: Rng, min: number, max: number): number {
    return Math.floor(rand(rng, min, max + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
    return arr[Math.floor(rng() * arr.length) % arr.length];
}
