/**
 * overlayEngine.js — Server-side only canvas overlay engine.
 * Replicates 3 reference Pinterest pin styles exactly.
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

/** Pixel-accurate text wrapping. ctx.font MUST be set before calling. */
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

/** Split "15 Airport Outfit Ideas" → { num: "15", rest: "Airport Outfit Ideas" } */
function parseNum(title) {
    const m = title.match(/^(\d+\+?)\s+(.+)/);
    return m ? { num: m[1], rest: m[2] } : { num: null, rest: title };
}

/** Draw a rounded-rect path; call fill/stroke after. */
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
// Template 1 — Top Dark Bar
// Reference: "8 AIRPORT OUTFIT IDEAS"
// Dark opaque bar spanning the top. Leading number in warm gold on the left,
// remaining title text in white wrapping to the right. ✦ sparkle bottom-right.
// ─────────────────────────────────────────────────────────────────────────────
function buildTopBar(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const upRest = (rest || title).toUpperCase();
    const PAD = 42;
    const BAR_H = 248;

    // ── Dark opaque bar ──────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(6, 6, 6, 0.87)';
    ctx.fillRect(0, 0, W, BAR_H);

    if (num) {
        // ── Gold number ────────────────────────────────────────────────
        const NUM_SIZE = 190;
        ctx.font = `900 ${NUM_SIZE}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const numW = ctx.measureText(num).width;

        ctx.fillStyle = '#C8961C'; // warm gold matching reference
        ctx.fillText(num, PAD, BAR_H / 2);

        // ── White title text wrapping to the right ─────────────────────
        const TXT = 86;
        const gapAfterNum = 20;
        const textX = PAD + numW + gapAfterNum;
        const maxW = W - textX - PAD;

        ctx.font = `900 ${TXT}px Inter, sans-serif`;
        const lines = wrapByWidth(ctx, upRest, maxW).slice(0, 3);
        const LH = TXT * 1.15;
        const blockH = lines.length * LH;
        let ly = (BAR_H - blockH) / 2 + LH / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        for (const line of lines) {
            ctx.fillText(line, textX, ly);
            ly += LH;
        }
    } else {
        // ── No number — all white, centered ──────────────────────────
        const TXT = 100;
        ctx.font = `900 ${TXT}px Inter, sans-serif`;
        const lines = wrapByWidth(ctx, upRest, W - PAD * 2).slice(0, 3);
        const LH = TXT * 1.15;
        const blockH = lines.length * LH;
        let ly = (BAR_H - blockH) / 2 + LH / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const line of lines) {
            ctx.fillText(line, W / 2, ly);
            ly += LH;
        }
    }


    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2 — Title + CTA Button
// Reference: "28+ HOLIDAY OUTFITS" at top + red "SEE MORE →" pill at bottom.
// Title floats bare on the image (strong drop-shadow only, no backing).
// Deep-red pill button anchored to the bottom.
// ─────────────────────────────────────────────────────────────────────────────
function buildCTA(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const PAD = 50;
    const setShadow = () => {
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 5;
    };
    const clearShadow = () => {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    };

    ctx.textAlign = 'center';
    let y = 75;

    if (num) {
        // ── Large number, own line ─────────────────────────────────────
        const NS = 170;
        ctx.font = `900 ${NS}px Inter, sans-serif`;
        ctx.textBaseline = 'top';
        setShadow();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(num, W / 2, y);
        y += NS * 1.08;
        clearShadow();

        // ── Remaining title text ───────────────────────────────────────
        const TS = 115;
        ctx.font = `900 ${TS}px Inter, sans-serif`;
        const lines = wrapByWidth(ctx, rest.toUpperCase(), W - PAD * 2).slice(0, 2);
        const LH = TS * 1.1;
        setShadow();
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'top';
        for (const line of lines) {
            ctx.fillText(line, W / 2, y);
            y += LH;
        }
        clearShadow();
    } else {
        // ── Full title, no number ──────────────────────────────────────
        const TS = 122;
        ctx.font = `900 ${TS}px Inter, sans-serif`;
        const lines = wrapByWidth(ctx, title.toUpperCase(), W - PAD * 2).slice(0, 3);
        const LH = TS * 1.1;
        setShadow();
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'top';
        for (const line of lines) {
            ctx.fillText(line, W / 2, y);
            y += LH;
        }
        clearShadow();
    }

    // ── Deep-red pill CTA button ───────────────────────────────────────
    const BW = 840, BH = 120, BR = 60;
    const BX = (W - BW) / 2, BY = H - BH - 85;

    ctx.save();
    // Button drop-shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    rrect(ctx, BX, BY, BW, BH, BR);
    ctx.fillStyle = '#C91C1C'; // deep red matching reference
    ctx.fill();

    // Reset shadow before text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.font = `800 64px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('SEE MORE \u2192', W / 2, BY + BH / 2);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3 — Big Bold Center
// Reference: "15 AIRPORT OUTFIT IDEAS" — each keyword on its own full-width line,
// massive black-stroked white text, vertically centered, ✦ sparkle bottom-right.
// ─────────────────────────────────────────────────────────────────────────────
function buildBigCenter(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const { num, rest } = parseNum(title);
    const words = (rest || title).toUpperCase().split(' ');

    // Cap at 3 keyword lines (merge overflow into last slot)
    const MAX_KW = 3;
    const kw =
        words.length <= MAX_KW
            ? words
            : [...words.slice(0, MAX_KW - 1), words.slice(MAX_KW - 1).join(' ')];

    // Line size specs: smaller number, larger keywords
    const WORD_PX = 176;
    const NUM_PX  = 112;
    const WORD_LH = WORD_PX * 1.04;
    const NUM_LH  = NUM_PX  * 1.1;

    const specs = [
        ...(num ? [{ text: num,  px: NUM_PX,  lh: NUM_LH  }] : []),
        ...kw.map(w => ({ text: w, px: WORD_PX, lh: WORD_LH })),
    ];

    const totalH = specs.reduce((s, l) => s + l.lh, 0);
    let y = (H - totalH) / 2; // perfectly vertically centered

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const spec of specs) {
        ctx.font = `900 ${spec.px}px Inter, sans-serif`;

        // ── Black outline stroke ──────────────────────────────────────
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.lineWidth = 26;
        ctx.lineJoin = 'round';
        ctx.strokeText(spec.text, W / 2, y);

        // ── White fill ────────────────────────────────────────────────
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(spec.text, W / 2, y);

        y += spec.lh;
    }


    return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 4 — Minimal
// No overlay composited — returns null so the caller keeps the original URL.
// ─────────────────────────────────────────────────────────────────────────────
function buildMinimal() { return null; }

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Generate an overlay PNG Buffer for compositing, or null for 'minimal'.
 * @param {string} title    - Pin title (used as the overlay text)
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
