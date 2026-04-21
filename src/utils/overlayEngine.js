/**
 * overlayEngine.js — Server-side only canvas overlay engine.
 * Provides 4 Pinterest pin overlay templates matching reference images.
 * Imported ONLY by API route handlers — never by client components.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { interBoldBuffer } from '@/app/api/generate/font-data.js';

// ── Font Bootstrap ────────────────────────────────────────────────────────────
let _fontReady = false;
function ensureFont() {
    if (_fontReady) return;
    try { GlobalFonts.register(interBoldBuffer, 'Inter'); } catch (_) { /* already registered */ }
    _fontReady = true;
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

/**
 * Pixel-accurate text wrapping. ctx.font MUST be set beforehand.
 * Returns an array of lines that each fit within maxWidth.
 */
function wrapByWidth(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width <= maxW) {
            cur = test;
        } else {
            if (cur) lines.push(cur);
            cur = word;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

/**
 * Auto-scale font size so that all provided text lines fit within maxW.
 * Returns { size, lines } where lines are freshly wrapped at the chosen size.
 * @param {object} ctx  - canvas 2D context
 * @param {string} text - full text to wrap
 * @param {number} maxW - maximum line width in pixels
 * @param {number} maxLines - max allowed number of lines
 * @param {number} startSize - starting (maximum) font size to try
 * @param {number} minSize  - minimum font size floor
 */
function autoScale(ctx, text, maxW, maxLines = 4, startSize = 175, minSize = 48) {
    for (let size = startSize; size >= minSize; size -= 4) {
        ctx.font = `900 ${size}px Inter, sans-serif`;
        const lines = wrapByWidth(ctx, text, maxW);
        if (lines.length <= maxLines) return { size, lines };
    }
    // Fall back: use minSize and hard-cap lines
    ctx.font = `900 ${minSize}px Inter, sans-serif`;
    return { size: minSize, lines: wrapByWidth(ctx, text, maxW).slice(0, maxLines) };
}

/** Extract a leading number token ("15", "28+") from a title. */
function parseNum(title) {
    const m = title.match(/^(\d+\+?)\s+(.+)/);
    return m ? { num: m[1], rest: m[2] } : { num: null, rest: title };
}

/** Draw a rounded-rect path — call fill/stroke after. */
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

/**
 * Render a single line of text with black stroke + colour fill.
 * ctx.font, ctx.textAlign, ctx.textBaseline should be pre-set.
 */
function strokeFill(ctx, text, x, y, fillColor = '#FFFFFF', strokeRatio = 0.15) {
    const sw = parseFloat(ctx.font) * strokeRatio;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.lineWidth = sw;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fillColor;
    ctx.fillText(text, x, y);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 1 — Top Bar (no dark background)
// Reference: floating bold text positioned at the top of the image.
// Number (if any) in warm gold, keywords in white. Both stroked black for
// legibility on any background. Auto-scaled so nothing overflows.
// ─────────────────────────────────────────────────────────────────────────────
function buildTopBar(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H); // fully transparent — composited over the image

    const { num, rest } = parseNum(title);
    const keyText = (rest || title).toUpperCase();
    const PAD_X = 60;
    const MAX_W = W - PAD_X * 2;

    // Auto-scale keyword text so it fits
    const { size: textSize, lines: keyLines } = autoScale(ctx, keyText, MAX_W, 4, 175);

    const numSize   = num ? Math.round(textSize * 0.68) : 0;
    const LH_TEXT   = textSize * 1.1;
    const LH_NUM    = numSize  * 1.15;

    // Build render specs
    const specs = [
        ...(num ? [{ text: num,     px: numSize,   lh: LH_NUM,  color: '#C8961C' }] : []),
        ...keyLines.map(l => ({ text: l, px: textSize, lh: LH_TEXT, color: '#FFFFFF' })),
    ];

    // Start at top with comfortable padding
    const TOP_PAD = 72;
    let y = TOP_PAD;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Inter, sans-serif`;
        strokeFill(ctx, spec.text, W / 2, y, spec.color, 0.16);
        y += spec.lh;
    }

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2 — Title + CTA Button
// Reference: "28+ HOLIDAY OUTFITS" — bold white title at the top with
// drop-shadow (no backing), deep-red pill "SEE MORE →" button at the bottom.
// ─────────────────────────────────────────────────────────────────────────────
function buildCTA(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const PAD_X = 60;
    const MAX_W = W - PAD_X * 2;

    const setShadow = () => {
        ctx.shadowColor    = 'rgba(0,0,0,0.88)';
        ctx.shadowBlur     = 22;
        ctx.shadowOffsetX  = 4;
        ctx.shadowOffsetY  = 5;
    };
    const clearShadow = () => {
        ctx.shadowColor   = 'transparent';
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    };

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    let y = 75;

    if (num) {
        // Large number on its own first line
        const NS = 165;
        ctx.font = `900 ${NS}px Inter, sans-serif`;
        setShadow();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(num, W / 2, y);
        clearShadow();
        y += NS * 1.08;

        // Remaining title
        const { size: ts, lines } = autoScale(ctx, rest.toUpperCase(), MAX_W, 3, 118);
        const LH = ts * 1.12;
        setShadow();
        ctx.fillStyle = '#FFFFFF';
        for (const line of lines) {
            ctx.fillText(line, W / 2, y);
            y += LH;
        }
        clearShadow();
    } else {
        const { size: ts, lines } = autoScale(ctx, title.toUpperCase(), MAX_W, 3, 125);
        const LH = ts * 1.12;
        setShadow();
        ctx.fillStyle = '#FFFFFF';
        for (const line of lines) {
            ctx.fillText(line, W / 2, y);
            y += LH;
        }
        clearShadow();
    }

    // ── Deep-red pill CTA button anchored to bottom ──────────────────────
    const BW = 840, BH = 120, BR = 60;
    const BX = (W - BW) / 2, BY = H - BH - 88;

    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur    = 24;
    ctx.shadowOffsetY = 10;
    rrect(ctx, BX, BY, BW, BH, BR);
    ctx.fillStyle = '#C91C1C';
    ctx.fill();

    ctx.shadowColor   = 'transparent';
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;

    ctx.font         = `800 64px Inter, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#FFFFFF';
    ctx.fillText('SEE MORE \u2192', W / 2, BY + BH / 2);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3 — Big Bold Center
// Reference: "15 AIRPORT OUTFIT IDEAS" — massive white text with black stroke,
// centered vertically. Auto-scaled with wrapByWidth so nothing ever overflows.
// ─────────────────────────────────────────────────────────────────────────────
function buildBigCenter(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const keyText = (rest || title).toUpperCase();
    const PAD_X = 60;
    const MAX_W = W - PAD_X * 2;

    // Auto-scale keyword text
    const { size: textSize, lines: keyLines } = autoScale(ctx, keyText, MAX_W, 4, 175);

    const numSize = num ? Math.round(textSize * 0.65) : 0;
    const LH_TEXT = textSize * 1.1;
    const LH_NUM  = numSize  * 1.15;

    const specs = [
        ...(num ? [{ text: num, px: numSize, lh: LH_NUM  }] : []),
        ...keyLines.map(l => ({ text: l,     px: textSize, lh: LH_TEXT })),
    ];

    const totalH = specs.reduce((s, l) => s + l.lh, 0);
    let y = (H - totalH) / 2; // vertically centered

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Inter, sans-serif`;
        strokeFill(ctx, spec.text, W / 2, y, '#FFFFFF', 0.15);
        y += spec.lh;
    }

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 4 — Minimal
// Returns null → caller uses original image URL unchanged.
// ─────────────────────────────────────────────────────────────────────────────
function buildMinimal() { return null; }

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * @param {string} title    - Pin title text composited onto the image
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
        default:           return buildTopBar(title);
    }
}
