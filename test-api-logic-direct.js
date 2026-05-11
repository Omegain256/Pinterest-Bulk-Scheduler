import fs from 'fs';
import sharp from 'sharp';
import axios from 'axios';
import { generateOverlayBuffer } from './src/utils/overlayEngine.js';

async function test() {
    // Mimicking api/generate Phase 3
    const extractedNum = "15";
    const cleanShortTitle = "Cropped Trench Outfits";
    const overlayTitle = `${extractedNum} ${cleanShortTitle}`.trim();
    
    // The exact same line as api/generate
    const template = 'big_center';
    console.log("Generating buffer for title:", overlayTitle);
    const overlayPngBuffer = generateOverlayBuffer(overlayTitle, template);
    console.log("Overlay buffer created, length:", overlayPngBuffer.length);

    const rawBuffer = await axios.get("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600", { responseType: 'arraybuffer' }).then(r => Buffer.from(r.data));
    
    // Composite Image + Canvas PNG overlay using sharp (PNG compositing works everywhere)
    console.log("Starting composite...");
    const overlayPngReady = await sharp(overlayPngBuffer).png().toBuffer();
    const compositedBuffer = await sharp(rawBuffer)
        .resize(1080, 1920, { fit: 'cover' })
        .composite([{ input: overlayPngReady, top: 0, left: 0, blend: 'over' }])
        .jpeg({ quality: 90 })
        .toBuffer();

    console.log("Composite successful, length:", compositedBuffer.length);
}
test();
