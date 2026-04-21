/**
 * overlayEngine.js — Server-side canvas overlay engine.
 * Canvas: 1080 × 1920 (9:16 — standard Pinterest/Instagram format).
 * Font:   Montserrat Bold (geometric sans-serif, Pinterest-standard).
 * Imported ONLY by API route handlers, never by client components.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Font Bootstrap ────────────────────────────────────────────────────────────
let _fontReady = false;
function ensureFont() {
    if (_fontReady) return;
    try {
        const buf = readFileSync(join(process.cwd(), 'src/utils/fonts/Montserrat-Bold.ttf'));
        GlobalFonts.register(buf, 'Montserrat');
    } catch (e) {
        console.warn('[overlayEngine] Montserrat load failed, falling back to sans-serif:', e.message);
    }
    _fontReady = true;
}

// ── Canvas constants — 9:16 ───────────────────────────────────────────────────
const W = 1080;  // width
const H = 1920;  // height  (9:16 ratio)

// ── Fixed font size (140–160pt range, per user spec) ─────────────────────────
const FONT_PX    = 150;           // main title font size in pixels
const NUM_PX     = Math.round(FONT_PX * 0.68); // number is 68% of title size
const PAD_X      = 80;            // horizontal padding (80px each side)
const MAX_W      = W - PAD_X * 2; // max line width = 920px
const LH         = FONT_PX * 1.06; // tight line height matching reference
const NUM_LH     = NUM_PX * 1.12;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pixel-accurate word wrapping. ctx.font MUST be set before calling.
 * Groups as many words as fit on each line — NOT one-word-per-line.
 * This keeps text at the fixed 150px size without taking over the whole image.
 */
function wrapByWidth(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width <= maxW) { cur = test; }
        else { if (cur) lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
}

/**
 * Render text with subtle drop shadow (NO stroke — no black blob effect).
 * ctx.font, ctx.textAlign, ctx.textBaseline must be set before calling.
 */
function shadowFill(ctx, text, x, y, color = '#FFFFFF') {
    ctx.shadowColor   = 'rgba(0, 0, 0, 0.62)';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowColor   = 'transparent';
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/** Extract a leading number token ("15", "28+") from a title string. */
function parseNum(title) {
    const m = title.match(/^(\d+\+?)\s+(.+)/);
    return m ? { num: m[1], rest: m[2] } : { num: null, rest: title };
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

    ctx.font = `900 ${FONT_PX}px Montserrat, sans-serif`;
    const keyLines = wrapByWidth(ctx, keyText, MAX_W).slice(0, 4);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    const specs = [
        ...(num ? [{ text: num, px: NUM_PX, lh: NUM_LH, color: '#C8961C' }] : []),
        ...keyLines.map(l => ({ text: l, px: FONT_PX, lh: LH, color: '#FFFFFF' })),
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

    if (num) {
        // Large number first
        const NS = Math.round(FONT_PX * 1.15); // number slightly bigger for CTA
        ctx.font = `900 ${NS}px Montserrat, sans-serif`;
        shadowFill(ctx, num, W / 2, y);
        y += NS * 1.1;

        ctx.font = `900 ${FONT_PX}px Montserrat, sans-serif`;
        const lines = wrapByWidth(ctx, (rest || '').toUpperCase(), MAX_W).slice(0, 3);
        for (const line of lines) {
            shadowFill(ctx, line, W / 2, y);
            y += LH;
        }
    } else {
        ctx.font = `900 ${FONT_PX}px Montserrat, sans-serif`;
        const lines = wrapByWidth(ctx, title.toUpperCase(), MAX_W).slice(0, 4);
        for (const line of lines) {
            shadowFill(ctx, line, W / 2, y);
            y += LH;
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

    // Fixed 150px — matches the 140-160pt spec. NOT auto-scaled to fill width.
    ctx.font = `900 ${FONT_PX}px Montserrat, sans-serif`;
    const keyLines = wrapByWidth(ctx, keyText, MAX_W).slice(0, 4);

    const specs = [
        ...(num ? [{ text: num, px: NUM_PX, lh: NUM_LH }] : []),
        ...keyLines.map(l => ({ text: l, px: FONT_PX, lh: LH })),
    ];

    const totalH = specs.reduce((s, l) => s + l.lh, 0);

    // Bottom-anchor: block ends at 88% of canvas height
    // For a 4-line block this puts start at ~52–56% — lower-center like reference
    let y = H * 0.88 - totalH;
    if (y < H * 0.10) y = H * 0.10; // never above top 10%

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Montserrat, sans-serif`;
        shadowFill(ctx, spec.text, W / 2, y);
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
        case 'top_bar':    return buildTopBar(title);
        case 'cta_button': return buildCTA(title);
        case 'big_center': return buildBigCenter(title);
        case 'minimal':    return buildMinimal();
        default:           return buildBigCenter(title);
    }
}

// Export canvas dimensions so the route can use them for sharp resize
export const CANVAS_W = W;
export const CANVAS_H = H;
