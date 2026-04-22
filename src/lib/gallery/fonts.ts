import type { FontKey } from './types';

// Map a FontKey to a remote .woff/.ttf URL that drei's <Text> (via Troika) can
// load. `undefined` falls back to the bundled SDF font. All URLs are public
// mirrors of the Fontsource npm packages.
export const FONT_URLS: Record<FontKey, string | undefined> = {
    default: undefined,
    cinzel:
        'https://cdn.jsdelivr.net/npm/@fontsource/cinzel/files/cinzel-latin-400-normal.woff',
    'plex-mono':
        'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
    cormorant:
        'https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff',
    'major-mono':
        'https://cdn.jsdelivr.net/npm/@fontsource/major-mono-display/files/major-mono-display-latin-400-normal.woff',
    'syne-mono':
        'https://cdn.jsdelivr.net/npm/@fontsource/syne-mono/files/syne-mono-latin-400-normal.woff',
    fraktur:
        'https://cdn.jsdelivr.net/npm/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff',
    'space-mono':
        'https://cdn.jsdelivr.net/npm/@fontsource/space-mono/files/space-mono-latin-400-normal.woff',
    unifraktur:
        'https://cdn.jsdelivr.net/npm/@fontsource/unifrakturcook/files/unifrakturcook-latin-700-normal.woff',
};

export function fontUrlFor(key: FontKey): string | undefined {
    return FONT_URLS[key];
}
