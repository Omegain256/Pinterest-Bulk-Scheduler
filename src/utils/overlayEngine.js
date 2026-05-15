/**
 * overlayEngine.js — Server-side canvas overlay engine.
 * Canvas: 1080 × 1920 (9:16 — standard Pinterest/Instagram format).
 * Font:   Montserrat Bold (geometric sans-serif, Pinterest-standard).
 * Imported ONLY by API route handlers, never by client components.
 *
 * IMPORTANT: Font is loaded from an embedded base64 buffer (montserrat-font-data.js)
 * NOT from the filesystem — this is required for Vercel serverless where
 * process.cwd() does not point to the project source and readFileSync fails silently.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { montserratBoldBuffer } from './montserrat-font-data.js';

// ── Font Bootstrap ────────────────────────────────────────────────────────────
// Font is embedded as a base64 buffer at build time — no filesystem access.
// This is the only approach that works reliably on Vercel serverless.
let fontLoaded = false;
function ensureFont() {
    if (fontLoaded) return;
    try {
        GlobalFonts.register(montserratBoldBuffer, 'Montserrat');
        console.log(`[overlayEngine] Montserrat Bold registered from embedded buffer (${montserratBoldBuffer.length} bytes)`);
        fontLoaded = true;
    } catch (regErr) {
        // Ignore duplicate registration errors during Next.js hot reloads
        if (regErr.message && regErr.message.includes('already')) {
            fontLoaded = true;
        } else {
            console.error('[overlayEngine] Font registration FAILED:', regErr.message);
        }
    }
}

// ── Canvas constants — 9:16 ───────────────────────────────────────────────────
const W = 1080;  // width
const H = 1920;  // height  (9:16 ratio)

// ── Fixed font size (140–160pt range, per user spec) ─────────────────────────
const FONT_PX    = 150;           // main title font size in pixels
const NUM_PX     = Math.round(FONT_PX * 1.10); // Number is now 110% of title for impact
const GOLD       = '#C8961C';     // Premium gold accent color
const PAD_X      = 80;            // horizontal padding (80px each side)
const MAX_W      = W - PAD_X * 2; // max line width = 920px
const LH         = FONT_PX * 1.06; // tight line height matching reference
const NUM_LH     = NUM_PX * 1.12;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pixel-accurate word wrapping with dynamic font scaling.
 * If the resulting lines would overflow the layout, it scales down the font and re-wraps.
 */
function wrapAndScale(ctx, text, maxW, initialPx, maxLines = 4) {
    let currentPx = initialPx;
    let lines = [];
    
    // Scale down loop
    while (currentPx > 70) { // Slightly lower floor for very long titles
        ctx.font = `900 ${currentPx}px Montserrat`;
        const words = text.trim().split(/\s+/);
        lines = [];
        let cur = '';
        
        for (const word of words) {
            const test = cur ? `${cur} ${word}` : word;
            const metrics = ctx.measureText(test);
            
            if (metrics.width <= maxW) {
                cur = test;
            } else {
                if (cur) lines.push(cur);
                cur = word;
                
                // CRITICAL: If a single word is wider than maxW even at this font size,
                // we MUST shrink further immediately.
                if (ctx.measureText(word).width > maxW) {
                    lines = [text]; // force overflow detection
                    break;
                }
            }
        }
        if (cur) lines.push(cur);
        
        // If it fits within maxLines, we're good
        if (lines.length <= maxLines) {
            // Check if ANY line is still wider (edge case)
            const overflows = lines.some(l => ctx.measureText(l).width > maxW + 5);
            if (!overflows) break;
        }
        
        // Otherwise, shrink and try again
        currentPx -= 8;
    }
    
    return { lines, px: currentPx, lh: currentPx * 1.05 };
}

/**
 * Render text with thin stroke + drop shadow + white fill.
 * Thin stroke (lineWidth ~5px) guarantees readability on any background
 * including completely white images. NOT the heavy 26px from before.
 * ctx.font, ctx.textAlign, ctx.textBaseline must be set before calling.
 */
