import fs from 'fs';
import sharp from 'sharp';
import axios from 'axios';
import { generateOverlayBuffer } from './src/utils/overlayEngine.js';

async function test() {
    const rawBuffer = await axios.get("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600", { responseType: 'arraybuffer' }).then(r => Buffer.from(r.data));
    const overlayPngBuffer = generateOverlayBuffer("Cropped Trench Outfits", 'big_center');
    const overlayPngReady = await sharp(overlayPngBuffer).png().toBuffer();
    const compositedBuffer = await sharp(rawBuffer)
        .resize(1080, 1920, { fit: 'cover' })
        .composite([{ input: overlayPngReady, top: 0, left: 0, blend: 'over' }])
        .jpeg({ quality: 90 })
        .toBuffer();
    fs.writeFileSync("test-composite-now.jpg", compositedBuffer);
}
test();
