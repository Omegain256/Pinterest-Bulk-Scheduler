import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import OpenAI from 'openai';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';

export const runtime = 'nodejs';
export const maxDuration = 60; 

console.log("[INIT] Reloaded /api/scrape-generate - V3.6 PERMANENT FIX");

const TITLE_ANGLES = [
    s => s, s => `${s} Ideas`, s => `${s} Inspo`, s => `${s} Styling Ideas`, s => `${s} Styles`,
    s => `${s} Fits`, s => `${s} Fits Inspo`, s => `${s} Looks`, s => `${s} Guide`, s => `${s} Tips`,
    s => `${s} Outfit Ideas`, s => `${s} Style Guide`, s => `${s} Inspiration`, s => `${s} Fashion Tips`,
    s => `${s} Style Inspo`, s => `${s} Outfit Inspo`, s => `${s} Style Ideas`, s => `${s} Look Ideas`,
    s => `${s} Fashion Ideas`, s => `${s} Style Tips`, s => `${s} Outfit Inspiration`, s => `${s} Fashion Guide`,
    s => `${s} Trend Ideas`, s => `${s} Style Trends`, s => `${s} Outfit Goals`, s => `${s} Fashion Looks`,
    s => `${s} Style Goals`, s => `${s} Look Inspo`, s => `${s} Outfit Styles`, s => `${s} Fashion Styles`,
];

async function applyTemplate(imageUrl, title, template, imgbbKey) {
    if (template === 'minimal') return imageUrl;
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 8000,
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
                const b64 = compositedBuffer.toString('base64');
                const params = new URLSearchParams({ key: imgbbKey, image: b64 });
                const res = await axios.post('https://api.imgbb.com/1/upload', params.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 15000,
                });
                if (res.data?.data?.url) return res.data.data.url;
            } catch (err) { console.warn(`[ImgBB Fail] ${err.message}`); }
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

const extractJSON = (str) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        const start = str.indexOf('{');
        const end = str.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            try { return JSON.parse(str.substring(start, end + 1)); }
            catch (e2) { return null; }
        }
        return null;
    }
};

export async function POST(req) {
    try {
        const apiKeyHeader = req.headers.get('x-api-key')?.trim();
        if (apiKeyHeader !== process.env.APP_API_KEY?.trim()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { jobs, variationCount, niche, geminiKey, nvidiaKey, templates, imgbbKey: clientImgbbKey } = body;

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();
        const effectiveNvidiaKey = (nvidiaKey || process.env.NVIDIA_API_KEY)?.trim();
        const effectiveImgbbKey = (clientImgbbKey || process.env.IMGBB_API_KEY)?.trim();
        const templatePool = templates?.length > 0 ? templates : ['top_bar', 'cta_button', 'big_center', 'minimal'];

        if (!jobs?.length) return NextResponse.json({ error: 'No jobs' }, { status: 400 });

        const encoder = new TextEncoder();
        const nvidiaClient = effectiveNvidiaKey ? new OpenAI({
            apiKey: effectiveNvidiaKey,
            baseURL: "https://integrate.api.nvidia.com/v1",
            timeout: 15000 
        }) : null;

        const stream = new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode(`data: {"status":"started"}\n\n`));

                let globalPinIndex = 0;
                const limit = 3;
                const executing = new Set();
                const tasks = [];
                const historyTitles = [];

                for (const job of jobs) {
                    const { imageUrl, imageAlt, sourceUrl: jobSourceUrl, totalScraped: jobTotal } = job;
                    const slugKeyword = extractSlugKeyword(jobSourceUrl);
                    const imageCount = Math.max(Number(jobTotal) || 0, 1);
                    const count = Math.max(1, Math.min(10, variationCount || 1));

                    for (let v = 0; v < count; v++) {
                        const pIdx = globalPinIndex++;
                        const task = async () => {
                            try {
                                const template = templatePool[Math.floor(Math.random() * templatePool.length)];
                                const textPrompt = `You are a Pinterest Manager. Task: Write metadata for this image from "${jobSourceUrl || imageUrl}". Niche: ${niche}. Alt: ${imageAlt || 'N/A'}. Topic: ${slugKeyword || 'Inspiration'}. Return ONLY valid JSON: {"title": "Title", "description": "250-char description", "keywords": "list, of, words", "generatedBoardName": "Board"}`;

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
                                        if (raw) textData = extractJSON(raw);
                                    } catch (err) { console.warn(`[NVIDIA Fail] ${err.message}`); }
                                }

                                // 2. Try Gemini
                                if (!textData && effectiveGeminiKey) {
                                    try {
                                        const abort = new AbortController();
                                        const tid = setTimeout(() => abort.abort(), 12000);
                                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${effectiveGeminiKey}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ contents: [{ parts: [{ text: textPrompt }] }] }),
                                            signal: abort.signal
                                        });
                                        clearTimeout(tid);
                                        const json = await res.json();
                                        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                                        if (raw) textData = extractJSON(raw);
                                    } catch (err) { console.warn(`[Gemini Fail] ${err.message}`); }
                                }

                                // ── PERMANENT FALLBACK: If both AI fail, generate metadata from slug ──
                                if (!textData) {
                                    const base = slugKeyword || 'Style Inspiration';
                                    textData = {
                                        title: `${base} ${v + 1}`,
                                        description: `Looking for the best ${base}? This collection of ${niche} trends is perfect for your next ${base} project. Follow for more ${niche} inspiration and daily style tips.`,
                                        keywords: `${base.toLowerCase().replace(/\s+/g, ', ')}, ${niche.toLowerCase()}, inspiration, style`,
                                        generatedBoardName: niche !== 'Auto-Detect (AI)' ? niche : 'General Inspiration'
                                    };
                                    console.log(`[Permanent Fallback] Generated for pin ${pIdx}`);
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
                                    versionTag: '3.6-PERMANENT-FIX',
                                };

                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(pin)}\n\n`));
                            } catch (err) { console.error(`[Fatal Pin Error] ${pIdx}:`, err); }
                        };

                        const promise = (async () => {
                            if (executing.size >= limit) { await Promise.race(executing); }
                            const p = task();
                            executing.add(p);
                            await p;
                            executing.delete(p);
                        })();
                        tasks.push(promise);
                    }
                }

                await Promise.all(tasks);
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
