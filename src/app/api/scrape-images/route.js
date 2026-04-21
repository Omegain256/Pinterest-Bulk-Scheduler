import { NextResponse } from 'next/server';
import axios from 'axios';
import { load } from 'cheerio';

export async function POST(req) {
    try {
        const apiKey = req.headers.get('x-api-key')?.trim();
        const expectedKey = process.env.APP_API_KEY?.trim();

        if (!apiKey || apiKey !== expectedKey) {
            return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
        }

        let pageHtml;
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });
            pageHtml = response.data;
        } catch (fetchErr) {
            return NextResponse.json({ error: `Could not fetch URL: ${fetchErr.message}` }, { status: 422 });
        }

        const $ = load(pageHtml);
        let baseOrigin = '';
        try { baseOrigin = new URL(url).origin; } catch {}

        const images = [];
        const seen = new Set();

        function resolveUrl(src) {
            if (!src || src.startsWith('data:')) return null;
            try { return new URL(src, baseOrigin).href; } catch { return null; }
        }

        // Priority 1: Open Graph image (usually highest quality)
        const ogImage = resolveUrl($('meta[property="og:image"]').attr('content'));
        if (ogImage && !seen.has(ogImage)) {
            seen.add(ogImage);
            images.push({ src: ogImage, alt: 'Featured Image', isFeatured: true });
        }

        // Priority 2: Twitter card image
        const twitterImage = resolveUrl($('meta[name="twitter:image"]').attr('content'));
        if (twitterImage && !seen.has(twitterImage)) {
            seen.add(twitterImage);
            images.push({ src: twitterImage, alt: 'Twitter Card Image', isFeatured: true });
        }

        // Priority 3: All <img> tags
        $('img').each((_, el) => {
            const src = $(el).attr('src')
                || $(el).attr('data-src')
                || $(el).attr('data-lazy-src')
                || $(el).attr('data-original')
                || $(el).attr('data-srcset')?.split(',')[0]?.trim()?.split(' ')[0];

            const alt = ($(el).attr('alt') || '').trim();
            const widthAttr = parseInt($(el).attr('width') || '0');
            const heightAttr = parseInt($(el).attr('height') || '0');

            // Skip tiny images (tracking pixels / icons)
            if ((widthAttr > 0 && widthAttr < 150) || (heightAttr > 0 && heightAttr < 150)) return;

            const absoluteSrc = resolveUrl(src);
            if (!absoluteSrc) return;

            // Skip known non-content patterns
            if (/\/(pixel|tracker|beacon|analytics|ads?\/|advert|favicon|sprite|placeholder|lazy|blank|loading)\b/i.test(absoluteSrc)) return;
            if (/\.(svg|gif|ico)(\?|$)/i.test(absoluteSrc)) return;

            if (seen.has(absoluteSrc)) return;
            seen.add(absoluteSrc);

            images.push({ src: absoluteSrc, alt });
        });

        return NextResponse.json({
            images: images.slice(0, 60),
            total: images.length,
            pageTitle: $('title').first().text().trim() || ''
        });

    } catch (error) {
        console.error('Scrape images error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
