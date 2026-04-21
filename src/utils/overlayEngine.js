/**
 * overlayEngine.js — Server-side only canvas overlay utility.
 * Provides 4 distinct Pinterest pin overlay templates.
 * Imported ONLY by API route handlers — never by client components.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { interBoldBuffer } from '@/app/api/generate/font-data.js';

// ── Font Bootstrap ───────────────────────────────────────────────────────────
let _fontReady = false;
function ensureFont() {
    if (_fontReady) return;
    try {
        GlobalFonts.register(interBoldBuffer, 'Inter');
    } catch (_) { /* already registered by generate/route.js — harmless */ }
    _fontReady = true;
}

// ── Shared Drawing Helpers ───────────────────────────────────────────────────

function wrapWords(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let cur = words[0] || '';
    for (let i = 1; i < words.length; i++) {
        if ((cur + ' ' + words[i]).length <= maxChars) cur += ' ' + words[i];
        else { lines.push(cur); cur = words[i]; }
    }
    lines.push(cur);
    return lines;
}

function drawGradient(ctx, w, h, fromY, opacity) {
    const grad = ctx.createLinearGradient(0, fromY, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${opacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, fromY, w, h - fromY);
}

function drawText(ctx, text, x, y, {
    fontSize = 84, weight = 'bold', color = '#ffffff',
    strokeColor = 'rgba(0,0,0,0.9)', strokeWidth = 0, align = 'center'
} = {}) {
    ctx.save();
    ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawSparkle(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.quadraticCurveTo(0, 0, size, 0);
        ctx.quadraticCurveTo(0, 0, 0, size);
    }
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.restore();
}

function drawArrowShape(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    function arrowPath(c) {
        c.beginPath();
        c.moveTo(-size * 0.8, -size * 0.25);
        c.lineTo(size * 0.2, -size * 0.25);
        c.lineTo(size * 0.2, -size * 0.6);
        c.lineTo(size * 1.1, 0);
        c.lineTo(size * 0.2, size * 0.6);
        c.lineTo(size * 0.2, size * 0.25);
        c.lineTo(-size * 0.8, size * 0.25);
        c.closePath();
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 14;
    arrowPath(ctx); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    arrowPath(ctx); ctx.fill();
    ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
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

// ── Template 1: Bold Bottom ──────────────────────────────────────────────────
// Dark gradient scrim on bottom 55% + extra-large bold title + sparkles + arrow.
// This is the same style the AI Generate route uses.
function buildBoldBottom(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const words = title.split(' ');
    const lines = [];
    if (words.length <= 2) {
        lines.push(title);
    } else if (words.length <= 4) {
        lines.push(words.slice(0, words.length - 2).join(' '));
        lines.push(words[words.length - 2]);
        lines.push(words[words.length - 1]);
    } else {
        lines.push(...wrapWords(title, 14).slice(0, 3));
    }

    const fontSize = 110, lineH = 135;
    const startY = 880 - ((lines.length - 1) * lineH) / 2;

    const sparkles = [
        { x: 260, y: startY - 40, size: 35 },
        { x: 860, y: startY + 60, size: 25 },
        { x: 200, y: startY + 280, size: 30 },
        { x: 740, y: startY + 360, size: 40 },
        { x: 120, y: startY + 550, size: 20 },
        { x: 920, y: startY + 120, size: 30 }
    ];
    sparkles.forEach(s => drawSparkle(ctx, s.x, s.y, s.size));

    lines.forEach((line, i) =>
        drawText(ctx, line, W / 2, startY + i * lineH, {
            fontSize, weight: '900', strokeWidth: 10, strokeColor: '#000000', align: 'center'
        })
    );

    drawArrowShape(ctx, W / 2, startY + lines.length * lineH + 60, 60);
    return canvas.toBuffer('image/png');
}

// ── Template 2: Centered Box ─────────────────────────────────────────────────
// Frosted white card centered on image, brand-purple accent bar on left.
function buildCenteredBox(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const lines = wrapWords(title, 20).slice(0, 4);
    const fontSize = 72, lineH = 92, pad = 52;
    const boxW = 820, boxH = lines.length * lineH + pad * 2;
    const boxX = (W - boxW) / 2, boxY = (H - boxH) / 2 - 40;

    // Subtle outer glow
    ctx.shadowColor = 'rgba(108,56,255,0.22)';
    ctx.shadowBlur = 40;

    // White frosted box
    roundedRect(ctx, boxX, boxY, boxW, boxH, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Purple accent bar on left
    roundedRect(ctx, boxX, boxY + 20, 7, boxH - 40, 4);
    ctx.fillStyle = '#6c38ff';
    ctx.fill();

    // Text
    lines.forEach((line, i) =>
        drawText(ctx, line, W / 2, boxY + pad + lineH * 0.5 + i * lineH, {
            fontSize, weight: '700', color: '#0b1021', align: 'center'
        })
    );

    return canvas.toBuffer('image/png');
}

// ── Template 3: Top Banner ───────────────────────────────────────────────────
// Brand-gradient strip across the top with white bold title.
// Lower half of image shows fully — great for fashion/beauty shots.
function buildTopBanner(title) {
    const W = 1000, H = 1500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const lines = wrapWords(title, 24).slice(0, 2);
    const fontSize = 68, lineH = 88;
    const bannerH = lines.length * lineH + 80;

    // Brand gradient banner
    const bannerGrad = ctx.createLinearGradient(0, 0, W, 0);
    bannerGrad.addColorStop(0, '#3a1db0');
    bannerGrad.addColorStop(0.5, '#6c38ff');
    bannerGrad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(0, 0, W, bannerH);

    // White sparkle dots decorating banner
    [[80, bannerH * 0.3, 18], [930, bannerH * 0.6, 14], [500, bannerH * 0.15, 10]].forEach(
        ([x, y, s]) => drawSparkle(ctx, x, y, s)
    );

    // Title lines
    lines.forEach((line, i) =>
        drawText(ctx, line, W / 2, 40 + lineH * 0.5 + i * lineH, {
            fontSize, weight: '800', color: '#ffffff', align: 'center', strokeWidth: 0
        })
    );

    // Thin white decorative rule below title
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(W / 2 - 90, bannerH - 16, 180, 3);

    return canvas.toBuffer('image/png');
}

// ── Template 4: Minimal ──────────────────────────────────────────────────────
// No overlay — returns null so the caller uses the image URL directly.
function buildMinimal() {
    return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a PNG Buffer to composite on the scraped image, or null for 'minimal'.
 * @param {string} title   - Pin title text
 * @param {string} template - 'bold_bottom' | 'centered_box' | 'top_banner' | 'minimal'
 * @returns {Buffer|null}
 */
export function generateOverlayBuffer(title, template) {
    ensureFont();
    switch (template) {
        case 'centered_box': return buildCenteredBox(title);
        case 'top_banner':   return buildTopBanner(title);
        case 'minimal':      return buildMinimal();
        case 'bold_bottom':
        default:             return buildBoldBottom(title);
    }
}
