import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';


// genAI will be initialized dynamically per-request to support user-provided keys



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
            "Beauty & Makeup": [
                "ULTRA-REALISTIC RAW SNAPSHOT. Close-up portrait. Disposable camera aesthetic, 35mm film grain, direct flash photography. Authentic lens flare. Visible skin pores, real cuticles, natural skin imperfections. NO smooth AI skin, NO CGI textures. NO bokeh, NO studio lighting. Captured on street."
            ],
            "Hair Styling": [
                "ULTRA-REALISTIC RAW SNAPSHOT. Candid motion. 35mm film grain, raw blogger style. Natural lighting (not studio). Handheld camera shakiness. Motion blur in background. NO airbrushing or plastic smoothness. Real human imperfections. Captured in messy room or street."
            ],
            "Fashion & Outfits": [
                "ULTRA-REALISTIC RAW SNAPSHOT. The Faceless Mirror Selfie. Subject holding smartphone obscuring their face, standing in front of a visible mirror. Bright natural indoor lighting. Messy bedroom or modern hallway background. Gen-Z casual style. NO studio lighting. NO AI smoothness.",
                "ULTRA-REALISTIC RAW SNAPSHOT. The Vintage Indoor Candid. 90s vintage film aesthetic. Slightly underexposed, warm tones. Wood paneling or retro interior background. Candid relaxed pose, looking away from camera. Authentic lens flare.",
                "ULTRA-REALISTIC RAW SNAPSHOT. FULL BODY SHOT - HEAD TO TOE. Wide angle lens. Disposable camera aesthetic, 35mm film grain, direct flash photography. Authentic lens flare. NO bokeh, NO studio lighting. NO AI smoothness, NO CGI textures. REAL human proportions. Captured on an outdoor city street."
            ],
            "Nails & Beauty": [
                "ULTRA-REALISTIC RAW SNAPSHOT. Hyper-realistic human skin, raw hand photography. Flash photography on smartphone. Visible skin grain, natural cuticles. NO smooth AI hands. High detail nail reflections. Background: coffee cup or sweater."
            ]
        };

        // Niche-specific guidance injected into the Gemini imagePrompt instruction
        const nicheImageTips = {
            "Beauty & Makeup": ["CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Real pores, skin grain, and imperfections. NO smooth AI skin. NO bokeh. Shot on disposable camera flash. No text."],
            "Hair Styling": ["CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Raw 35mm grain. Candid blogger style. NO airbrush/plastic hair. NO bokeh. No text."],
            "Fashion & Outfits": [
                "CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Faceless mirror selfie, realistic messy room layout, authentic outfit layering. No text.",
                "CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: 90s vintage film grain, harsh retro flash, authentic wood or retro interior styling. No text.",
                "CRITICAL: ONE SINGLE UNIFIED PHOTO. FULL BODY (HEAD TO TOE). NO Grid/Collage. HUMAN-FEEL: Harsh influencer flash, film grain, fabric wrinkles. NO bokeh. Unposed, raw. No text."
            ],
            "Nails & Beauty": ["CRITICAL: ONE SINGLE UNIFIED PHOTO. NO Grid/Collage. HUMAN-FEEL: Raw skin texture, real cuticles. NO smooth AI hands. High nail detail. No text."]
        };

        const encoder = new TextEncoder();
        const urlOccurrences = {};
        const historyTitles = [];

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
                            ? `This is variation #${variationIndex} for this specific URL. CRITICAL: You MUST generate a STATEDLY DIFFERENT Title and Description. Use a completely different angle (e.g., if variation #1 used "Outfit Ideas", variation #2 should use "Trending Styles" or "Lookbook"). Ensure the 'shortOverlayTitle' is unique.`
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
                            const angles = [
                                "A deeply personal, first-person narrative recommendation.",
                                "A highly structured, listicle-style summary.",
                                "An aesthetic, romanticized editorial approach.",
                                "A bold, contouring, or myth-busting styling tip.",
                                "A hyper-specific styling hack for everyday life."
                            ];
                            const randomAngle = angles[Math.floor(Math.random() * angles.length)];
                            const historyPrompt = historyTitles.length > 0 
                                ? `\nCRITICAL ANTI-SPAM RULE: Do NOT use the exact same sentence structure, phrasing, or overlapping vocabulary as these recently generated titles in this batch: [${historyTitles.slice(-5).join(" | ")}]. Make this pin feel creatively distinct.` 
                                : "";

                            const textPrompt = `
You are an expert Pinterest marketer. Analyze this destination URL conceptually: ${url}
(You don't need to visit it, just infer from the URL slug/name if needed).
${nicheInstruction}
${variationPrompt}
${boardsInstruction}
${historyPrompt}

CRITICAL RULES:
1. The subject for the pins and images MUST ALWAYS be female unless the URL/topic explicitly states otherwise (e.g. 'mens'). Use feminine pronouns (she/her) in descriptions.
2. DO NOT use generic AI buzzwords like "Chic", "Elevated", "Stunning", "Captivating", or "Trendy" in ANY of the generated text (title, shortOverlayTitle, description, imagePrompt).

CRITICAL TONE REQUIREMENT: Use this exact copywriting angle: "${randomAngle}". Ensure the description flows naturally with this tone so that multiple similar topics do not sound repetitive.

// Return ONLY a valid raw JSON object. NO markdown code blocks. NO backticks.
{${categorySchemaField}
  "title": "The full, original title. Ensure perfect grammar and NO numerical redundancy (e.g., use '30th' NOT '30 30th').",
  "shortOverlayTitle": "Extract the core entity for the image text. Absolutely avoid redundancy. NEVER repeat the same word or year twice. Max 7 words. Strictly avoid buzzwords like 'Chic'. Diversify significantly for variations.",
  "description": "A compelling, keyword-rich description between 100 and 800 characters. The annotated keywords should blend naturally into the description text for SEO purposes. NO hashtags.",
  "keywords": "comma separated list of 5-8 SEO keywords",
  "generatedBoardName": "The Pinterest board name to use (either from the EXISTING BOARDS list or a new high-quality name)",
  "imagePrompt": "A highly detailed image prompt. Describe ONLY the specific clothing, hairstyle, and outfit textures (e.g., knitted embroidered cardigan, silk pants, lace trim, denim, leather). DO NOT specify an environment or background setting (e.g., do not say 'on a street' or 'in a room'), as the setting will be injected later. The subject MUST always be female unless the URL specifically dictates otherwise. ONE SINGLE UNIFIED PHOTO. NO Grid, NO Collage. NO text."
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
                                        if (textData && textData.title) historyTitles.push(textData.title);
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
                        const promptPool = nichePrompts[resolvedCategory] || nichePrompts["Beauty & Makeup"];
                        const specificAesthetic = Array.isArray(promptPool) ? promptPool[Math.floor(Math.random() * promptPool.length)] : promptPool;

                        // Inject the newly resolved aesthetic and rules into the pre-generated imagePrompt
                        const tipsPool = nicheImageTips[resolvedCategory] || "Do not include text in the image.";
                        const specificTips = Array.isArray(tipsPool) ? tipsPool[Math.floor(Math.random() * tipsPool.length)] : tipsPool;
                        
                        const baselinePrompt = "Hyper-realistic photograph, shot on iPhone 15 Pro, 48MP main sensor, natural ambient lighting, slight lens flare, authentic depth of field with soft bokeh background, true-to-life skin texture with natural pores, micro hair detail, realistic eye catchlights, candid unposed composition, slight motion in surroundings, natural color grading with muted warm tones, no AI smoothing, no plastic skin, genuine imperfections — slight asymmetry, natural shadow falloff, real-world environment with environmental storytelling, shot at eye-level, f/1.78 aperture equivalent, cinematic natural light, slight chromatic noise in shadows, photojournalism style, unretouched RAW feel. Subject is ALWAYS female unless explicitly specified otherwise in the prompt.";
                        const negativeInstructions = "NEGATIVE PROMPT (DO NOT INCLUDE): (worst quality, low quality:1.4), (text, signature, watermark, logo, brand:1.3), (CGI, 3D render, Unreal Engine, Octane render, octane, 3D model, doll, plastic, waxy, silicone, mannequin, airbrushed, retouched, smoothed skin:1.3), (extra fingers, missing fingers, fused fingers, deformed hands, distorted palms, claw hands:1.4), (extra limbs, mutated limbs, missing limbs, disconnected limbs, floating limbs:1.3), (long neck, turtle neck, bad anatomy, gross proportions, malformed body:1.2), (cross-eyed, deformed iris, deformed pupils, dead eyes, glowing eyes:1.3), (bad teeth, warped teeth, missing teeth:1.2), (oversaturated, neon colors, cartoon, anime, illustration, painting, drawing:1.3), (harsh shadows, pitch black shadows, flat lighting:1.1), (grainy, low-res, blurry, compression artifacts:1.2), (cropped head, out of frame, cut off:1.2), (fused clothing, nonsensical jewelry, asymmetric ears:1.1)";
                        const finalImagePrompt = `${baselinePrompt} ${textData.imagePrompt} CRITICAL AESTHETIC RULES: ${specificAesthetic} ${specificTips} ${negativeInstructions}`;

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

                                // Models to try (Maximize 170-image quota: Standard, Fast, Ultra)
                                const imageModels = [
                                    'imagen-4.0-generate-001', 
                                    'imagen-4.0-fast-generate-001',
                                    'imagen-4.0-ultra-generate-001'
                                ];

                                keyLoop: for (const currentKey of keysToTry) {
                                    for (const imgModel of imageModels) {
                                        try {
                                            console.log(`[RETRY] Attempting Imagen model: ${imgModel} with ${currentKey.substring(0, 8)}...`);
                                            const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${imgModel}:predict?key=${currentKey}`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    instances: [{ prompt: finalImagePrompt }],
                                                    parameters: { 
                                                        sampleCount: 1, 
                                                        aspectRatio: '9:16'
                                                    }
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
                                            width: 1080,
                                            height: 1920,
                                            channels: 4,
                                            background: { r: 235, g: 235, b: 240, alpha: 1 }
                                        }
                                    }).png().toBuffer();
                                }

                            // --- PHASE 3: NICHE-AWARE AESTHETICS COMPOSITING ---
                            // We do this REGARDLESS of whether the AI generated the image or we fell back.
                             const urlMatch = url.match(/(?:\/|-)(\d+)(?:\/|-|$)/) || url.match(/\d+/);
                             const extractedNum = urlMatch ? urlMatch[1] || urlMatch[0] : null;
                             
                             // Smart Deduplication: If the extracted number (e.g., 30) is already leading the title (e.g., 30th), skip prefix.
                             const cleanShortTitle = textData.shortOverlayTitle || "";
                             const alreadyHasNum = extractedNum && cleanShortTitle.toLowerCase().trim().startsWith(extractedNum.toLowerCase());
                             
                             const prefix = (extractedNum && !alreadyHasNum) ? `${extractedNum} ` : '';
                             const overlayTitle = `${prefix}${cleanShortTitle}`.trim();
                            const overlayPngBuffer = generateOverlayBuffer(overlayTitle, 'big_center');

                            // Composite Image + Canvas PNG overlay using sharp (PNG compositing works everywhere)
                            const overlayPngReady = await sharp(overlayPngBuffer).png().toBuffer();
                            const compositedBuffer = await sharp(rawBuffer)
                                .resize(1080, 1920, { fit: 'cover' })
                                .composite([{ input: overlayPngReady, top: 0, left: 0, blend: 'over' }])
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
                                // Fallback: Return Composited Image as Base64 Data URI so it still displays in the UI!
                                finalImageUrl = `data:image/jpeg;base64,${compositedBuffer.toString('base64')}`;
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
