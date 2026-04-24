"use client";

import { useState } from 'react';
import { FiSearch, FiCheck, FiImage, FiPlus, FiTrash2, FiLink } from 'react-icons/fi';

// ── 4 Pin Templates ───────────────────────────────────────────────────────────
const TEMPLATES = [
    {
        id: 'top_bar',
        name: 'Top Bar',
        desc: 'Dark bar + gold number',
        preview: (
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(160deg, #b0a5e0 0%, #9580d4 100%)',
                position: 'relative', display: 'flex', flexDirection: 'column'
            }}>
                <div style={{
                    background: 'rgba(6,6,6,0.87)',
                    padding: '0.28rem 0.32rem',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    flexShrink: 0,
                }}>
                    <span style={{
                        color: '#C8961C', fontWeight: 900, fontSize: '0.8rem',
                        fontFamily: 'sans-serif', lineHeight: 1, flexShrink: 0
                    }}>8</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2.5px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.93)', height: '3.5px', borderRadius: '2px' }} />
                        <div style={{ background: 'rgba(255,255,255,0.68)', height: '3.5px', borderRadius: '2px', width: '72%' }} />
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'cta_button',
        name: 'CTA Button',
        desc: 'Title on image + red CTA',
        preview: (
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(160deg, #b0a5e0 0%, #9580d4 100%)',
                position: 'relative', display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ padding: '0.3rem 0.38rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.92)', height: '5.5px', borderRadius: '3px', width: '52%', boxShadow: '0 2px 5px rgba(0,0,0,0.6)' }} />
                    <div style={{ background: 'rgba(255,255,255,0.78)', height: '4.5px', borderRadius: '3px', width: '78%', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />
                    <div style={{ background: 'rgba(255,255,255,0.65)', height: '4.5px', borderRadius: '3px', width: '68%', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
                </div>
                <div style={{
                    position: 'absolute', bottom: '5px', left: '6%', right: '6%',
                    background: '#C91C1C', borderRadius: '100px', padding: '4px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ background: 'rgba(255,255,255,0.88)', height: '3.5px', borderRadius: '2px', width: '52%' }} />
                </div>
            </div>
        ),
    },
    {
        id: 'big_center',
        name: 'Big Center',
        desc: 'Massive centered text',
        preview: (
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(160deg, #b0a5e0 0%, #9580d4 100%)',
                position: 'relative', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '2.5px',
            }}>
                <div style={{ background: 'rgba(255,255,255,0.60)', height: '4px', borderRadius: '2px', width: '22%', boxShadow: '0 0 0 1px rgba(0,0,0,0.55)' }} />
                <div style={{ background: 'rgba(255,255,255,0.96)', height: '7px', borderRadius: '3px', width: '90%', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.6)' }} />
                <div style={{ background: 'rgba(255,255,255,0.90)', height: '7px', borderRadius: '3px', width: '84%', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)' }} />
                <div style={{ background: 'rgba(255,255,255,0.82)', height: '7px', borderRadius: '3px', width: '76%', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.4)' }} />
            </div>
        ),
    },
    {
        id: 'minimal',
        name: 'Minimal',
        desc: 'Clean image, no overlay',
        preview: (
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(160deg, #b0a5e0 0%, #9580d4 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '4px'
            }}>
                <FiImage size={16} color="rgba(255,255,255,0.65)" />
                <div style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>No text</div>
            </div>
        ),
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const newUrlEntry = () => ({ id: Date.now() + Math.random(), url: '', limit: 5 });

export default function UrlScraper({
    apiKey, geminiKey, niche, existingBoards,
    onPinGenerated, isGenerating, setIsGenerating
}) {
    // Multi-URL list: each entry = { id, url, limit }
    const [urlEntries, setUrlEntries] = useState([newUrlEntry()]);

    const [isScraping, setIsScraping] = useState(false);
    const [scrapedImages, setScrapedImages] = useState([]);
    const [totalScraped, setTotalScraped] = useState(0);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [variationCount, setVariationCount] = useState(1);
    const [scrapeError, setScrapeError] = useState('');
    const [selectedTemplates, setSelectedTemplates] = useState(
        new Set(['top_bar', 'cta_button', 'big_center', 'minimal'])
    );

    // ── URL list helpers ──────────────────────────────────────────────────────
    const addUrl = () => setUrlEntries(prev => [...prev, newUrlEntry()]);

    const removeUrl = (id) => setUrlEntries(prev => prev.length > 1 ? prev.filter(e => e.id !== id) : prev);

    const updateEntry = (id, field, value) =>
        setUrlEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

    // ── Scrape handler — fetches all URLs in sequence ─────────────────────────
    const handleScrape = async () => {
        const validEntries = urlEntries.filter(e => e.url.trim());
        if (validEntries.length === 0) return;

        setIsScraping(true);
        setScrapeError('');
        setScrapedImages([]);
        setSelectedImages(new Set());

        const allImages = [];
        let totalFound = 0;
        const errors = [];

        for (const entry of validEntries) {
            try {
                const res = await fetch('/api/scrape-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
                    body: JSON.stringify({ url: entry.url.trim(), limit: entry.limit })
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    errors.push(`${entry.url.trim()}: ${errData.error || 'Failed'}`);
                    continue;
                }
                const data = await res.json();
                const imgs = (data.images || []).map(img => ({ ...img, _sourceUrl: entry.url.trim() }));
                allImages.push(...imgs);
                totalFound += data.total || imgs.length;
            } catch (err) {
                errors.push(`${entry.url.trim()}: ${err.message}`);
            }
        }

        if (errors.length > 0) setScrapeError(errors.join('\n'));
        setScrapedImages(allImages);
        setTotalScraped(totalFound);
        setSelectedImages(new Set(allImages.map((_, i) => i)));
        setIsScraping(false);
    };

    const toggleImage = (index) => {
        setSelectedImages(prev => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    };

    const toggleTemplate = (id) => {
        setSelectedTemplates(prev => {
            const next = new Set(prev);
            if (next.has(id) && next.size === 1) return prev;
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAllImages = () => {
        setSelectedImages(
            selectedImages.size === scrapedImages.length
                ? new Set()
                : new Set(scrapedImages.map((_, i) => i))
        );
    };

    // ── Generate handler ──────────────────────────────────────────────────────
    const handleGenerate = async () => {
        const selected = scrapedImages.filter((_, i) => selectedImages.has(i));
        if (selected.length === 0 || isGenerating) return;

        setIsGenerating(true);
        const boardList = existingBoards.split('\n').map(b => b.trim()).filter(Boolean);
        const primaryUrl = urlEntries.find(e => e.url.trim())?.url.trim() || '';

        try {
            const response = await fetch('/api/scrape-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
                body: JSON.stringify({
                    images: selected,
                    totalScraped,
                    variationCount,
                    niche,
                    geminiKey: geminiKey.trim(),
                    existingBoards: boardList,
                    sourceUrl: primaryUrl,
                    templates: Array.from(selectedTemplates),
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                alert(`Generation failed: ${err.error || 'Unknown error'}`);
                setIsGenerating(false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '', streamDone = false;

            while (!streamDone) {
                const { value, done } = await reader.read();
                streamDone = done;
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || '';
                    for (const event of events) {
                        if (event.startsWith('data: ')) {
                            try { onPinGenerated(JSON.parse(event.substring(6))); }
                            catch (_) { }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Generation error:', err);
            alert('An error occurred during generation.');
        } finally {
            setIsGenerating(false);
        }
    };

    const totalPins = selectedImages.size * variationCount;
    const hasValidUrl = urlEntries.some(e => e.url.trim());

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

            {/* ── URL List ── */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="sidebar-label" style={{ marginBottom: 0 }}>URLs to scrape</label>
                    <button
                        id="add-url-btn"
                        onClick={addUrl}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: 'var(--primary)', background: 'none',
                            border: 'none', cursor: 'pointer', padding: '0.2rem 0',
                        }}
                    >
                        <FiPlus size={12} /> Add URL
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {urlEntries.map((entry, idx) => (
                        <div key={entry.id} style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.55rem 0.6rem',
                            display: 'flex', flexDirection: 'column', gap: '0.45rem',
                        }}>
                            {/* URL row */}
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <FiLink size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                <input
                                    type="url"
                                    id={`scrape-url-input-${idx}`}
                                    className="glass-input"
                                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                                    placeholder="https://example.com/article"
                                    value={entry.url}
                                    onChange={e => updateEntry(entry.id, 'url', e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleScrape()}
                                />
                                {urlEntries.length > 1 && (
                                    <button
                                        onClick={() => removeUrl(entry.id)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--danger)', padding: '0.2rem', flexShrink: 0,
                                            display: 'flex', alignItems: 'center',
                                        }}
                                        title="Remove URL"
                                    >
                                        <FiTrash2 size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Images per URL row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    Images to scrape:
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                                    {/* Quick-pick pills */}
                                    {[1, 3, 5, 10, 20].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => updateEntry(entry.id, 'limit', n)}
                                            style={{
                                                padding: '0.15rem 0.42rem',
                                                fontSize: '0.67rem',
                                                fontWeight: 600,
                                                borderRadius: '100px',
                                                border: entry.limit === n
                                                    ? '1.5px solid var(--primary)'
                                                    : '1.5px solid var(--surface-border)',
                                                background: entry.limit === n ? 'var(--primary)' : 'transparent',
                                                color: entry.limit === n ? '#fff' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                transition: 'all 0.12s ease',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    {/* Manual number input */}
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        className="glass-input"
                                        style={{ width: '52px', fontSize: '0.75rem', padding: '0.2rem 0.4rem', textAlign: 'center' }}
                                        value={entry.limit}
                                        onChange={e => updateEntry(entry.id, 'limit', Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                                        title="Custom count"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Scrape button */}
                <button
                    id="scrape-find-btn"
                    className="btn btn-primary"
                    style={{
                        width: '100%', marginTop: '0.6rem',
                        padding: '0.5rem 0.875rem', fontSize: '0.8rem',
                        borderRadius: 'var(--radius-md)',
                    }}
                    onClick={handleScrape}
                    disabled={isScraping || !hasValidUrl}
                >
                    {isScraping
                        ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            <span className="animate-spin">⟳</span> Scanning…
                        </span>
                        : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            <FiSearch size={13} /> Find Images
                        </span>
                    }
                </button>

                {scrapeError && (
                    <pre style={{
                        marginTop: '0.4rem', fontSize: '0.7rem',
                        color: 'var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                    }}>
                        ⚠ {scrapeError}
                    </pre>
                )}
            </div>

            {/* ── Template Picker ── */}
            <div>
                <label className="sidebar-label">
                    Pin Templates
                    <span style={{
                        fontWeight: 400, textTransform: 'none', letterSpacing: 0,
                        marginLeft: '0.3rem', fontSize: '0.67rem'
                    }}>
                        (select any — applied randomly)
                    </span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {TEMPLATES.map(t => {
                        const active = selectedTemplates.has(t.id);
                        return (
                            <div
                                key={t.id}
                                id={`template-${t.id}`}
                                onClick={() => toggleTemplate(t.id)}
                                style={{
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: active
                                        ? '2.5px solid var(--primary)'
                                        : '2px solid var(--surface-border)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'border-color 0.15s ease, transform 0.12s ease',
                                    transform: active ? 'scale(0.96)' : 'scale(1)',
                                }}
                            >
                                <div style={{ aspectRatio: '2/3', position: 'relative' }}>
                                    {t.preview}
                                </div>
                                {active && (
                                    <div style={{
                                        position: 'absolute', top: '5px', right: '5px',
                                        background: 'var(--primary)', borderRadius: '50%',
                                        width: '14px', height: '14px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FiCheck size={8} color="white" />
                                    </div>
                                )}
                                <div style={{ padding: '0.35rem 0.4rem 0.4rem', background: 'var(--surface)' }}>
                                    <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>{t.name}</div>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '1px', lineHeight: 1.3 }}>{t.desc}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Image Gallery (shown after scrape) ── */}
            {scrapedImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {scrapedImages.length} images found
                            {selectedImages.size > 0 && (
                                <span style={{ marginLeft: '0.4rem', color: 'var(--primary)' }}>
                                    · {selectedImages.size} selected
                                </span>
                            )}
                        </span>
                        <button
                            onClick={toggleAllImages}
                            style={{
                                fontSize: '0.72rem', color: 'var(--primary)', background: 'none',
                                border: 'none', cursor: 'pointer', fontWeight: 600, padding: '0.2rem 0'
                            }}
                        >
                            {selectedImages.size === scrapedImages.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem',
                        maxHeight: '200px', overflowY: 'auto',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)',
                        padding: '0.4rem', background: 'var(--background)'
                    }}>
                        {scrapedImages.map((img, i) => (
                            <div
                                key={i}
                                onClick={() => toggleImage(i)}
                                style={{
                                    position: 'relative', aspectRatio: '1', borderRadius: '5px',
                                    overflow: 'hidden', cursor: 'pointer',
                                    outline: selectedImages.has(i)
                                        ? '2.5px solid var(--primary)'
                                        : '2px solid transparent',
                                    transition: 'outline 0.12s ease, transform 0.12s ease',
                                    transform: selectedImages.has(i) ? 'scale(0.93)' : 'scale(1)',
                                    background: 'var(--surface-border)'
                                }}
                            >
                                <img
                                    src={img.src} alt={img.alt || ''}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                                {selectedImages.has(i) && (
                                    <div style={{
                                        position: 'absolute', top: '2px', right: '2px',
                                        background: 'var(--primary)', borderRadius: '50%',
                                        width: '14px', height: '14px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FiCheck size={8} color="white" />
                                    </div>
                                )}
                                {/* Order badge */}
                                <div style={{
                                    position: 'absolute', bottom: '2px', left: '2px',
                                    background: 'rgba(0,0,0,0.55)', borderRadius: '3px',
                                    fontSize: '0.55rem', color: '#fff', padding: '1px 3px',
                                    fontWeight: 700, lineHeight: 1,
                                }}>
                                    {i + 1}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pins per image */}
                    <div>
                        <label className="sidebar-label" style={{ marginBottom: '0.35rem' }}>
                            Pins per image
                        </label>
                        <input
                            id="variation-count-input"
                            type="number" min="1" max="10"
                            className="glass-input"
                            style={{ width: '100%', fontSize: '0.875rem' }}
                            value={variationCount}
                            onChange={e =>
                                setVariationCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))
                            }
                        />
                    </div>

                    <button
                        id="scrape-generate-btn"
                        className="btn btn-primary"
                        style={{ width: '100%', borderRadius: '100px', marginTop: '0.25rem' }}
                        onClick={handleGenerate}
                        disabled={isGenerating || selectedImages.size === 0}
                    >
                        {isGenerating
                            ? <><span className="animate-pulse">⏳</span> Generating…</>
                            : <>Generate {totalPins} {totalPins === 1 ? 'Pin' : 'Pins'} →</>
                        }
                    </button>
                </div>
            )}
        </div>
    );
}
