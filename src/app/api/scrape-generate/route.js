import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import OpenAI from 'openai';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';

// --- CACHE BUST RE-EVALUATION LOGIC ---
console.log("[INIT] Reloaded /api/scrape-generate Route Handler - V3.3 Optimized");

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

async function uploadToImgBB(imageBuffer, imgbbKey) {
    const base64 = imageBuffer.toString('base64');
    const params = new URLSearchParams({ key: imgbbKey, image: base64 });
    const res = await axios.post('https://api.imgbb.com/1/upload', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000,
    });
    if (!res.data?.data?.url) throw new Error('ImgBB upload failed');
    return res.data.data.url;
}

async function applyTemplate(imageUrl, title, template, imgbbKey) {
    if (template === 'minimal') return imageUrl;

    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const imageBuffer = Buffer.from(res.data);
        
        const resizedBuffer = await sharp(imageBuffer)
            .resize(1080, 1920, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 90 })
            .toBuffer();

        const overlayBuffer = generateOverlayBuffer(title, template);
        if (!overlayBuffer) return imageUrl;

        const overlayPng = await sharp(overlayBuffer).png().toBuffer();
        const compositedBuffer = await sharp(resizedBuffer)
            .composite([{ input: overlayPng, top: 0, left: 0, blend: 'over' }])
            .jpeg({ quality: 88 })
            .toBuffer();

        if (imgbbKey) {
            try {
                return await uploadToImgBB(compositedBuffer, imgbbKey);
            } catch (err) {
                console.warn(`[ImgBB Fail] ${err.message}`);
            }
        }
        return `data:image/jpeg;base64,${compositedBuffer.toString('base64')}`;
    } catch (err) {
        console.warn(`[Template Fail] ${err.message}`);
        return imageUrl;
    }
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
        if (apiKey !== process.env.APP_API_KEY?.trim()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobs, variationCount, niche, geminiKey, nvidiaKey, existingBoards, templates, imgbbKey: clientImgbbKey } = await req.json();

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();
        const effectiveNvidiaKey = (nvidiaKey || process.env.NVIDIA_API_KEY)?.trim();
        const effectiveImgbbKey = (clientImgbbKey || process.env.IMGBB_API_KEY)?.trim();
        const templatePool = templates?.length > 0 ? templates : ['top_bar', 'cta_button', 'big_center', 'minimal'];

        if (!jobs?.length) return NextResponse.json({ error: 'No jobs' }, { status: 400 });

        const encoder = new TextEncoder();
        const historyTitles = [];
        const nvidiaClient = effectiveNvidiaKey ? new OpenAI({
            apiKey: effectiveNvidiaKey,
            baseURL: "https://integrate.api.nvidia.com/v1",
            timeout: 30000 // 30s timeout for NVIDIA
        }) : null;

        const stream = new ReadableStream({
            async start(controller) {
                let globalPinIndex = 0;
                
                // Concurrency control: max 5 at a time
                const limit = 5;
                const executing = new Set();
                const tasks = [];

                for (const job of jobs) {
                    const { imageUrl, imageAlt, sourceUrl: jobSourceUrl, totalScraped: jobTotal } = job;
                    const slugKeyword = extractSlugKeyword(jobSourceUrl);
                    const imageCount = Math.max(Number(jobTotal) || 0, 1);
                    const count = Math.max(1, Math.min(10, variationCount || 1));

                    for (let v = 0; v < count; v++) {
                        const vIdx = v;
                        const pIdx = globalPinIndex++;

                        const task = async () => {
                            try {
                                console.log(`[GEN] Starting pin ${pIdx} (Var ${vIdx})`);
                                const template = templatePool[Math.floor(Math.random() * templatePool.length)];
                                const textPrompt = `Pinterest JSON for: ${jobSourceUrl || imageUrl}. Niche: ${niche}. Alt: ${imageAlt || 'N/A'}. ${slugKeyword ? `Topic: ${slugKeyword}` : ''}. Return raw JSON {title, description, keywords, generatedBoardName}.`;

                                let textData = null;

                                // 1. Try Minimax
                                if (nvidiaClient) {
                                    try {
                                        const completion = await nvidiaClient.chat.completions.create({
                                            model: "minimaxai/minimax-m2.7",
                                            messages: [{ role: "user", content: textPrompt }],
                                            max_tokens: 800,
                                        });
                                        const msg = completion.choices?.[0]?.message;
                                        const raw = (msg?.content || msg?.reasoning_content || '').trim();
                                        if (raw) {
                                            const clean = raw.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                            textData = JSON.parse(clean);
                                            console.log(`[MINIMAX] Success for ${pIdx}`);
                                        }
                                    } catch (err) {
                                        console.warn(`[Minimax Fail] ${pIdx}: ${err.message}`);
                                    }
                                }

                                // 2. Fallback Gemini
                                if (!textData && effectiveGeminiKey) {
                                    try {
                                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${effectiveGeminiKey}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ contents: [{ parts: [{ text: textPrompt }] }] }),
                                            signal: AbortSignal.timeout(15000)
                                        });
                                        const json = await res.json();
                                        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                                        if (raw) {
                                            const clean = raw.replace(/^```json/i, '').replace(/```$/g, '').trim();
                                            textData = JSON.parse(clean);
                                            console.log(`[GEMINI] Success for ${pIdx}`);
                                        }
                                    } catch (err) {
                                        console.warn(`[Gemini Fail] ${pIdx}: ${err.message}`);
                                    }
                                }

                                if (!textData) {
                                    textData = {
                                        title: slugKeyword ? `${slugKeyword} Inspiration` : 'Style Pin',
                                        description: 'AI generation failed.',
                                        keywords: 'style, inspo',
                                        generatedBoardName: 'Inspiration'
                                    };
                                }

                                if (textData.title) historyTitles.push(textData.title);

                                const slugBase = slugKeyword || textData.title || 'Inspiration';
                                const overlayTitle = imageCount > 1 
                                    ? `${imageCount} ${TITLE_ANGLES[pIdx % TITLE_ANGLES.length](slugBase)}`
                                    : TITLE_ANGLES[pIdx % TITLE_ANGLES.length](slugBase);

                                const finalImageUrl = await applyTemplate(imageUrl, overlayTitle, template, effectiveImgbbKey);

                                const pin = {
                                    id: `scrape-${Date.now()}-${pIdx}`,
                                    sourceUrl: jobSourceUrl || imageUrl,
                                    imageUrl: finalImageUrl,
                                    title: overlayTitle,
                                    description: textData.description,
                                    keywords: textData.keywords,
                                    boardName: textData.generatedBoardName || 'My Boards',
                                    appliedTemplate: template,
                                    versionTag: '3.3-SCRAPE-OPT',
                                };

                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(pin)}\n\n`));
                                console.log(`[DONE] Enqueued pin ${pIdx}`);
                            } catch (err) {
                                console.error(`[Fatal Pin Error] ${pIdx}:`, err);
                            }
                        };

                        const promise = (async () => {
                            if (executing.size >= limit) {
                                await Promise.race(executing);
                            }
                            const p = task();
                            executing.add(p);
                            await p;
                            executing.delete(p);
                        })();
                        tasks.push(promise);
                    }
                }

                await Promise.all(tasks);
                console.log("[STREAM] Closing stream");
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });
    } catch (error) {
        console.error('Fatal API error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
