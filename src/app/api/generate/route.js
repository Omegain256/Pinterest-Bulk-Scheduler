import { NextResponse } from 'next/server';
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
function drawText(ctx, text, x, y, { fontSize = 84, weight = 'bold', color = '#ffffff', strokeColor = 'rgba(0,0,0,0.9)', shadowBlur = 0, shadowOpacity = 0, strokeWidth = 0, align = 'center' } = {}) {
    ctx.save();
    ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    
    if (shadowBlur > 0) {
        ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
    }

    if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeText(text, x, y);
    }
    
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawSparkle(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.quadraticCurveTo(0, 0, size, 0);
        ctx.quadraticCurveTo(0, 0, 0, size);
    }
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.restore();
}

function drawArrowShape(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    
    // Define the arrow path (pointing right)
    function arrowPath(context) {
        context.beginPath();
        context.moveTo(-size * 0.8, -size * 0.25);
        context.lineTo(size * 0.2, -size * 0.25);
        context.lineTo(size * 0.2, -size * 0.6);
        context.lineTo(size * 1.1, 0);
        context.lineTo(size * 0.2, size * 0.6);
        context.lineTo(size * 0.2, size * 0.25);
        context.lineTo(-size * 0.8, size * 0.25);
        context.closePath();
    }

    // Shadow/Outline
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 14;
    arrowPath(ctx);
    ctx.stroke();

    // Fill
    ctx.fillStyle = '#ffffff';
    arrowPath(ctx);
    ctx.fill();
    
    ctx.restore();
}