function shadowFill(ctx, text, x, y, color = '#FFFFFF') {
    // 1. Subtle drop shadow
    ctx.shadowColor   = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur    = 14;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // 2. Thin dark stroke first (underneath fill) for light-background readability
    ctx.lineWidth     = 6;
    ctx.strokeStyle   = 'rgba(0, 0, 0, 0.70)';
    ctx.lineJoin      = 'round';
    ctx.strokeText(text, x, y);

    // 3. White fill on top
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Reset
    ctx.shadowColor   = 'transparent';
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/** Extract a leading number token ("15", "28+") from a title string. Handles "13+ Ways" or "13 Outfit". */
function parseNum(title) {
    if (!title) return { num: null, rest: '' };
    // Match leading digits possibly followed by + or other chars, then a separator
    const m = title.match(/^(\d+\+?)\s*(.*)/);
    if (m) {
        let rest = m[2].trim();
        // If rest starts with "WAYS TO" or "IDEAS", we might want to clean it or keep it
        return { num: m[1], rest: rest || '' };
    }
    return { num: null, rest: title };
}

/** Draw rounded-rect path (call fill/stroke after). */
function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 1 — Top Bar
// Floating bold white text at the top. Number in gold. Shadow-only.
// ─────────────────────────────────────────────────────────────────────────────
function buildTopBar(title) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const keyText = (rest || title).toUpperCase();
    const { lines: keyLines, px: activeFontPx, lh: activeLH } = wrapAndScale(ctx, keyText, MAX_W, FONT_PX, 7);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    const specs = [
        ...(num ? [{ text: num, px: NUM_PX, lh: NUM_LH, color: GOLD }] : []),
        ...keyLines.map(l => ({ text: l, px: activeFontPx, lh: activeLH, color: '#FFFFFF' })),
    ];

    let y = 90; // top padding
    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Montserrat, sans-serif`;
        shadowFill(ctx, spec.text, W / 2, y, spec.color);
        y += spec.lh;
    }

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2 — CTA Button
// Large number + title text at top (shadow-only). Deep-red pill "SEE MORE →"
// anchored to the bottom.
// ─────────────────────────────────────────────────────────────────────────────
function buildCTA(title) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#FFFFFF';

    let y = 90;

    const { lines, px: activeFontPx, lh: activeLH } = wrapAndScale(ctx, (rest || title).toUpperCase(), MAX_W, FONT_PX, 6);
    
    if (num) {
        // Large number first in Gold
        ctx.font = `900 ${NUM_PX}px Montserrat, sans-serif`;
        shadowFill(ctx, num, W / 2, y, GOLD);
        y += NUM_PX * 1.1;

        for (const line of lines) {
            ctx.font = `900 ${activeFontPx}px Montserrat, sans-serif`;
            shadowFill(ctx, line, W / 2, y);
            y += activeLH;
        }
    } else {
        for (const line of lines) {
            ctx.font = `900 ${activeFontPx}px Montserrat, sans-serif`;
            shadowFill(ctx, line, W / 2, y);
            y += activeLH;
        }
    }

    // ── Deep-red pill button at bottom ───────────────────────────────────
    const BW = 900, BH = 130, BR = 65;
    const BX = (W - BW) / 2;
    const BY = H - BH - 110;

    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur    = 24;
    ctx.shadowOffsetY = 12;
    rrect(ctx, BX, BY, BW, BH, BR);
    ctx.fillStyle = '#C91C1C';
    ctx.fill();

    ctx.shadowColor   = 'transparent';
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;

    ctx.font         = `800 70px Montserrat, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#FFFFFF';
    ctx.fillText('SEE MORE \u2192', W / 2, BY + BH / 2);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3 — Big Bold Center
// Exact match to reference: "15 AIRPORT OUTFIT IDEAS"
// • Font: Montserrat Bold, FIXED at 150px (140–160pt spec)
// • Text wraps with wrapByWidth — NOT one-word-per-line (prevents takeover)
// • Max 4 lines hard cap
// • Center-aligned, bottom-anchored so block ends at ~88% of canvas height
// • Drop shadow only — NO stroke
// ─────────────────────────────────────────────────────────────────────────────
function buildBigCenter(title) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const keyText = (rest || title).toUpperCase();

    // ── Font Scaling ──
    const { lines: keyLines, px: activeFontPx, lh: activeLH } = wrapAndScale(ctx, keyText, MAX_W, FONT_PX, 7);

    const specs = keyLines.map(l => ({ text: l, px: activeFontPx, lh: activeLH }));
    const totalTextH = specs.reduce((s, l) => s + l.lh, 0);
    
    // Number Layout (Badge Style)
    let numH = 0;
    if (num) {
        numH = NUM_PX * 1.2 + 40; // Space for badge + gap
    }

    const totalH = totalTextH + numH;

    // True vertical center
    let y = H * 0.50 - totalH / 2;
    if (y < H * 0.10) y = H * 0.10;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    // 1. Draw Number Badge if exists
    if (num) {
        ctx.font = `900 ${NUM_PX}px Montserrat, sans-serif`;
        const metrics = ctx.measureText(num);
        const bw = Math.max(metrics.width + 80, 200);
        const bh = NUM_PX * 1.2;
        const bx = (W - bw) / 2;
        
        // Premium Sticker/Badge shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 15;
        
        // Gold Badge Background
        rrect(ctx, bx, y, bw, bh, 30);
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.restore();

        // Number Text inside badge (White for contrast)
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(num, W / 2, y + bh / 2 + 5);
        
        y += bh + 40; // Gap after badge
    }

    // 2. Draw Title Text
    ctx.textBaseline = 'top';
    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Montserrat, sans-serif`;
        shadowFill(ctx, spec.text, W / 2, y, '#FFFFFF');
        y += spec.lh;
    }

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 4 — Minimal (no overlay)
// ─────────────────────────────────────────────────────────────────────────────
function buildMinimal() { return null; }

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * @param {string} title    - Pin title text
 * @param {string} template - 'top_bar' | 'cta_button' | 'big_center' | 'minimal'
 * @returns {Buffer | null}
 */
export function generateOverlayBuffer(title, template) {
    ensureFont();
    switch (template) {
        case 'top_bar':    return buildBigCenter(title); // Enforce big_center style
        case 'cta_button': return buildBigCenter(title); // Enforce big_center style
        case 'big_center': return buildBigCenter(title);
        case 'minimal':    return buildMinimal();
        default:           return buildBigCenter(title);
    }
}

// Export canvas dimensions so the route can use them for sharp resize
export const CANVAS_W = W;
export const CANVAS_H = H;
