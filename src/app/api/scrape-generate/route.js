import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import OpenAI from 'openai';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';

// --- CACHE BUST RE-EVALUATION LOGIC ---
console.log("[INIT] Reloaded /api/scrape-generate Route Handler - V3.2 Parallel");

// Deterministic overlay title rotation — 30 unique angles, no AI needed
const TITLE_ANGLES = [
    s => s,
    s => `${s} Ideas`,
    s => `${s} Inspo`,
    s => `${s} Styling Ideas`,
    s => `${s} Styles`,
    s => `${s} Fits`,
    s => `${s} Fits Inspo`,
    s => `${s} Looks`,
    s => `${s} Guide`,
    s => `${s} Tips`,
    s => `${s} Outfit Ideas`,
    s => `${s} Style Guide`,
    s => `${s} Inspiration`,
    s => `${s} Fashion Tips`,
    s => `${s} Style Inspo`,
    s => `${s} Outfit Inspo`,
    s => `${s} Style Ideas`,
    s => `${s} Look Ideas`,
    s => `${s} Fashion Ideas`,
    s => `${s} Style Tips`,
    s => `${s} Outfit Inspiration`,
    s => `${s} Fashion Guide`,
    s => `${s} Trend Ideas`,
    s => `${s} Style Trends`,
    s => `${s} Outfit Goals`,
    s => `${s} Fashion Looks`,
    s => `${s} Style Goals`,
    s => `${s} Look Inspo`,
    s => `${s} Outfit Styles`,
    s => `${s} Fashion Styles`,
];

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
        return imageUrl;
    }

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
        return imageUrl;
    }

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

    let overlayBuffer;
    try {
        overlayBuffer = generateOverlayBuffer(title, template);
        if (!overlayBuffer) return imageUrl;
    } catch (err) {
        console.error(`[TEMPLATE] Overlay render FAILED: ${err.message}`);
        return imageUrl;
    }

    let compositedBuffer;
    try {
        const overlayPng = await sharp(overlayBuffer).png().toBuffer();
        compositedBuffer = await sharp(resizedBuffer)
            .composite([{ input: overlayPng, top: 0, left: 0, blend: 'over' }])
            .jpeg({ quality: 88 })
            .toBuffer();
    } catch (err) {
        console.error(`[TEMPLATE] Composite FAILED: ${err.message}`);
        return imageUrl;
    }

    if (imgbbKey) {
        try {
            const uploadedUrl = await uploadToImgBB(compositedBuffer, imgbbKey);
            return uploadedUrl;
        } catch (err) {
            console.warn(`[TEMPLATE] ImgBB upload failed: ${err.message}`);
        }
    }

    const b64 = compositedBuffer.toString('base64');
    return `data:image/jpeg;base64,${b64}`;
}

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

