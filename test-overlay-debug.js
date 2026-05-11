import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { generateOverlayBuffer } from './src/utils/overlayEngine.js';

async function test() {
    const imageUrl = "https://i.ibb.co/L5hY4Lg/example.png"; // or any generic image
    const title = "Cropped Trench Outfits: 7 Style Ideas";
    const template = "big_center";
    
    console.log("1. Fetching image...");
    let imageBuffer;
    try {
        const res = await axios.get("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600", { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(res.data);
    } catch (e) {
        console.error("Fetch failed", e);
        return;
    }
    
    console.log("2. Resizing...");
    let resizedBuffer = await sharp(imageBuffer)
        .resize(1080, 1920, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();
        
    console.log("3. Generating overlay PNG...");
    let overlayBuffer = generateOverlayBuffer(title, template);
    
    if (!overlayBuffer) {
        console.error("Overlay buffer was null!");
        return;
    }
    
    fs.writeFileSync("debug-overlay-only.png", overlayBuffer);
    console.log("Wrote debug-overlay-only.png");

    console.log("4. Compositing...");
    const overlayPng = await sharp(overlayBuffer).png().toBuffer();
    const compositedBuffer = await sharp(resizedBuffer)
        .composite([{ input: overlayPng, top: 0, left: 0, blend: 'over' }])
        .jpeg({ quality: 88 })
        .toBuffer();
    
    fs.writeFileSync("debug-composited.jpg", compositedBuffer);
    console.log("Wrote debug-composited.jpg - SUCCESS!");
}
test().catch(console.error);
