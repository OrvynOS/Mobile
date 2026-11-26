// Runtime polyfills (random values for crypto, Buffer). Imported first by app/_layout.tsx (ES imports are
// evaluated in order, so this runs before anything that needs it).
import "react-native-get-random-values";
import { Buffer } from "buffer";

const g = globalThis as { Buffer?: typeof Buffer };
g.Buffer ??= Buffer;
