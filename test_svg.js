const fs = require('fs');

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrapWords(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let cur = words[0] || '';
    for (let i = 1; i < words.length; i++) {
        if ((cur + ' ' + words[i]).length <= maxChars) {
            cur += ' ' + words[i];
        } else {
            lines.push(cur);
            cur = words[i];
        }
    }
    lines.push(cur);
    return lines;
}

function generateSVGOverlay(title, category) {
    if (category === 'Fashion & Outfits') {
        const upper = title.toUpperCase();
        
        // Dynamically scale font size if there are very long words (e.g. "CONCERT", "SCIENTIST")
        const longestWordLen = Math.max(...upper.split(' ').map(w => w.length));
        let fontSize = 118;
        if (longestWordLen > 6) {
            fontSize = Math.max(70, 118 - ((longestWordLen - 6) * 10)); // shrink by 10px per extra char, floor at 70
        }
        
        console.log(`Title: "${title}", Longest Word Length: ${longestWordLen}, Computed Font Size: ${fontSize}`);
        
        const lines = wrapWords(upper, 14).slice(0, 4);
        const lineH = Math.round(fontSize * 1.1);
        const midY = 660;
        const startY = midY - ((lines.length - 1) * lineH) / 2;
        const texts = lines.map((l, i) =>
            `<text x="500" y="${startY + i * lineH}" text-anchor="middle" font-family="'Arial Black', Impact, Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill" filter="url(#sh)">${esc(l)}</text>`
        ).join('\n            ');
        const arrowY = startY + lines.length * lineH + 50;
        const sparkles = [
            [875, midY - 230], [125, midY + 40], [865, midY + 200], [120, midY - 150]
        ].map(([sx, sy]) => `<text x="${sx}" y="${sy}" text-anchor="middle" font-family="Arial" font-size="46" fill="#ffffff" opacity="0.88">✦</text>`).join('');
        const firstWord = title.split(' ')[0];
        const subtitle = /^\d+/.test(firstWord) ? `${firstWord}+ inspirations` : 'See all inspirations';
        return `<svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.65)"/></filter></defs>
            ${texts}
            <text x="500" y="${arrowY}" text-anchor="middle" font-family="Arial" font-size="90" fill="#ffffff" filter="url(#sh)">→</text>
            <text x="500" y="1452" text-anchor="middle" font-family="Arial" font-weight="300" font-size="45" fill="#ffffff" opacity="0.85">${esc(subtitle)}</text>
            ${sparkles}
        </svg>`;
    }
}

const svg = generateSVGOverlay("Mariah The Scientist Concert Outfits", "Fashion & Outfits");
fs.writeFileSync('test.svg', svg);
console.log("SVG saved to test.svg");
