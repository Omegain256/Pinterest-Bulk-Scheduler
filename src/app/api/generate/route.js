import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import sharp from 'sharp';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { interBoldBuffer } from './font-data.js';

// Register the Inter font from the embedded base64 buffer.
// This is platform-agnostic: no file paths, no process.cwd(), no filesystem access.
GlobalFonts.register(interBoldBuffer, 'Inter');
console.log('[Canvas] Font registered. Families count:', GlobalFonts.families?.length ?? 'N/A');


// genAI will be initialized dynamically per-request to support user-provided keys

// ─── Canvas Overlay Engine ───────────────────────────────────────────────────
// Draws niche-specific Pinterest text overlays using @napi-rs/canvas.
// Returns a PNG Buffer that sharp can composite on any platform (no librsvg needed).

function wrapWords(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let cur = words[0] || '';
    for (let i = 1; i < words.length; i++) {
        if ((cur + ' ' + words[i]).length <= maxChars) {
            cur += ' ' + words[i];
        } else {
            lines.push(cur);
            cur = words[i];
        }
    }
    lines.push(cur);
    return lines;
}

// Draw a vertical gradient rect filling the canvas
function drawGradient(ctx, w, h, fromY, opacity) {
    const grad = ctx.createLinearGradient(0, fromY, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${opacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, fromY, w, h - fromY);
}

// Draw bold text with drop shadow
function drawText(ctx, text, x, y, { fontSize = 84, weight = 'bold', color = '#ffffff', shadowBlur = 14, shadowOpacity = 0.9, strokeWidth = 0, align = 'left' } = {}) {
    ctx.save();
    // Always specify 'Inter' explicitly — the font we registered from public/fonts/Inter-Bold.ttf
    ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = align;
    ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    if (strokeWidth > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

async function generateTextOverlayBuffer(title, category) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H); // transparent base

    // ── Style 1: Beauty & Makeup ────────────────────────────────────────────
    if (category === 'Beauty & Makeup') {
        drawGradient(ctx, W, H, H * 0.54, 0.72);
        const lines = wrapWords(title, 16).slice(0, 3);
        const lineH = 110;
        const startY = H - 115 - (lines.length - 1) * lineH;
        lines.forEach((l, i) => drawText(ctx, l, 60, startY + i * lineH, { fontSize: 100, weight: '900', shadowBlur: 18, strokeWidth: 4 }));
    }

    // ── Style 2: Hair Styling ───────────────────────────────────────────────
    else if (category === 'Hair Styling') {
        const lines = wrapWords(title, 24).slice(0, 3);
        const lineH = 72;
        const pad = 36;
        const boxW = 880;
        const boxH = lines.length * lineH + pad * 2;
        const boxX = (W - boxW) / 2;
        const boxY = H - boxH - 65;
        // White box with border
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 10;
        ctx.strokeRect(boxX + 5, boxY + 5, boxW - 10, boxH - 10);
        lines.forEach((l, i) => drawText(ctx, l, W / 2, boxY + pad + (i + 0.82) * lineH, { fontSize: 64, weight: '700', color: '#111111', shadowBlur: 0, shadowOpacity: 0, align: 'center' }));
    }

    // ── Style 3: Fashion & Outfits ──────────────────────────────────────────
    else if (category === 'Fashion & Outfits') {
        const upper = title.toUpperCase();
        const longestWordLen = Math.max(...upper.split(' ').map(w => w.length));
        let fontSize = 118;
        if (longestWordLen > 6) fontSize = Math.max(70, 118 - ((longestWordLen - 6) * 10));
        const lines = wrapWords(upper, 14).slice(0, 4);
        const lineH = Math.round(fontSize * 1.1);
        const midY = 660;
        const startY = midY - ((lines.length - 1) * lineH) / 2;
        lines.forEach((l, i) => drawText(ctx, l, W / 2, startY + i * lineH, { fontSize, weight: '900', shadowBlur: 12, strokeWidth: 5, align: 'center' }));
        // Arrow
        const arrowY = startY + lines.length * lineH + 50;
        drawText(ctx, '\u2192', W / 2, arrowY, { fontSize: 90, weight: 'normal', shadowBlur: 10, align: 'center' });
        // Subtitle
        const subtitleNum = firstWord.match(/^\d+/)?.[0];
        const subtitle = subtitleNum ? `${subtitleNum}+ inspirations` : 'See all inspirations';
        ctx.save();
        ctx.font = '300 45px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(subtitle, W / 2, H - 48);
        ctx.restore();
        // Sparkle decorations
        [[875, midY - 230], [125, midY + 40], [865, midY + 200], [120, midY - 150]]
            .forEach(([sx, sy]) => {
                ctx.save();
                ctx.font = '46px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(255,255,255,0.88)';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 6;
                ctx.fillText('\u2726', sx, sy);
                ctx.restore();
            });
    }

    // ── Style 4: Nails & Beauty ─────────────────────────────────────────────
    else if (category === 'Nails & Beauty') {
        drawGradient(ctx, W, H, H * 0.58, 0.68);
        const words = title.split(' ');
        const bigWord = words[0] || '';
        const restUpper = words.slice(1).join(' ').toUpperCase();
        const restLines = wrapWords(restUpper, 13).slice(0, 3);
        drawText(ctx, bigWord, 75, 1060, { fontSize: 170, weight: '900', shadowBlur: 18, strokeWidth: 6 });
        restLines.forEach((l, i) => {
            const isFirst = i === 0;
            drawText(ctx, l, 75, isFirst ? 1150 : 1150 + 75 + (i - 1) * 112, {
                fontSize: isFirst ? 62 : 108,
                weight: isFirst ? '400' : '700',
                shadowBlur: 14,
                strokeWidth: isFirst ? 2 : 4
            });
        });
    }

    // ── Fallback ────────────────────────────────────────────────────────────
    else {
        drawGradient(ctx, W, H, H * 0.42, 0.87);
        const lines = wrapWords(title, 20).slice(0, 3);
        const startY = H - 120 - (lines.length - 1) * 95;
        lines.forEach((l, i) => drawText(ctx, l, 70, startY + i * 95, { fontSize: 84, weight: '900', strokeWidth: 4 }));
    }

    return canvas.toBuffer('image/png');
}

// ── legacy stub kept for reference — no longer used
function generateSVGOverlay(title, category) {
    // ── Style 1: Beauty & Makeup ─────────────────────────────────────────────
    // Bold white text, bottom-left, no box. Dark clothing in photo = natural contrast.
    if (category === 'Beauty & Makeup') {
        const lines = wrapWords(title, 16).slice(0, 3);
        const lineH = 105;
        const startY = 1385 - (lines.length - 1) * lineH;
        const texts = lines.map((l, i) =>
            `<text x="60" y="${startY + i * lineH}" font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="100" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="4" stroke-linejoin="round" paint-order="stroke fill" filter="url(#sh)">${esc(l)}</text>`
        ).join('');
        return `<svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="sh"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.95)"/></filter>
                <linearGradient id="g" x1="0%" y1="54%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
                    <stop offset="100%" stop-color="rgba(0,0,0,0.70)"/>
                </linearGradient>
            </defs>
            <rect width="1000" height="1500" fill="url(#g)"/>
            ${texts}
        </svg>`;
    }

    // ── Style 2: Hair Styling ────────────────────────────────────────────────
    // Black bold text inside a white rect with thick black border, bottom-center.
    if (category === 'Hair Styling') {
        const lines = wrapWords(title, 24).slice(0, 3);
        const lineH = 72;
        const pad = 36;
        const boxW = 880;
        const boxH = lines.length * lineH + pad * 2;
        const boxX = (1000 - boxW) / 2;
        const boxY = 1500 - boxH - 65;
        const texts = lines.map((l, i) =>
            `<text x="500" y="${boxY + pad + (i + 0.82) * lineH}" text-anchor="middle" font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif" font-weight="700" font-size="64" fill="#111111">${esc(l)}</text>`
        ).join('');
        return `<svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
            <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="#ffffff"/>
            <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="none" stroke="#111111" stroke-width="10"/>
            ${texts}
        </svg>`;
    }

    // ── Style 3: Fashion & Outfits ───────────────────────────────────────────
    // ALL-CAPS bold white text centered in middle. Sparkle decorations. Arrow. Small subtitle.
    if (category === 'Fashion & Outfits') {
        const upper = title.toUpperCase();

        // Dynamically scale font size if there are very long words (e.g. "CONCERT", "SCIENTIST")
        const longestWordLen = Math.max(...upper.split(' ').map(w => w.length));
        let fontSize = 118;
        if (longestWordLen > 6) {
            fontSize = Math.max(70, 118 - ((longestWordLen - 6) * 10)); // shrink by 10px per extra char, floor at 70
        }

        const lines = wrapWords(upper, 14).slice(0, 4);
        const lineH = Math.round(fontSize * 1.1);
        const midY = 660;
        const startY = midY - ((lines.length - 1) * lineH) / 2;
        const texts = lines.map((l, i) =>
            `<text x="500" y="${startY + i * lineH}" text-anchor="middle" font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill" filter="url(#sh)">${esc(l)}</text>`
        ).join('');
        const arrowY = startY + lines.length * lineH + 50;
        const sparkles = [
            [875, midY - 230], [125, midY + 40], [865, midY + 200], [120, midY - 150]
        ].map(([sx, sy]) => `<text x="${sx}" y="${sy}" text-anchor="middle" font-family="'DejaVu Sans', sans-serif" font-size="46" fill="#ffffff" opacity="0.88">&#10022;</text>`).join('');
        const firstWord = title.split(' ')[0];
        const subtitle = /^\d+/.test(firstWord) ? `${firstWord}+ inspirations` : 'See all inspirations';
        return `<svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.65)"/></filter></defs>
            ${texts}
            <text x="500" y="${arrowY}" text-anchor="middle" font-family="'Liberation Sans', 'DejaVu Sans', sans-serif" font-size="90" fill="#ffffff" filter="url(#sh)">&#8594;</text>
            <text x="500" y="1452" text-anchor="middle" font-family="'Liberation Sans', 'DejaVu Sans', sans-serif" font-weight="300" font-size="45" fill="#ffffff" opacity="0.85">${esc(subtitle)}</text>
            ${sparkles}
        </svg>`;
    }

    // ── Style 4: Nails & Beauty ──────────────────────────────────────────────
    // Mixed-weight serif: large number, smaller italic subtitle, large bold keyword. Bottom-left.
    if (category === 'Nails & Beauty') {
        const words = title.split(' ');
        const bigWord = words[0] || '';
        const restUpper = words.slice(1).join(' ').toUpperCase();
        const restLines = wrapWords(restUpper, 13).slice(0, 3);
        const bigText = `<text x="75" y="1060" font-family="'Liberation Serif', 'DejaVu Serif', Georgia, serif" font-weight="900" font-size="170" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="6" stroke-linejoin="round" paint-order="stroke fill" filter="url(#sh)">${esc(bigWord)}</text>`;
        const subTexts = restLines.map((l, i) => {
            const isFirst = i === 0;
            const fs = isFirst ? 62 : 108;
            const fw = isFirst ? '400' : '700';
            const yp = isFirst ? 1150 : (1150 + 75 + (i - 1) * 112);
            return `<text x="75" y="${yp}" font-family="'Liberation Serif', 'DejaVu Serif', Georgia, serif" font-weight="${fw}" font-size="${fs}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="${isFirst ? 2 : 4}" stroke-linejoin="round" paint-order="stroke fill" filter="url(#sh)">${esc(l)}</text>`;
        }).join('');
        return `<svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="7" flood-color="rgba(0,0,0,0.85)"/></filter>
                <linearGradient id="g" x1="0%" y1="58%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
                    <stop offset="100%" stop-color="rgba(0,0,0,0.65)"/>
                </linearGradient>
            </defs>
            <rect width="1000" height="1500" fill="url(#g)"/>
            ${bigText}
            ${subTexts}
        </svg>`;
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    const lines = wrapWords(title, 20).slice(0, 3);
    const startY = 1380 - (lines.length - 1) * 92;
    const texts = lines.map((l, i) =>
        `<text x="70" y="${startY + i * 92}" font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="84" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="4" stroke-linejoin="round" paint-order="stroke fill">${esc(l)}</text>`
    ).join('');
    return `<svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0%" y1="42%" x2="0%" y2="100%"><stop offset="0%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,0.85)"/></linearGradient></defs>
        <rect width="1000" height="1500" fill="url(#g)"/>
        ${texts}
    </svg>`;
} // end legacy stub

export async function POST(req) {
    try {
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.APP_API_KEY?.trim();

        if (!apiKey || apiKey !== expectedKey) {
            console.error(`[AUTH FAILED] Received length: ${apiKey?.length}, Expected length: ${expectedKey?.length}`);
            return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        const { urls, niche, aspectRatio, geminiKey } = await req.json();

        const effectiveGeminiKey = geminiKey || process.env.GEMINI_API_KEY;

        if (!urls || urls.length === 0) {
            return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
        }

        if (!effectiveGeminiKey || !process.env.IMGBB_API_KEY) {
            return NextResponse.json({ error: 'API Keys are missing (Gemini or ImgBB)' }, { status: 500 });
        }

        // Initialize Gemini models with the effective key
        const genAI = new GoogleGenerativeAI(effectiveGeminiKey);
        // Using gemini-2.5-flash (confirmed working on this key)
        // Using imagen-4.0-fast-generate-001 (confirmed working on this key)
        const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const imageModel = genAI.getGenerativeModel({ model: "imagen-4.0-fast-generate-001" });

        // Phase 4: Niche Aesthetic Prompt Engineering Lookups — matched to reference styles
        const nichePrompts = {
            "Beauty & Makeup": "Extreme close-up portrait of strictly one single beautiful woman with dramatic, flawless makeup. No other people, no crowds, no secondary figures. The subject must look entirely human and real — shot on 35mm film, skin pores visible, natural imperfections. Completely avoid plastic, smooth, or 'AI-generated' looks. The subject is centered, face filling the top 65% of the frame. She wears a dark-colored top — ideally a black turtleneck or dark ribbed sweater — which fills the lower portion of the frame and provides a naturally dark zone. Studio-quality continuous lighting, slightly warm, high contrast. Blurred neutral background.",
            "Hair Styling": "Bright, natural-light lifestyle portrait of strictly one single woman showing off her hairstyle. No other people in background or foreground. The hair texture and skin MUST look extraordinarily realistic, like an unedited smartphone photo or high-end editorial film photography. Avoid any shiny, plastic, over-smoothed 'AI' CGI look. Shot from chest-up, facing the camera directly with a genuine smile. She wears a plain white or light-colored casual t-shirt. Room background is soft white or cream-colored walls with minimal decor. Airy, clean, relatable aesthetic. Photo feels authentic.",
            "Fashion & Outfits": "Full-body or three-quarter body fashion shot of strictly one single stylish woman showing a complete outfit. No other people, no background crowds. The clothing fabric must look real and textured. Shot on an iPhone in natural daylight, authentic, candid blogger style. Avoid any plastic, perfectly-smoothed CGI appearance. The scene has neutral, muted tones — beige, cream, warm grey walls. Could be a mirror selfie or a posed shot in an aesthetic bedroom or minimalist apartment. Photo has a gentle film-grain quality.",
            "Nails & Beauty": "Extreme macro close-up of exactly one single woman's hand and nails, fingers displayed elegantly. Only one hand should be the focus. No other people. Skin texture, pores, and cuticles must be visibly realistic and human, like an unedited raw DSLR photo. Avoid perfectly smooth plastic AI hands. Soft natural window light catches the texture. In the background, soft out-of-focus fabric is visible — a chunky cream knit sweater sleeve. Intimate, feminine, tactile aesthetic."
        };

        // Niche-specific guidance injected into the Gemini imagePrompt instruction
        const nicheImageTips = {
            "Beauty & Makeup": "CRITICAL: There must be exactly ONE person. Must look intensely real, photorealistic, with real skin texture (pores visible). EXPLICITLY FORBID plastic, over-smoothed, or CGI aesthetics. Subject MUST wear a dark top. Do NOT include text.",
            "Hair Styling": "CRITICAL: There must be exactly ONE person. Must look like a real, authentic, unedited photograph of a human. EXPLICITLY FORBID plastic, 3D render, or 'AI' look. Bright/airy. Subject's chest area plain/light. Do NOT include text.",
            "Fashion & Outfits": "CRITICAL: There must be exactly ONE person. Must look like a candid real iPhone or 35mm film photograph. Fabric and skin must be realistic. EXPLICITLY FORBID plastic or CGI look. Full body visible. Do NOT include text.",
            "Nails & Beauty": "CRITICAL: There must be exactly ONE person. Hands MUST look hyper-realistic with real human skin texture and imperfect cuticles. EXPLICITLY FORBID plastic, smooth AI hands. Focus on texture. Do NOT include text."
        };

        const encoder = new TextEncoder();
        const urlOccurrences = {};

        const stream = new ReadableStream({
            async start(controller) {
                // Process sequentially to respect rate limits
                for (let i = 0; i < urls.length; i++) {
                    const url = urls[i];
                    // Track variations for duplicate URLs
                    urlOccurrences[url] = (urlOccurrences[url] || 0) + 1;
                    const variationIndex = urlOccurrences[url];
                    const isVariation = variationIndex > 1;

                    try {
                        // Determine if we need to auto-categorize this specific URL
                        const isAutoDetect = niche === 'Auto-Detect (AI)';
                        const nicheInstruction = isAutoDetect
                            ? `You MUST analyze this URL and assign it to ONE of these exact four categories: "Beauty & Makeup", "Hair Styling", "Fashion & Outfits", or "Nails & Beauty".`
                            : `Generate highly engaging, click-driving Pinterest content for the "${niche}" niche.`;

                        const variationPrompt = isVariation
                            ? `This is variation #${variationIndex} for this specific URL. Please ensure the title and description are strictly unique and fresh compared to a standard baseline, focusing on a different feature or angle while remaining SEO-optimized.`
                            : "";

                        const categorySchemaField = isAutoDetect
                            ? `\n  "autoCategory": "Exactly ONE of the 4 valid categories defined above",`
                            : "";

                        // 1. Generate Text (Title, Description, Keywords, Image Prompt)
                        const textPrompt = `
You are an expert Pinterest marketer. Analyze this destination URL conceptually (you don't need to visit it, just infer from the URL slug if needed): ${url}
${nicheInstruction}
${variationPrompt}

// Return ONLY a valid raw JSON object with no markdown formatting or backticks, with the following schema:
{${categorySchemaField}
  "title": "The full, original title of the URL content (e.g. 'Stunning Plus-Size Rodeo Outfits for Every Cowgirl')",
  "shortOverlayTitle": "Extract the core entity/concept for the image text overlay. CRITICAL: If the original title contains words like 'Ideas', 'Looks', 'Trends', 'Styles', or 'Outfit', you MUST KEEP THEM in this overlay title. Max 7 words.",
  "description": "A compelling, readable description between 100 and 800 characters. Put your most important keywords and search terms at the VERY BEGINNING. Describe the content pleasantly to grab attention. DO NOT USE ANY HASHTAGS.",
  "keywords": "comma separated list of 5-8 highly searchable SEO keywords",
  "generatedBoardName": "An intelligent, keyword-rich, and broad descriptive board name (e.g., 'Rodeo Outfits'). It should be reusable.",
  "imagePrompt": "A highly detailed, descriptive prompt for an AI image generator to create an aesthetic Pinterest image. Focus on exactly ONE person. Do not include text in the image itself."
}
`;
                        const textResult = await textModel.generateContent(textPrompt);
                        let generatedText = textResult.response.text();
                        // Clean the response if it has markdown formatting
                        const cleanJsonStr = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const textData = JSON.parse(cleanJsonStr);

                        // Dynamically resolve the aesthetic instruction for this specific iteration
                        const resolvedCategory = isAutoDetect ? textData.autoCategory : niche;
                        // Fallback to Beauty & Makeup if the AI hallucinates a weird category
                        const specificAesthetic = nichePrompts[resolvedCategory] || nichePrompts["Beauty & Makeup"];

                        // Inject the newly resolved aesthetic and rules into the pre-generated imagePrompt
                        const specificTips = nicheImageTips[resolvedCategory] || "Do not include text in the image.";
                        const finalImagePrompt = `${textData.imagePrompt} CRITICAL AESTHETIC RULES: ${specificAesthetic} ${specificTips}`;

                        // 2. Generate Image using Imagen 3
                        let finalImageUrl = ''; // fallback to empty string

                        try {
                            let imageResponseOk = false;
                            let imgData = null;
                            let retryCount = 0;

                            while (retryCount < 3 && !imageResponseOk) {
                                try {
                                    // Current Google AI Studio Imagen 3 REST call approach via fetch
                                    const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${effectiveGeminiKey}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            instances: [{ prompt: finalImagePrompt }],
                                            parameters: { sampleCount: 1, aspectRatio: '9:16' }
                                        })
                                    });

                                    if (imageResponse.ok) {
                                        imgData = await imageResponse.json();
                                        if (imgData.predictions && imgData.predictions[0]) {
                                            imageResponseOk = true;
                                            break;
                                        }
                                    } else {
                                        console.warn(`Imagen attempt ${retryCount + 1} failed:`, await imageResponse.text());
                                    }
                                } catch (fetchErr) {
                                    console.error(`Imagen network error on attempt ${retryCount + 1}:`, fetchErr.message);
                                }
                                retryCount++;
                                if (!imageResponseOk && retryCount < 3) {
                                    await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
                                }
                            }

                            let rawBuffer;
                            if (imageResponseOk) {
                                const rawBase64Image = imgData.predictions[0].bytesBase64Encoded;
                                rawBuffer = Buffer.from(rawBase64Image, 'base64');
                            } else {
                                console.warn(`All Imagen retries failed for ${url}. Using solid color fallback.`);
                                rawBuffer = await sharp({
                                    create: {
                                        width: 1000,
                                        height: 1500,
                                        channels: 4,
                                        background: { r: 235, g: 235, b: 240, alpha: 1 }
                                    }
                                }).png().toBuffer();
                            }

                            // --- PHASE 3: NICHE-AWARE AESTHETICS COMPOSITING ---
                            // We do this REGARDLESS of whether the AI generated the image or we fell back.
                            const urlMatch = url.match(/(?:\/|-)(\d+)(?:\/|-|$)/) || url.match(/\d+/);
                            const extractedNum = urlMatch ? urlMatch[1] || urlMatch[0] : null;
                            const prefix = extractedNum ? `${extractedNum}+ ` : '';
                            const overlayTitle = `${prefix}${textData.shortOverlayTitle}`.trim();
                            const overlayPngBuffer = await generateTextOverlayBuffer(overlayTitle, resolvedCategory);

                            // Composite Image + Canvas PNG overlay using sharp (PNG compositing works everywhere)
                            const compositedBuffer = await sharp(rawBuffer)
                                .resize(1000, 1500, { fit: 'cover' })
                                .composite([{ input: overlayPngBuffer, blend: 'over' }])
                                .jpeg({ quality: 90 })
                                .toBuffer();

                            // --- PHASE 4: UPLOAD TO IMGBB ---
                            const formData = new FormData();
                            formData.append('image', compositedBuffer.toString('base64'));
                            formData.append('name', overlayTitle);

                            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, {
                                method: 'POST',
                                body: formData
                            });

                            if (imgbbResponse.ok) {
                                const uploadJson = await imgbbResponse.json();
                                finalImageUrl = uploadJson.data.url;
                            } else {
                                console.error("ImgBB upload failed with status:", imgbbResponse.status);
                                console.error("ImgBB upload failed body:", await imgbbResponse.text());
                            }

                        } catch (imgErr) {
                            console.error("\n=== FATAL IMAGE COMPOSITING ERROR ===");
                            console.error("URL:", url);
                            console.error("Message:", imgErr.message);
                            console.error("Stack:", imgErr.stack);
                            console.error("=====================================\n");
                        }

                        const generatedPin = {
                            id: Date.now() + i,
                            sourceUrl: url,
                            title: textData.title.substring(0, 100),
                            description: textData.description.substring(0, 500),
                            imageUrl: finalImageUrl,
                            boardName: textData.generatedBoardName || 'Automated Ideas',
                            publishDate: new Date().toISOString(),
                            keywords: textData.keywords
                        };

                        // Stream chunk to client instantly
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(generatedPin)}\n\n`));

                    } catch (err) {
                        console.error(`Failed generating for URL ${url}:`, err);
                        // Push a falback row if one fails so the whole batch doesn't die
                        const errorPin = {
                            id: Date.now() + i,
                            sourceUrl: url,
                            title: `Failed to Generate: ${url}`,
                            description: "Error generating content. Please try again.",
                            imageUrl: "",
                            boardName: 'Error Handling',
                            publishDate: new Date().toISOString(),
                            keywords: "error"
                        };

                        // Stream error chunk to client instantly
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorPin)}\n\n`));
                    }
                }

                // Signal stream completion
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
