import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import OpenAI from 'openai';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';

// --- CACHE BUST RE-EVALUATION LOGIC ---
// Force Next.js HMR to pick up the very latest overlayEngine.js modifications!
console.log("[INIT] Reloaded /api/generate Route Handler");



/**
 * Extracts the human-readable keyword phrase from a URL slug.
 * "https://site.com/what-to-wear-with-jeans-shorts/" -> "What To Wear With Jeans Shorts"
 */
function extractSlugKeyword(url) {
    if (!url) return null;
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        const segs = u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
        let slug = segs[segs.length - 1] || '';
        if (/^\d+$/.test(slug) && segs.length > 1) slug = segs[segs.length - 2];
        if (!slug) return null;
        return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch { return null; }
}


// genAI will be initialized dynamically per-request to support user-provided keys



export async function POST(req) {
    try {
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.APP_API_KEY?.trim();

        if (!apiKey || apiKey !== expectedKey) {
            console.error(`[AUTH FAILED] Received length: ${apiKey?.length}, Expected length: ${expectedKey?.length}`);
            return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        const {
            urls,
            niche,
            aspectRatio,
            geminiKey,
            nvidiaKey,
            existingBoards,
            totalScraped, // passed if coming from a context that already knows the count
            rawImageUrl   // PERSISTENCE: If provided, skip Imagen and use this original image
        } = await req.json();

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();
        const effectiveNvidiaKey = (nvidiaKey || process.env.NVIDIA_API_KEY)?.trim();

        const nvidiaClient = effectiveNvidiaKey ? new OpenAI({
            apiKey: effectiveNvidiaKey,
            baseURL: "https://integrate.api.nvidia.com/v1",
            timeout: 15000 
        }) : null;

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

        // ── Main AI Generator ──────────────────────────────────────────────────
        // Note: Number prefixing is DISABLED for this tool as it caused "random" numbers.
        // It is only used in the Scraper tool (/api/scrape-generate).
        
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
                        const slugKeyword = extractSlugKeyword(url); // declared here so overlay section can access it
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

                            // slugKeyword already declared in outer scope above
                            
                            const textPrompt = `
You are an expert Pinterest marketer. Analyze this destination URL conceptually: ${url}
(You don't need to visit it, just infer from the URL slug/name if needed).
${nicheInstruction}
${variationPrompt}
${boardsInstruction}
${historyPrompt}

${slugKeyword ? `TOPIC LOCK — MOST IMPORTANT RULE:
The title MUST be a SHORT, punchy variation or angle of this URL topic: "${slugKeyword}"
Every title/overlay variation must stay on this topic.` : ''}

CRITICAL RULES:
1. The subject for the pins and images MUST ALWAYS be female unless the URL/topic explicitly states otherwise (e.g. 'mens'). Use feminine pronouns (she/her) in descriptions.
2. DO NOT use generic AI buzzwords like "Chic", "Elevated", "Stunning", "Captivating", or "Trendy" in ANY of the generated text (title, shortOverlayTitle, description, imagePrompt).

CRITICAL TONE REQUIREMENT: Use this exact copywriting angle: "${randomAngle}". Ensure the description flows naturally with this tone so that multiple similar topics do not sound repetitive.

{
  "title": "SEO title (e.g., '13 Best Ways to Style Sweatpants')",
  "overlayText": "Visual hook (e.g., '13 Ways to Style Sweatpants'). Max 25 chars. MUST be directly informed by the article title and make sense.",
  "description": "Engaging description with keywords. Max 500 chars.",
  "keywords": "5 keywords",
  "generatedBoardName": "Board name",
  "imagePrompt": "Detailed photography prompt. NO TEXT."
}
`;
                             let success = false;
                             let lastError = null;

                             // 1. Try Minimax (Nvidia) first as requested
                             if (nvidiaClient) {
                                 try {
                                     console.log(`[TEXT] Attempting Minimax...`);
                                     const completion = await nvidiaClient.chat.completions.create({
                                         model: "minimaxai/minimax-m2.7",
                                         messages: [{ role: "user", content: textPrompt }],
                                         max_tokens: 800,
                                     });
                                     const msg = completion.choices?.[0]?.message;
                                     const raw = (msg?.content || msg?.reasoning_content || '').trim();
                                     if (raw) {
                                         const cleanJsonStr = raw.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                         textData = JSON.parse(cleanJsonStr);
                                         if (textData && textData.title) historyTitles.push(textData.title);
                                         success = true;
                                         console.log(`[SUCCESS] Minimax worked!`);
                                     }
                                 } catch (err) {
                                     console.warn(`[FAIL] Minimax failed: ${err.message}`);
                                     lastError = err;
                                 }
                             }

                             // 2. Try Gemini (REMOVED - ONLY NVIDIA/MINIMAX FOR TEXT)
                             // if (!success && effectiveGeminiKey) { ... }

                             if (!success) {
                                 throw lastError || new Error('Text generation failed (Minimax unavailable or failed).');
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
                        // Plain-English exclusions — Imagen does NOT support Stable Diffusion weighted syntax like (text:1.3)
                        const negativeInstructions = "Do not include any text, watermarks, logos, or signatures. Do not render CGI, 3D renders, cartoons, anime, illustrations, or paintings. Avoid extra fingers, deformed hands, extra limbs, or distorted anatomy. Avoid harsh unnatural lighting, oversaturated colors, or plastic-looking skin. Do not crop the head. No collages or split images.";
                        const finalImagePrompt = `${baselinePrompt} ${textData.imagePrompt} CRITICAL AESTHETIC RULES: ${specificAesthetic} ${specificTips} ${negativeInstructions}`;

                        // --- Intelligent Overlay Logic (Matched with scrape-generate) ---
                        let finalOverlay = textData.overlayText || slugKeyword || 'Inspiration';
                        const templatesList = ['top_bar', 'cta_button', 'big_center'];
                        const template = templatesList[Math.floor(Math.random() * templatesList.length)];

                        // 2. Generate Image using Imagen 3
                        let finalImageUrl = ''; // fallback to empty string

                            try {
                                let imageResponseOk = false;
                                let imgData = null;
                                let quotaExhausted = false;
                                
                                let rawBuffer = null;

                                // ── Persistence Check: If we have a raw image, skip generation ──
                                if (rawImageUrl) {
                                    try {
                                        console.log(`[PERSISTENCE] Re-using existing image for regeneration: ${rawImageUrl.substring(0, 50)}...`);
                                        const res = await fetch(rawImageUrl, { timeout: 10000 });
                                        if (res.ok) {
                                            rawBuffer = Buffer.from(await res.arrayBuffer());
                                            imageResponseOk = true;
                                        }
                                    } catch (err) {
                                        console.warn(`[PERSISTENCE FAIL] Could not fetch raw image: ${err.message}. Falling back to generation.`);
                                    }
                                }

                                // Keys to try for Imagen
                                const keysToTry = [
                                    effectiveGeminiKey.trim(),
                                    process.env.GEMINI_API_KEY.trim()
                                ].filter((v, i, a) => a.indexOf(v) === i); // unique only

                                // Models to try — ordered from most stable to least. imagen-3.0 is a reliable fallback.
                                const imageModels = [
                                    'imagen-4.0-generate-001',
                                    'imagen-4.0-fast-generate-001',
                                    'imagen-3.0-generate-001',
                                ];

                                if (!imageResponseOk) {
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
                                                    await new Promise(r => setTimeout(r, 800)); // back off before next attempt
                                                    continue;
                                                }
                                                console.warn(`Imagen ${imgModel} failed (HTTP ${imageResponse.status}):`, errorText.substring(0, 200));
                                            }
                                        } catch (fetchErr) {
                                            console.error(`Imagen network error:`, fetchErr.message);
                                        }
                                    }
                                }

                                if (imageResponseOk && !rawBuffer) {
                                    const rawBase64Image = imgData.predictions[0].bytesBase64Encoded;
                                    rawBuffer = Buffer.from(rawBase64Image, 'base64');
                                } else if (!imageResponseOk) {
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

                             // Composite Image + Canvas PNG overlay using sharp (PNG compositing works everywhere)
                             const overlayPngBuffer = generateOverlayBuffer(finalOverlay, template);
                             const overlayPngReady = await sharp(overlayPngBuffer).png().toBuffer();
                             const compositedBuffer = await sharp(rawBuffer)
                                .resize(1080, 1920, { fit: 'cover' })
                                .composite([{ input: overlayPngReady, top: 0, left: 0, blend: 'over' }])
                                .jpeg({ quality: 90 })
                                .toBuffer();

                             // --- PHASE 4: UPLOAD TO IMGBB ---
                             const formData = new FormData();
                             formData.append('image', compositedBuffer.toString('base64'));
                             formData.append('name', finalOverlay);

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
                            title: textData.title,
                            overlayText: finalOverlay,
                            description: textData.description.substring(0, 500),
                            imageUrl: finalImageUrl,
                            rawImageUrl: rawImageUrl || finalImageUrl, // Store the original raw image URL
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
