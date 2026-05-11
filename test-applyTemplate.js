import fs from 'fs';
import sharp from 'sharp';
import { generateOverlayBuffer } from './src/utils/overlayEngine.js';

async function test() {
    const imageUrl = "https://ballettonet.co/wp-content/uploads/2026/04/cropped-Screenshot-2026-04-02-at-7.02.34-PM-1-150x121.png";
    const title = "Your Cropped Trench Coat Moment";
    const template = "big_center";
    
    let imageBuffer;
    try {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
    } catch (err) {
        console.warn(`[TEMPLATE] Fetch failed for ${imageUrl}: ${err.message}`);
        return;
    }

    let resizedBuffer;
    try {
        resizedBuffer = await sharp(imageBuffer)
            .resize(1080, 1920, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (err) {
        console.warn(`[TEMPLATE] sharp resize failed: ${err.message}`);
        return;
    }

    let overlayBuffer;
    try {
        overlayBuffer = generateOverlayBuffer(title, template);
        console.log(`[TEMPLATE] Overlay generated`);
    } catch (err) {
        console.error(`[TEMPLATE] Overlay render FAILED: ${err.message}`, err.stack);
        return;
    }

    let compositedBuffer;
    try {
        const overlayPng = await sharp(overlayBuffer).png().toBuffer();
        compositedBuffer = await sharp(resizedBuffer)
            .composite([{ input: overlayPng, top: 0, left: 0, blend: 'over' }])
            .jpeg({ quality: 88 })
            .toBuffer();
        console.log(`[TEMPLATE] Composite success`);
    } catch (err) {
        console.error(`[TEMPLATE] Composite FAILED: ${err.message}`, err.stack);
        return;
    }
}
test();
