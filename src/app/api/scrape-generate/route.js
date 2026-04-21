import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';

// ── ImgBB Upload Helper ──────────────────────────────────────────────────────
async function uploadToImgBB(imageBuffer, imgbbKey) {
    const base64 = imageBuffer.toString('base64');
    const params = new URLSearchParams({ key: imgbbKey, image: base64 });
    const res = await axios.post('https://api.imgbb.com/1/upload', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
    });
    if (!res.data?.data?.url) throw new Error('ImgBB upload failed');
    return res.data.data.url;
}

// ── Apply template overlay to a scraped image URL ────────────────────────────
async function applyTemplate(imageUrl, title, template, imgbbKey) {
    if (template === 'minimal') {
        // Return the original URL unchanged
        return imageUrl;
    }

    // 1. Fetch the scraped image
    let imageBuffer;
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 12000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PinBot/1.0)',
                'Accept': 'image/*,*/*;q=0.8',
            }
        });
        imageBuffer = Buffer.from(res.data);
    } catch (err) {
        console.warn(`[TEMPLATE] Could not fetch image ${imageUrl}: ${err.message}`);
        return imageUrl; // fall back to original on fetch failure
    }

    // 2. Resize to 1000×1500 (2:3 Pinterest ratio)
    let resizedBuffer;
    try {
        resizedBuffer = await sharp(imageBuffer)
            .resize(1080, 1920, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (err) {
        console.warn(`[TEMPLATE] sharp resize failed: ${err.message}`);
        return imageUrl;
    }

    // 3. Generate the overlay PNG from the canvas engine
    let overlayBuffer;
    try {
        overlayBuffer = generateOverlayBuffer(title, template);
        if (!overlayBuffer) return imageUrl; // safety check
    } catch (err) {
        console.warn(`[TEMPLATE] Overlay render failed: ${err.message}`);
        return imageUrl;
    }

    // 4. Composite overlay on top of resized image
    let compositedBuffer;
    try {
        compositedBuffer = await sharp(resizedBuffer)
            .composite([{ input: overlayBuffer, blend: 'over' }])
            .jpeg({ quality: 88 })
            .toBuffer();
    } catch (err) {
        console.warn(`[TEMPLATE] Composite failed: ${err.message}`);
        return imageUrl;
    }

    // 5. Upload composited image to ImgBB
    try {
        const uploadedUrl = await uploadToImgBB(compositedBuffer, imgbbKey);
        return uploadedUrl;
    } catch (err) {
        console.warn(`[TEMPLATE] ImgBB upload failed: ${err.message}`);
        // Fall back: return original source image
        return imageUrl;
    }
}

// ── URL Slug → Keyword Phrase ─────────────────────────────────────────────────
/**
 * Extracts the human-readable keyword phrase from a URL slug.
 * "https://site.com/what-to-wear-with-jeans-shorts/" → "What To Wear With Jeans Shorts"
 */
function extractSlugKeyword(url) {
    if (!url) return null;
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        const segs = u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
        // Try last segment; if it looks like an ID (all digits), use second-to-last
        let slug = segs[segs.length - 1] || '';
        if (/^\d+$/.test(slug) && segs.length > 1) slug = segs[segs.length - 2];
        if (!slug) return null;
        return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch { return null; }
}

// ── Route Handler ────────────────────────────────────────────────────────────
export async function POST(req) {
    try {
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.APP_API_KEY?.trim();
        if (!apiKey || apiKey !== expectedKey) {
            return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        const {
            images,
            variationCount,
            niche,
            geminiKey,
            existingBoards,
            sourceUrl,
            templates,  // array of selected template IDs
            imgbbKey: clientImgbbKey,
        } = await req.json();

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();
        const effectiveImgbbKey = (clientImgbbKey || process.env.IMGBB_API_KEY)?.trim();
        const templatePool = templates && templates.length > 0
            ? templates
            : ['top_bar', 'cta_button', 'big_center', 'minimal'];

        // Extract the URL keyword once — used to anchor ALL titles to the page topic
        const slugKeyword = extractSlugKeyword(sourceUrl);

        if (!images || images.length === 0) {
            return NextResponse.json({ error: 'No images provided' }, { status: 400 });
        }
        if (!effectiveGeminiKey) {
            return NextResponse.json({ error: 'Gemini API Key is missing' }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const historyTitles = [];

        const stream = new ReadableStream({
            async start(controller) {
                let pinIndex = 0;

                for (const image of images) {
                    const count = Math.max(1, Math.min(10, variationCount || 1));

                    for (let v = 0; v < count; v++) {
                        try {
                            // ── Pick a random template from the user's selection ──
                            const template = templatePool[Math.floor(Math.random() * templatePool.length)];

                            // ── Build Gemini prompt ──────────────────────────────
                            const isAutoDetect = niche === 'Auto-Detect (AI)';
                            const nicheInstruction = isAutoDetect
                                ? `You MUST analyze this image context and assign it to ONE of: "Beauty & Makeup", "Hair Styling", "Fashion & Outfits", or "Nails & Beauty".`
                                : `Generate highly engaging, click-driving Pinterest content for the "${niche}" niche.`;

                            const variationPrompt = v > 0
                                ? `Variation #${v + 1}: Use a COMPLETELY DIFFERENT angle, tone, and phrasing from all previous variations.`
                                : '';

                            const boardsInstruction = existingBoards && existingBoards.length > 0
                                ? `EXISTING BOARDS: ${existingBoards.join(', ')}\nCRITICAL: If one matches, use its EXACT name for "generatedBoardName".`
                                : 'Generate an intelligent, keyword-rich board name.';

                            const historyPrompt = historyTitles.length > 0
                                ? `\nANTI-SPAM: Do NOT use similar phrasing as: [${historyTitles.slice(-5).join(' | ')}].`
                                : '';


                            const angles = [
                                'A deeply personal, first-person recommendation.',
                                'A highly structured, listicle-style summary.',
                                'An aesthetic, romanticized editorial approach.',
                                'A bold, myth-busting styling tip.',
                                'A hyper-specific hack for everyday life.'
                            ];
                            const randomAngle = angles[Math.floor(Math.random() * angles.length)];

                            const textPrompt = `You are an expert Pinterest content writer. Write pin metadata for this image:

Source URL: ${sourceUrl || image.src}
Image alt: ${image.alt || 'N/A'}
${nicheInstruction}
${boardsInstruction}
${historyPrompt}

${slugKeyword ? `TOPIC LOCK — MOST IMPORTANT RULE:
The title MUST be a SHORT, punchy variation or angle of this URL topic: "${slugKeyword}"
Every title variation must stay on this topic. Do NOT write about unrelated subjects.
Think of how a human would phrase a Pinterest search for "${slugKeyword}":
  e.g. "${slugKeyword}", "Best Styles for ${slugKeyword.split(' ').pop()}",
       "How to Wear ${slugKeyword.split(' ').slice(-2).join(' ')}",
       "${slugKeyword.split(' ').slice(-2).join(' ')} Outfit Ideas", etc.
Variation #${v + 1} angle: "${randomAngle}"
` : `Variation #${v + 1} angle: "${randomAngle}"`}

TITLE RULES:
1. Fully formed, complete phrase — no ellipses, no trailing words, no cut-off text.
2. Ideally under 60 characters, HARD MAX 80 characters. Count characters before writing.
3. Each variation must feel like a different writer — no repeated sentence structure.
4. Subject is female unless the URL explicitly states otherwise.
5. BANNED words: "Chic", "Elevated", "Stunning", "Captivating", "Trendy", "Aesthetic".
6. Title rendered as large overlay text on the image — brevity and punch are critical.

Return ONLY valid raw JSON. NO markdown, NO backticks.
{
  "title": "Short punchy title anchored to URL topic. Max 80 chars.",
  "description": "Keyword-rich description, 100-500 chars. No hashtags.",
  "keywords": "comma, separated, 5-8, seo keywords",
  "generatedBoardName": "Pinterest board name"
}`;


                            const modelsToTry = [
                                { v: 'v1beta', m: 'gemini-2.5-flash' },
                                { v: 'v1beta', m: 'gemini-2.0-flash-lite' },
                                { v: 'v1beta', m: 'gemini-1.5-flash' },
                                { v: 'v1', m: 'gemini-1.5-flash' }
                            ];

                            let textData = null;

                            for (const modelInfo of modelsToTry) {
                                try {
                                    const REST_URL = `https://generativelanguage.googleapis.com/${modelInfo.v}/models/${modelInfo.m}:generateContent?key=${effectiveGeminiKey}`;
                                    const restResponse = await fetch(REST_URL, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ contents: [{ parts: [{ text: textPrompt }] }] })
                                    });
                                    if (!restResponse.ok) throw new Error(`HTTP ${restResponse.status}`);
                                    const resultJson = await restResponse.json();
                                    if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                                        const generated = resultJson.candidates[0].content.parts[0].text.trim();
                                        const clean = generated.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                        textData = JSON.parse(clean);
                                        if (textData?.title) historyTitles.push(textData.title);
                                        break;
                                    }
                                } catch (err) {
                                    console.warn(`[FAIL] Gemini ${modelInfo.m}: ${err.message.substring(0, 80)}`);
                                }
                            }

                            if (!textData) {
                                textData = {
                                    title: image.alt ? `${image.alt}`.substring(0, 70) : 'Scraped Image Pin',
                                    description: 'AI generation failed. Please edit manually.',
                                    keywords: 'content, style, inspiration',
                                    generatedBoardName: niche !== 'Auto-Detect (AI)' ? niche : 'My Boards'
                                };
                            }

                            const title = (textData.title || '').substring(0, 80);

                            // ── Apply template overlay (server-side) ─────────────
                            let finalImageUrl = image.src;
                            if (effectiveImgbbKey) {
                                finalImageUrl = await applyTemplate(image.src, title, template, effectiveImgbbKey);
                            }

                            const generatedPin = {
                                id: Date.now() + pinIndex + Math.random(),
                                sourceUrl: sourceUrl || image.src,
                                imageUrl: finalImageUrl,
                                title,
                                description: (textData.description || '').substring(0, 500),
                                keywords: textData.keywords || '',
                                boardName: textData.generatedBoardName || 'My Boards',
                                publishDate: new Date().toISOString(),
                                variation: v + 1,
                                appliedTemplate: template,
                                versionTag: '3.1-SCRAPE',
                            };

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(generatedPin)}\n\n`));
                            pinIndex++;

                        } catch (err) {
                            console.error(`Error for image ${image.src}:`, err.message);
                            const errorPin = {
                                id: Date.now() + pinIndex + Math.random(),
                                sourceUrl: sourceUrl || image.src,
                                imageUrl: image.src,
                                title: 'Content generation failed',
                                description: 'Please edit this pin manually.',
                                keywords: 'error',
                                boardName: 'Drafts',
                                publishDate: new Date().toISOString(),
                                appliedTemplate: 'minimal',
                                versionTag: '3.1-SCRAPE-ERROR',
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorPin)}\n\n`));
                            pinIndex++;
                        }

                        await new Promise(r => setTimeout(r, 400));
                    }
                }

                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('Scrape generate error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
