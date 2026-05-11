import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { generateOverlayBuffer } from '@/utils/overlayEngine.js';

export const maxDuration = 300; // 5 minutes max for batch job
export const runtime = 'nodejs';

export async function POST(req) {
    return runScheduler(req);
}

export async function GET(req) {
    return runScheduler(req); // Vercel Cron sends a GET request
}

async function runScheduler(req) {
    try {
        console.log("[SCHEDULER] Starting automated run...");
        
        // --- 1. Authentication ---
        // Support both manual UI trigger (x-api-key) and Vercel Cron (CRON_SECRET)
        const authHeader = req.headers.get('authorization');
        const apiKeyHeader = req.headers.get('x-api-key');
        
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
        const isManual = apiKeyHeader === process.env.APP_API_KEY;

        if (!isCron && !isManual) {
            return NextResponse.json({ error: 'Unauthorized: Invalid Cron Secret or API Key' }, { status: 401 });
        }

        // --- 2. Load Configuration ---
        let wpUrl, wpUser, wpAppPass, dailyLimit, geminiKey, imgbbKey, niche;
        
        if (isManual && req.method === 'POST') {
            const body = await req.json();
            wpUrl = body.wpUrl || process.env.WP_URL;
            wpUser = body.wpUser || process.env.WP_USER;
            wpAppPass = body.wpAppPass || process.env.WP_APP_PASS;
            dailyLimit = body.dailyPinLimit || process.env.DAILY_PIN_LIMIT || 5;
            geminiKey = body.geminiKey || process.env.GEMINI_API_KEY;
            imgbbKey = body.imgbbKey || process.env.IMGBB_API_KEY;
            niche = body.niche || 'Auto-Detect (AI)';
        } else {
            wpUrl = process.env.WP_URL;
            wpUser = process.env.WP_USER;
            wpAppPass = process.env.WP_APP_PASS;
            dailyLimit = process.env.DAILY_PIN_LIMIT || 5;
            geminiKey = process.env.GEMINI_API_KEY;
            imgbbKey = process.env.IMGBB_API_KEY;
            niche = 'Auto-Detect (AI)';
        }

        if (!wpUrl || !wpUser || !wpAppPass) {
            return NextResponse.json({ error: 'Missing WordPress configuration.' }, { status: 400 });
        }

        const wpBase = wpUrl.replace(/\/$/, '');
        const authString = Buffer.from(`${wpUser}:${wpAppPass}`).toString('base64');
        const wpHeaders = { 'Authorization': `Basic ${authString}` };

        // --- 3. Fetch Posts from WordPress ---
        console.log(`[SCHEDULER] Fetching recent posts from ${wpBase}...`);
        const postsRes = await axios.get(`${wpBase}/wp-json/wp/v2/posts?per_page=20&status=publish`, {
            headers: wpHeaders
        });
        
        const posts = postsRes.data;
        let generatedCount = 0;
        const results = [];

        // --- 4. Process Queue ---
        for (const post of posts) {
            if (generatedCount >= dailyLimit) break;

            const postUrl = post.link;
            const meta = post.meta || {};
            const status = meta.pinterest_status || 'pending';
            const lastImageIndex = parseInt(meta.pinterest_last_image_index || '0', 10);

            if (status === 'completed' || status === 'error_404') {
                continue; // Skip finished/broken articles
            }

            console.log(`[SCHEDULER] Processing ${postUrl} (Last Image Index: ${lastImageIndex})`);

            // Phase 4A: Scrape Images from the post URL
            let pageImages = [];
            try {
                // Call our internal scraper logic or just fetch the HTML
                const htmlRes = await axios.get(postUrl, {
                    timeout: 45000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                
                // Simple regex extraction for now to keep it lightweight, or we can use cheerio
                const cheerio = require('cheerio');
                const $ = cheerio.load(htmlRes.data);
                
                // Extract main content images (avoid sidebars)
                $('article img, .entry-content img, .post-content img').each((i, el) => {
                    let src = $(el).attr('src') || $(el).attr('data-src');
                    if (src && !src.includes('avatar') && !src.includes('logo')) {
                        pageImages.push(src);
                    }
                });

                if (pageImages.length === 0) {
                    console.log(`[SCHEDULER] No suitable images found for ${postUrl}`);
                    continue;
                }

            } catch (err) {
                console.error(`[SCHEDULER] Failed to scrape ${postUrl}: ${err.message}`);
                // Mark as error
                await updatePostMeta(wpBase, post.id, wpHeaders, 'error_404', lastImageIndex);
                continue;
            }

            const targetImageIndex = lastImageIndex;
            
            if (targetImageIndex >= pageImages.length) {
                console.log(`[SCHEDULER] All images used for ${postUrl}. Marking completed.`);
                await updatePostMeta(wpBase, post.id, wpHeaders, 'completed', lastImageIndex);
                continue;
            }

            const targetImageUrl = pageImages[targetImageIndex];
            console.log(`[SCHEDULER] Selected image ${targetImageIndex + 1}/${pageImages.length}: ${targetImageUrl}`);

            // Phase 4B: Generate Pin using Gemini & overlayEngine
            try {
                // Determine topic
                let slugKeyword = '';
                try {
                    const u = new URL(postUrl);
                    const segs = u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
                    let slug = segs[segs.length - 1] || '';
                    slugKeyword = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                } catch(e) {}

                const textPrompt = `You are a professional Pinterest Content Creator. 
Task: Write metadata for an image from "${postUrl}".
Topic: ${slugKeyword || 'Inspiration'}

REQUIRED JSON FORMAT:
{
  "title": "SEO title",
  "overlayText": "Visual hook (MUST include keyword). Max 25 chars.",
  "description": "Engaging description with keywords.",
  "keywords": "5 keywords",
  "generatedBoardName": "Board name",
  "imagePrompt": "N/A"
}`;

                const restResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey.trim()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: textPrompt }] }] })
                });

                if (!restResponse.ok) throw new Error('Gemini API Failed');
                const resultJson = await restResponse.json();
                const generatedText = resultJson.candidates[0].content.parts[0].text.trim();
                const cleanJsonStr = generatedText.replace(/^```json/i, '').replace(/```$/g, '').trim();
                const textData = JSON.parse(cleanJsonStr);

                // Apply Overlay
                let finalOverlay = textData.overlayText || slugKeyword || 'Style Inspiration';
                const templatesList = ['top_bar', 'cta_button', 'big_center'];
                const template = templatesList[Math.floor(Math.random() * templatesList.length)];
                
                const finalImageUrl = await applyTemplate(targetImageUrl, finalOverlay, template, imgbbKey);

                // We have successfully created the Pin
                results.push({
                    sourceUrl: postUrl,
                    title: textData.title,
                    description: textData.description,
                    imageUrl: finalImageUrl,
                    boardName: textData.generatedBoardName,
                    keywords: textData.keywords
                });

                generatedCount++;

                // Update WordPress Tracker
                const newIndex = targetImageIndex + 1;
                const newStatus = newIndex >= pageImages.length ? 'completed' : 'in_progress';
                await updatePostMeta(wpBase, post.id, wpHeaders, newStatus, newIndex);

            } catch (err) {
                console.error(`[SCHEDULER] Failed generating pin for ${postUrl}: ${err.message}`);
                continue;
            }
        }

        console.log(`[SCHEDULER] Job complete. Generated ${generatedCount} pins.`);
        return NextResponse.json({ success: true, generated: generatedCount, pins: results });

    } catch (err) {
        console.error("[SCHEDULER ERROR]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// --- Helper Functions ---

async function updatePostMeta(wpBase, postId, headers, status, lastIndex) {
    try {
        await axios.post(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
            meta: {
                pinterest_status: status,
                pinterest_last_image_index: lastIndex
            }
        }, { headers });
    } catch (err) {
        console.error(`Failed to update post meta for ${postId}:`, err.message);
        // Note: If this fails with 401/403, the meta fields might not be registered in WP.
    }
}

async function applyTemplate(imageUrl, overlayTitle, template, imgbbKey) {
    try {
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const rawBuffer = Buffer.from(imageRes.data);

        const overlayPngBuffer = generateOverlayBuffer(overlayTitle, template);
        const overlayPngReady = await sharp(overlayPngBuffer).png().toBuffer();
        
        const compositedBuffer = await sharp(rawBuffer)
            .resize(1080, 1920, { fit: 'cover' })
            .composite([{ input: overlayPngReady, top: 0, left: 0, blend: 'over' }])
            .jpeg({ quality: 90 })
            .toBuffer();

        const formData = new FormData();
        formData.append('image', compositedBuffer.toString('base64'));
        formData.append('name', overlayTitle);

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
            method: 'POST',
            body: formData
        });

        if (imgbbResponse.ok) {
            const uploadJson = await imgbbResponse.json();
            return uploadJson.data.url;
        } else {
            return `data:image/jpeg;base64,${compositedBuffer.toString('base64')}`;
        }
    } catch (e) {
        console.error("Template Application Error:", e);
        return imageUrl; // fallback to original
    }
}
