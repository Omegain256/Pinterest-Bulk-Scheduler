/**
 * overlayEngine.js — Server-side only canvas overlay engine.
 * Templates match the 3 reference images exactly.
 * Imported ONLY by API route handlers — never by client components.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { interBoldBuffer } from '@/app/api/generate/font-data.js';

// ── Font Bootstrap ────────────────────────────────────────────────────────────
let _fontReady = false;
function ensureFont() {
    if (_fontReady) return;
    try { GlobalFonts.register(interBoldBuffer, 'Inter'); } catch (_) {}
    _fontReady = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pixel-accurate line wrapping. ctx.font must be set first. */
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
 * Auto-scale: largest font where all wrapped lines fit within maxW and
 * total line count is ≤ maxLines. Returns { size, lines }.
 */
function autoScale(ctx, text, maxW, maxLines = 4, startSize = 175, minSize = 44) {
    for (let size = startSize; size >= minSize; size -= 4) {
        ctx.font = `900 ${size}px Inter, sans-serif`;
        const lines = wrapByWidth(ctx, text, maxW);
        if (lines.length <= maxLines) return { size, lines };
    }
    ctx.font = `900 ${minSize}px Inter, sans-serif`;
    return { size: minSize, lines: wrapByWidth(ctx, text, maxW).slice(0, maxLines) };
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
// Template 1 — Top Bar (no dark background)
// Floating bold white text at the top of the image.
// Number in gold, keywords in white. Subtle shadow — no stroke.
// ─────────────────────────────────────────────────────────────────────────────
function buildTopBar(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const keyText = (rest || title).toUpperCase();
    const MAX_W = W - 80;

    const { size: textSize, lines: keyLines } = autoScale(ctx, keyText, MAX_W, 4, 175);
    const numSize = num ? Math.round(textSize * 0.68) : 0;
    const LH = textSize * 1.1;
    const NUM_LH = numSize * 1.15;

    const specs = [
        ...(num ? [{ text: num, px: numSize, lh: NUM_LH, color: '#C8961C' }] : []),
        ...keyLines.map(l => ({ text: l, px: textSize, lh: LH, color: '#FFFFFF' })),
    ];

    let y = 72;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Inter, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.70)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = spec.color;
        ctx.fillText(spec.text, W / 2, y);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        y += spec.lh;
    }

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2 — CTA Button
// Reference: "28+ HOLIDAY OUTFITS / SEE MORE" — large bold number + title text
// float at the top with drop-shadow only (NO stroke). Deep-red pill at bottom.
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
        ctx.shadowColor = 'rgba(0,0,0,0.82)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;
    };
    const clearShadow = () => {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    let y = 65;

    if (num) {
        // ── Very large number at top ───────────────────────────────────
        const NS = 175;
        ctx.font = `900 ${NS}px Inter, sans-serif`;
        setShadow();
        ctx.fillText(num, W / 2, y);
        clearShadow();
        y += NS * 1.1;

        // ── Title text — auto-scaled, wraps naturally ──────────────────
        const { size: ts, lines } = autoScale(ctx, (rest || '').toUpperCase(), MAX_W, 3, 130);
        const LH = ts * 1.12;
        ctx.font = `900 ${ts}px Inter, sans-serif`;
        setShadow();
        for (const line of lines) {
            ctx.fillText(line, W / 2, y);
            y += LH;
        }
        clearShadow();
    } else {
        // ── No number — full title auto-scaled ────────────────────────
        const { size: ts, lines } = autoScale(ctx, title.toUpperCase(), MAX_W, 3, 135);
        const LH = ts * 1.12;
        ctx.font = `900 ${ts}px Inter, sans-serif`;
        setShadow();
        for (const line of lines) {
            ctx.fillText(line, W / 2, y);
            y += LH;
        }
        clearShadow();
    }

    // ── Deep-red pill CTA button at bottom ────────────────────────────
    const BW = 840, BH = 118, BR = 60;
    const BX = (W - BW) / 2;
    const BY = H - BH - 90;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    rrect(ctx, BX, BY, BW, BH, BR);
    ctx.fillStyle = '#C91C1C';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.font = '800 64px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('SEE MORE \u2192', W / 2, BY + BH / 2);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3 — Big Bold Center
// Reference: "15 AIRPORT OUTFIT IDEAS" — one word per line, white bold text,
// NO stroke (drop-shadow only for contrast). Positioned lower-center.
// Font auto-scaled so the longest single word fits the canvas width.
// ─────────────────────────────────────────────────────────────────────────────
function buildBigCenter(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    // Each word gets its own line — exactly like the reference
    const words = (rest || title).toUpperCase().trim().split(/\s+/).filter(Boolean);
    const MAX_W = W - 80; // 40px padding per side

    // Find the largest font where every single word fits within MAX_W
    let fontSize = 200;
    while (fontSize >= 44) {
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
        if (words.every(w => ctx.measureText(w).width <= MAX_W)) break;
        fontSize -= 4;
    }

    const numSize = num ? Math.round(fontSize * 0.62) : 0;
    const LH = fontSize * 1.12;       // line height for keyword lines
    const NUM_LH = numSize * 1.18;    // slightly looser for number

    const specs = [
        ...(num ? [{ text: num, px: numSize, lh: NUM_LH }] : []),
        ...words.map(w => ({ text: w, px: fontSize, lh: LH })),
    ];

    const totalH = specs.reduce((s, l) => s + l.lh, 0);

    // Center the text block at 60% of canvas height (lower-center like reference)
    let y = H * 0.60 - totalH / 2;
    if (y < H * 0.05) y = H * 0.05; // safety: never go above top 5%

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Inter, sans-serif`;

        // ── Drop shadow only — NO stroke (avoids black blob effect) ───
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(spec.text, W / 2, y);

        // Clear shadow before next line
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        y += spec.lh;
    }

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 4 — Minimal
// No overlay — caller keeps the original image URL unchanged.
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
        default:           return buildTopBar(title);
    }
}
