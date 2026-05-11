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

        const { url, limit } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
        }

        const imageLimit = limit && Number.isInteger(limit) && limit > 0 ? limit : null;

        let pageHtml;
        try {
            const response = await axios.get(url, {
                timeout: 25000,
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

        // ── Helpers ──────────────────────────────────────────────────────────
        function resolveUrl(src) {
            if (!src || src.startsWith('data:')) return null;
            try { return new URL(src, url).href; } catch { return null; }
        }

        /** Pick the highest-resolution URL from a srcset string */
        function bestFromSrcset(srcset) {
            if (!srcset) return null;
            // srcset entries: "url 800w, url 1200w" or "url 1x, url 2x"
            const entries = srcset.split(',').map(s => s.trim()).filter(Boolean);
            // Take the last entry (typically largest)
            const last = entries[entries.length - 1];
            return last ? last.trim().split(/\s+/)[0] : null;
        }

        function isBadUrl(abs) {
            // Tracking / utility
            if (/\/(pixel|tracker|beacon|analytics|ads?\/|advert|favicon|sprite|placeholder|lazy|blank|loading)\b/i.test(abs)) return true;
            // Non-photo formats
            if (/\.(svg|gif|ico)(\?|$)/i.test(abs)) return true;
            // Author / avatar / profile paths
            if (/\/(author|avatar|gravatar|headshot|profile|bio|byline)\/|\/(wp-content\/uploads\/avatars|wp-content\/uploads\/user)\//i.test(abs)) return true;
            // Logo by URL path or filename
            if (/\/(logo|logos|site-logo|brand|branding|header-logo|footer-logo)[\/\-_.]/i.test(abs)) return true;
            if (/[\/\-_.]logo[\/\-_.\d]|[\/\-_.]logo$/i.test(abs)) return true;
            return false;
        }

        function inBioContext($el) {
            return $el.closest(
                '[class*="author"],[class*="bio"],[class*="avatar"],[class*="gravatar"],' +
                '[class*="profile"],[class*="headshot"],[class*="byline"],' +
                '[id*="author"],[id*="bio"]'
            ).length > 0;
        }

        function addImage(src, alt, isFeatured = false) {
            const abs = resolveUrl(src);
            if (!abs || seen.has(abs) || isBadUrl(abs)) return;
            seen.add(abs);
            images.push({ src: abs, alt: (alt || '').trim(), isFeatured });
        }

        const images = [];
        const seen = new Set();

        // Priority 1: Meta images (OG, Twitter, link rel)
        ['meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]', 'meta[name="twitter:image:src"]']
            .forEach(sel => addImage($( sel).attr('content'), 'Featured Image', true));
        addImage($('link[rel="image_src"]').attr('href'), 'Featured Image', true);

        // Priority 2: <picture> / <source srcset> — often used for modern responsive images
        $('picture source').each((_, el) => {
            const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
            const best = bestFromSrcset(srcset);
            if (best) addImage(best, '');
        });

        // Priority 3: <img> tags — exhaustive lazy-load attribute search
        $('img').each((_, el) => {
            const $el = $(el);
            if (inBioContext($el)) return;

            const widthAttr  = parseInt($el.attr('width')  || '0');
            const heightAttr = parseInt($el.attr('height') || '0');

            // Only skip if BOTH dimensions are explicitly tiny (real tracking pixels)
            if (widthAttr > 0 && widthAttr < 10 && heightAttr > 0 && heightAttr < 10) return;

            const alt = ($el.attr('alt') || '').trim();

            // Try every known lazy-load attribute, preferring highest-res
            const candidates = [
                // Standard src first
                $el.attr('src'),
                // Lazy-load single-url attributes
                $el.attr('data-src'),
                $el.attr('data-lazy-src'),
                $el.attr('data-original'),
                $el.attr('data-image'),
                $el.attr('data-full'),
                $el.attr('data-large_image'),
                $el.attr('data-zoom-image'),
                $el.attr('data-hi-res-src'),
                // Srcset attributes — pick best resolution
                bestFromSrcset($el.attr('srcset')),
                bestFromSrcset($el.attr('data-srcset')),
                bestFromSrcset($el.attr('data-lazy-srcset')),
            ].filter(Boolean);

            for (const candidate of candidates) {
                if (!candidate.startsWith('data:')) {
                    addImage(candidate, alt);
                    break; // Use the first valid (non-data-URI) candidate
                }
            }
        });

        const finalImages = imageLimit ? images.slice(0, imageLimit) : images.slice(0, 60);
        return NextResponse.json({
            images: finalImages,
            total: images.length,
            pageTitle: $('title').first().text().trim() || ''
        });

    } catch (error) {
        console.error('Scrape images error:', error);
        return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
    }
}
