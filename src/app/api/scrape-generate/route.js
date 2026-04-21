import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.APP_API_KEY?.trim();

        if (!apiKey || apiKey !== expectedKey) {
            return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        const { images, variationCount, niche, geminiKey, existingBoards, sourceUrl } = await req.json();

        const effectiveGeminiKey = (geminiKey || process.env.GEMINI_API_KEY)?.trim();

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
                            const isAutoDetect = niche === 'Auto-Detect (AI)';
                            const nicheInstruction = isAutoDetect
                                ? `You MUST analyze this URL and assign it to ONE of these exact four categories: "Beauty & Makeup", "Hair Styling", "Fashion & Outfits", or "Nails & Beauty".`
                                : `Generate highly engaging, click-driving Pinterest content for the "${niche}" niche.`;

                            const variationPrompt = v > 0
                                ? `This is variation #${v + 1}. CRITICAL: Use a COMPLETELY DIFFERENT angle, tone, and phrasing. Different narrative approach and keywords from all previous variations.`
                                : '';

                            const boardsInstruction = existingBoards && existingBoards.length > 0
                                ? `\nEXISTING BOARDS: ${existingBoards.join(', ')}\nCRITICAL: If one of these boards is a suitable match, use its EXACT name for "generatedBoardName".`
                                : 'Generate an intelligent, keyword-rich board name (e.g., "Rodeo Outfits"). It should be broad and reusable.';

                            const categorySchemaField = isAutoDetect
                                ? `\n  "autoCategory": "Exactly ONE of the 4 valid categories",`
                                : '';

                            const historyPrompt = historyTitles.length > 0
                                ? `\nCRITICAL ANTI-SPAM RULE: Do NOT use similar sentence structure or overlapping vocabulary as: [${historyTitles.slice(-5).join(' | ')}].`
                                : '';

                            const angles = [
                                'A deeply personal, first-person narrative recommendation.',
                                'A highly structured, listicle-style summary.',
                                'An aesthetic, romanticized editorial approach.',
                                'A bold, myth-busting styling tip.',
                                'A hyper-specific styling hack for everyday life.'
                            ];
                            const randomAngle = angles[Math.floor(Math.random() * angles.length)];

                            const textPrompt = `You are an expert Pinterest marketer. Write pin content for an image sourced from this page:

Source URL: ${sourceUrl || image.src}
Image URL: ${image.src}
Image context: ${image.alt || 'N/A'}

${nicheInstruction}
${variationPrompt}
${boardsInstruction}
${historyPrompt}

CRITICAL RULES:
1. The subject MUST ALWAYS be female unless the URL/topic explicitly states otherwise.
2. DO NOT use generic AI buzzwords like "Chic", "Elevated", "Stunning", "Captivating", or "Trendy".
3. Use this exact copywriting angle: "${randomAngle}"

Return ONLY a valid raw JSON object. NO markdown, NO backticks.
{${categorySchemaField}
  "title": "Full, engaging Pinterest title. Max 100 chars. Perfect grammar.",
  "description": "Compelling, keyword-rich description between 100-500 chars. Keywords blend naturally. NO hashtags.",
  "keywords": "comma separated list of 5-8 SEO keywords",
  "generatedBoardName": "Pinterest board name to use"
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
                                    title: image.alt ? `${image.alt} — Pin` : 'Scraped Image Pin',
                                    description: 'AI generation failed. Please edit this pin manually.',
                                    keywords: 'content, style, inspiration',
                                    generatedBoardName: niche !== 'Auto-Detect (AI)' ? niche : 'My Boards'
                                };
                            }

                            const generatedPin = {
                                id: Date.now() + pinIndex + Math.random(),
                                sourceUrl: sourceUrl || image.src,
                                imageUrl: image.src,
                                title: (textData.title || '').substring(0, 100),
                                description: (textData.description || '').substring(0, 500),
                                keywords: textData.keywords || '',
                                boardName: textData.generatedBoardName || 'My Boards',
                                publishDate: new Date().toISOString(),
                                variation: v + 1,
                                versionTag: '3.0-SCRAPE'
                            };

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(generatedPin)}\n\n`));
                            pinIndex++;

                        } catch (err) {
                            console.error(`Error for image ${image.src}:`, err.message);
                            const errorPin = {
                                id: Date.now() + pinIndex + Math.random(),
                                sourceUrl: sourceUrl || image.src,
                                imageUrl: image.src,
                                title: `Content generation failed`,
                                description: 'Please edit this pin manually.',
                                keywords: 'error',
                                boardName: 'Drafts',
                                publishDate: new Date().toISOString(),
                                versionTag: '3.0-SCRAPE-ERROR'
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorPin)}\n\n`));
                            pinIndex++;
                        }

                        // Respect rate limits
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