async function generateTextOverlayBuffer(title, category) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // ── Pre-process Text ────────────────────────────────────────────────────
    const words = title.split(' ');
    const lines = [];
    if (words.length <= 2) {
        lines.push(title);
    } else if (words.length <= 4) {
        lines.push(words.slice(0, words.length - 2).join(' '));
        lines.push(words[words.length - 2]);
        lines.push(words[words.length - 1]);
    } else {
        lines.push(...wrapWords(title, 14).slice(0, 3));
    }

    // ── Layout Constants ────────────────────────────────────────────────────
    const fontSize = 110;
    const lineH = 135;
    const startY = 880 - ((lines.length - 1) * lineH) / 2;

    // ── Draw Sparkles (Background) ──────────────────────────────────────────
    const sparkles = [
        { x: 260, y: startY - 40, size: 35 },
        { x: 860, y: startY + 60, size: 25 },
        { x: 200, y: startY + 280, size: 30 },
        { x: 740, y: startY + 360, size: 40 },
        { x: 120, y: startY + 550, size: 20 },
        { x: 920, y: startY + 120, size: 30 }
    ];
    sparkles.forEach(s => drawSparkle(ctx, s.x, s.y, s.size));

    // ── Draw Main Text ──────────────────────────────────────────────────────
    lines.forEach((line, i) => {
        drawText(ctx, line, W / 2, startY + i * lineH, {
            fontSize,
            weight: '900',
            strokeWidth: 10,
            strokeColor: '#000000',
            align: 'center'
        });
    });

    // ── Draw Arrow ──────────────────────────────────────────────────────────
    const arrowY = startY + lines.length * lineH + 60;
    drawArrowShape(ctx, W / 2, arrowY, 60);

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

        const { urls, niche, aspectRatio, geminiKey, existingBoards } = await req.json();

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();

        if (!urls || urls.length === 0) {
            return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
        }

        if (!effectiveGeminiKey || !process.env.IMGBB_API_KEY) {
            return NextResponse.json({ error: 'API Keys are missing (Gemini or ImgBB)' }, { status: 500 });
        }

        // Phase 4: Niche Aesthetic Prompt Engineering — "Human-Feel" Framework
        const nichePrompts = {
            "Beauty & Makeup": "ONE SINGLE UNIFIED CAMERA SHOT. Human, raw, non-AI aesthetic. Disposable camera or 35mm film grain. Flash photography look. Visible skin pores, real cuticles, some natural skin imperfections like faint freckles or moles. Strictly NO smooth AI skin or plastic CGI textures. Close-up macro portrait. Shot on iPhone with high ISO noise. Natural, unedited influencer look.",
            "Hair Styling": "ONE SINGLE UNIFIED CAMERA SHOT. Authentic human feel, not AI. Candid, unposed motion. 35mm grain, raw blogger style. Soft film-like focus but strictly sharp on the hair texture. Non-perfect lighting. Motion blur in the background. Strictly NO airbrushing or plastic smoothness. Real-world messy bedroom or city street backdrop. Human imperfection is key.",
            "Fashion & Outfits": "ONE SINGLE UNIFIED CAMERA SHOT. Harsh, authentic lighting (no studio lights). Disposable camera flash or natural high-contrast sun. Real 35mm film texture. Influencer-style mirror selfie or outdoor candid walk. Subject is not perfectly posed. Clothes have realistic fabric wrinkles. NO plastic skin or CGI look. RAW photo quality, unedited, slightly amateur but stylish.",
            "Nails & Beauty": "ONE SINGLE UNIFIED CAMERA SHOT. Hyper-realistic human skin, raw hand photography. Flash photography on a smartphone. Visible skin grain, natural cuticles, real-looking human hands. NO smooth AI 'plastic' hands. High detail on nail polish texture with realistic reflections. Background is a real-world setting like a coffee cup or fuzzy sweater."
        };

        // Niche-specific guidance injected into the Gemini imagePrompt instruction
        const nicheImageTips = {
            "Beauty & Makeup": "CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Real pores, skin grain, and imperfections. NO smooth AI skin. NO plastic textures. Shot on disposable camera/iPhone flash. No text.",
            "Hair Styling": "CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Raw 35mm grain. Candid blogger style. NO plastic/airbrushed hair. imperfect, real human look. No text.",
            "Fashion & Outfits": "CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Harsh influencer flash, film grain, fabric wrinkles. NO plastic skin or CGI aesthetic. Unposed, raw, unedited. No text.",
            "Nails & Beauty": "CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Raw skin texture, real cuticles. NO smooth AI hands. Authentic, organic, and imperfect. No text."
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
                            ? `This is variation #${variationIndex} for this specific URL. CRITICAL: You MUST generate a strictly unique Title and Description. Ensure the 'shortOverlayTitle' is different from previous variations.`
                            : "";

                        const categorySchemaField = isAutoDetect
                            ? `\n  "autoCategory": "Exactly ONE of the 4 valid categories defined above",`
                            : "";

                        // Inject existing boards if provided
                        const boardsInstruction = existingBoards && existingBoards.length > 0
                            ? `\nEXISTING BOARDS: ${existingBoards.join(', ')}\nCRITICAL: If one of these existing boards is a suitable match for the content, you MUST use its EXACT name for "generatedBoardName". Only generate a new board name if none of the existing boards are relevant.`
                            : "Generate an intelligent, keyword-rich, and broad descriptive board name (e.g., 'Rodeo Outfits'). It should be reusable.";

                        // 1. Generate Text (Title, Description, Keywords, Image Prompt)
                        let textData;
                        try {
                            const textPrompt = `
You are an expert Pinterest marketer. Analyze this destination URL conceptually: ${url}
(You don't need to visit it, just infer from the URL slug/name if needed).
${nicheInstruction}
${variationPrompt}
${boardsInstruction}

// Return ONLY a valid raw JSON object. NO markdown code blocks. NO backticks.
{${categorySchemaField}
  "title": "The full, original title of the URL content",
  "shortOverlayTitle": "Extract the core entity/concept for the image text overlay. Absolutely avoid redundancy. NEVER repeat the same word or year twice. Ensure perfect grammar. If the original title contains words like 'Ideas', 'Looks', 'Trends', 'Styles', or 'Outfit', you MUST KEEP THEM. Max 7 words.",
  "description": "A compelling, keyword-rich description between 100 and 800 characters. No hashtags.",
  "keywords": "comma separated list of 5-8 SEO keywords",
  "generatedBoardName": "The Pinterest board name to use (either from the EXISTING BOARDS list or a new high-quality name)",
  "imagePrompt": "A highly detailed image prompt. ONE SINGLE UNIFIED PHOTO. NO Grid, NO Collage. HUMAN-FEEL: Raw, authentic, film grain, unedited influencer look. Focus on ONE person. NO text."
}
`;
                            // Phase 1: Verified Smart Text Generation Fallback Chain
                            // PROBED & CONFIRMED for this key: v1beta/gemini-2.5-flash
                            const modelsToTry = [
                                { v: 'v1beta', m: 'gemini-2.5-flash' },
                                { v: 'v1beta', m: 'gemini-2.0-flash-lite' },
                                { v: 'v1beta', m: 'gemini-1.5-flash' },
                                { v: 'v1', m: 'gemini-1.5-flash' }
                            ];

                            let lastError = null;
                            let success = false;

                            for (const modelInfo of modelsToTry) {
                                try {
                                    const REST_URL = `https://generativelanguage.googleapis.com/${modelInfo.v}/models/${modelInfo.m}:generateContent?key=${effectiveGeminiKey.trim()}`;
                                    console.log(`[RETRY] Attempting ${modelInfo.v}/${modelInfo.m}...`);
                                    
                                    const restResponse = await fetch(REST_URL, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            contents: [{ parts: [{ text: textPrompt }] }]
                                        })
                                    });

                                    if (!restResponse.ok) {
                                        const errorMsg = await restResponse.text();
                                        throw new Error(`(${restResponse.status}): ${errorMsg}`);
                                    }

                                    const resultJson = await restResponse.json();
                                    if (resultJson.candidates && resultJson.candidates.length > 0) {
                                        const generatedText = resultJson.candidates[0].content.parts[0].text.trim();
                                        const cleanJsonStr = generatedText.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                        textData = JSON.parse(cleanJsonStr);
                                        success = true;
                                        console.log(`[SUCCESS] Gemini ${modelInfo.m} worked!`);
                                        break;
                                    }
                                } catch (err) {
                                    console.warn(`[FAIL] Gemini ${modelInfo.m} failed: ${err.message.substring(0, 100)}`);
                                    lastError = err;
                                }
                            }

                            if (!success) {
                                throw lastError || new Error('All Gemini models failed in fallback chain.');
                            }

                        } catch (textErr) {
                            console.error(`Gemini Text Generation Error for ${url}:`, textErr.message);
                            
                            // Fallback minimal data if text generation completely fails
                            textData = {
                                title: `Error: ${textErr.message.substring(0, 500)}`,
                                shortOverlayTitle: "API Issue",
                                description: `Failed to analyze URL. Error: ${textErr.message}.`,
                                keywords: "error, api, issue",
                                generatedBoardName: niche !== 'Auto-Detect (AI)' ? niche : "Error Logs",
                                imagePrompt: `ONE SINGLE UNIFIED PHOTO. HUMAN-FEEL: Raw, authentic ${niche} photography. No text.`
                            };
                        }

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
                                let quotaExhausted = false;
                                
                                // Keys to try for Imagen
                                const keysToTry = [
                                    effectiveGeminiKey.trim(),
                                    process.env.GEMINI_API_KEY.trim()
                                ].filter((v, i, a) => a.indexOf(v) === i); // unique only

                                // Models to try (Verified imagen-4.0 is available)
                                const imageModels = ['imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001'];

                                keyLoop: for (const currentKey of keysToTry) {
                                    for (const imgModel of imageModels) {
                                        try {
                                            console.log(`[RETRY] Attempting Imagen model: ${imgModel} with ${currentKey.substring(0, 8)}...`);
                                            const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${imgModel}:predict?key=${currentKey}`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    instances: [{ prompt: finalImagePrompt }],
                                                    parameters: { sampleCount: 1, aspectRatio: '9:16' }
                                                })
                                            });

                                            if (imageResponse.ok) {
                                                const responseJson = await imageResponse.json();
                                                if (responseJson.predictions && responseJson.predictions[0]) {
                                                    imgData = responseJson;
                                                    imageResponseOk = true;
                                                    console.log(`[SUCCESS] Imagen ${imgModel} worked!`);
                                                    break keyLoop;
                                                }
                                            } else {
                                                const errorText = await imageResponse.text();
                                                if (imageResponse.status === 429 || errorText.includes('RESOURCE_EXHAUSTED')) {
                                                    console.warn(`[QUOTA] Key ${currentKey.substring(0, 8)} exhausted for ${imgModel}.`);
                                                    quotaExhausted = true;
                                                    continue; // try next model or key
                                                }
                                                console.warn(`Imagen ${imgModel} failed (HTTP ${imageResponse.status}):`, errorText.substring(0, 100));
                                            }
                                        } catch (fetchErr) {
                                            console.error(`Imagen network error:`, fetchErr.message);
                                        }
                                    }
                                }

                                let rawBuffer;
                                if (imageResponseOk) {
                                    const rawBase64Image = imgData.predictions[0].bytesBase64Encoded;
                                    rawBuffer = Buffer.from(rawBase64Image, 'base64');
                                } else {
                                    const reason = quotaExhausted ? "IMAGE QUOTA EXHAUSTED" : "IMAGE GEN FAILED";
                                    console.warn(`[FAIL] ${reason}. Final fallback applied.`);
                                    
                                    // Set a visible error in the Pin data
                                    textData.title = `[${reason}] ${textData.title}`;
                                    textData.shortOverlayTitle = reason;

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
                            const prefix = extractedNum ? `${extractedNum} ` : '';
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
                            keywords: textData.keywords,
                            versionTag: "2.0-REST-FINAL"
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
                            keywords: "error",
                            versionTag: "2.0-REST-FINAL"
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
