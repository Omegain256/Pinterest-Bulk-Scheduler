import { generateOverlayBuffer } from './src/utils/overlayEngine.js';

console.log("Calling generateOverlayBuffer");
try {
    let overlayBuffer = generateOverlayBuffer("15 AWESOME OUTFIT IDEAS", "big_center");
    console.log("Buffer size:", overlayBuffer.length);
} catch (e) {
    console.error("Error:", e);
}
console.log("Done calling");