export async function POST(req) {
    try {
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.APP_API_KEY?.trim();
        if (!apiKey || apiKey !== expectedKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            jobs,
            variationCount,
            niche,
            geminiKey,
            nvidiaKey,
            existingBoards,
            templates,
            imgbbKey: clientImgbbKey,
        } = await req.json();

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();
        const effectiveNvidiaKey = (nvidiaKey || process.env.NVIDIA_API_KEY)?.trim();
        const effectiveImgbbKey = (clientImgbbKey || process.env.IMGBB_API_KEY)?.trim();
        const templatePool = templates && templates.length > 0 ? templates : ['top_bar', 'cta_button', 'big_center', 'minimal'];

        if (!jobs || jobs.length === 0) return NextResponse.json({ error: 'No jobs' }, { status: 400 });

        const encoder = new TextEncoder();
        const historyTitles = [];
        const nvidiaClient = effectiveNvidiaKey ? new OpenAI({
            apiKey: effectiveNvidiaKey,
            baseURL: "https://integrate.api.nvidia.com/v1"
        }) : null;

        const stream = new ReadableStream({
            async start(controller) {
                let globalPinIndex = 0;
                const allTasks = [];

                // Helper to limit concurrency
                const pLimit = (await import('p-limit')).default(5);

                for (const job of jobs) {
                    const { imageUrl, imageAlt, sourceUrl: jobSourceUrl, totalScraped: jobTotal } = job;
                    const image = { src: imageUrl, alt: imageAlt };
                    const slugKeyword = extractSlugKeyword(jobSourceUrl);
                    const imageCount = Math.max(Number(jobTotal) || 0, 1);
                    const count = Math.max(1, Math.min(10, variationCount || 1));

                    for (let v = 0; v < count; v++) {
                        const localVariationIndex = v;
                        const localPinIndex = globalPinIndex++;

                        allTasks.push(pLimit(async () => {
                            try {
                                const template = templatePool[Math.floor(Math.random() * templatePool.length)];
                                const isAutoDetect = niche === 'Auto-Detect (AI)';
                                const nicheInstruction = isAutoDetect
                                    ? `Analyze context: "Beauty & Makeup", "Hair Styling", "Fashion & Outfits", or "Nails & Beauty".`
                                    : `Niche: "${niche}".`;

                                const historyPrompt = historyTitles.length > 0
                                    ? `Avoid repetition: [${historyTitles.slice(-5).join(' | ')}].`
                                    : '';

                                const textPrompt = `Expert Pinterest writer. Write pin JSON for image:
Source URL: ${jobSourceUrl || image.src}
Image alt: ${image.alt || 'N/A'}
${nicheInstruction}
${historyPrompt}
${slugKeyword ? `URL Topic: "${slugKeyword}"` : ''}

Return ONLY valid raw JSON:
{
  "title": "Pinterest title",
  "description": "Keyword-rich description, 100-500 chars.",
  "keywords": "comma, separated, keywords",
  "generatedBoardName": "Board name"
}`;

                                let textData = null;

                                // 1. Try Minimax
                                if (nvidiaClient) {
                                    try {
                                        const completion = await nvidiaClient.chat.completions.create({
                                            model: "minimaxai/minimax-m2.7",
                                            messages: [{ role: "user", content: textPrompt }],
                                            temperature: 0.7,
                                            max_tokens: 1024,
                                        });
                                        const message = completion.choices?.[0]?.message;
                                        const generated = (message?.content || message?.reasoning_content || '').trim();
                                        if (generated) {
                                            const clean = generated.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                            textData = JSON.parse(clean);
                                        }
                                    } catch (err) {
                                        console.warn(`[Minimax Fail] ${err.message}`);
                                    }
                                }

                                // 2. Fallback Gemini
                                if (!textData && effectiveGeminiKey) {
                                    try {
                                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${effectiveGeminiKey}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ contents: [{ parts: [{ text: textPrompt }] }] })
                                        });
                                        const json = await res.json();
                                        const generated = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                                        if (generated) {
                                            const clean = generated.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                            textData = JSON.parse(clean);
                                        }
                                    } catch (err) {
                                        console.warn(`[Gemini Fail] ${err.message}`);
                                    }
                                }

                                if (!textData) {
                                    textData = {
                                        title: slugKeyword ? `${slugKeyword} Inspiration` : 'Scraped Image Pin',
                                        description: 'AI generation failed. Please edit manually.',
                                        keywords: 'content, style, inspiration',
                                        generatedBoardName: 'General Inspiration'
                                    };
                                }

                                if (textData.title) historyTitles.push(textData.title);

                                // 3. Build Overlay Title
                                const slugBase = slugKeyword || textData.title || 'Style Inspo';
                                const angleTitle = TITLE_ANGLES[localPinIndex % TITLE_ANGLES.length](slugBase);
                                const overlayTitle = imageCount > 1 ? `${imageCount} ${angleTitle}` : angleTitle;

                                // 4. Apply Template
                                const finalImageUrl = await applyTemplate(image.src, overlayTitle, template, effectiveImgbbKey);

                                const pin = {
                                    id: `scrape-${Date.now()}-${localPinIndex}`,
                                    sourceUrl: jobSourceUrl || image.src,
                                    imageUrl: finalImageUrl,
                                    title: overlayTitle,
                                    description: textData.description,
                                    keywords: textData.keywords,
                                    boardName: textData.generatedBoardName || 'My Boards',
                                    appliedTemplate: template,
                                    versionTag: '3.2-SCRAPE-CONCURRENT',
                                };

                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(pin)}\n\n`));
                            } catch (err) {
                                console.error(`[Task Fail]`, err);
                            }
                        }));
                    }
                }

                await Promise.all(allTasks);
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
        console.error('Fatal error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
