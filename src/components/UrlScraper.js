"use client";

import { useState } from 'react';
import { FiSearch, FiCheck, FiImage } from 'react-icons/fi';

// ── 4 Pin Templates — previews match the 3 reference images exactly ──────────
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
                {/* Dark top bar with gold number + white text lines */}
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
                {/* Shadow-only title text near top */}
                <div style={{ padding: '0.3rem 0.38rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5px' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.92)', height: '5.5px', borderRadius: '3px',
                        width: '52%', boxShadow: '0 2px 5px rgba(0,0,0,0.6)'
                    }} />
                    <div style={{
                        background: 'rgba(255,255,255,0.78)', height: '4.5px', borderRadius: '3px',
                        width: '78%', boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }} />
                    <div style={{
                        background: 'rgba(255,255,255,0.65)', height: '4.5px', borderRadius: '3px',
                        width: '68%', boxShadow: '0 1px 4px rgba(0,0,0,0.4)'
                    }} />
                </div>
                {/* Red pill CTA button at bottom */}
                <div style={{
                    position: 'absolute', bottom: '5px', left: '6%', right: '6%',
                    background: '#C91C1C', borderRadius: '100px',
                    padding: '4px 0',
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
                position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '2.5px',
            }}>
                {/* Number line — slightly smaller */}
                <div style={{
                    background: 'rgba(255,255,255,0.60)', height: '4px', borderRadius: '2px',
                    width: '22%', boxShadow: '0 0 0 1px rgba(0,0,0,0.55)'
                }} />
                {/* Keyword lines — large */}
                <div style={{
                    background: 'rgba(255,255,255,0.96)', height: '7px', borderRadius: '3px',
                    width: '90%', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.6)'
                }} />
                <div style={{
                    background: 'rgba(255,255,255,0.90)', height: '7px', borderRadius: '3px',
                    width: '84%', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)'
                }} />
                <div style={{
                    background: 'rgba(255,255,255,0.82)', height: '7px', borderRadius: '3px',
                    width: '76%', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.4)'
                }} />
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
                <div style={{
                    fontSize: '0.42rem', color: 'rgba(255,255,255,0.55)',
                    fontFamily: 'sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase'
                }}>No text</div>
            </div>
        ),
    },
];

export default function UrlScraper({
    apiKey, geminiKey, niche, existingBoards,
    onPinGenerated, isGenerating, setIsGenerating
}) {
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const [scrapedImages, setScrapedImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [variationCount, setVariationCount] = useState(1);
    const [scrapeError, setScrapeError] = useState('');
    const [selectedTemplates, setSelectedTemplates] = useState(
        new Set(['top_bar', 'cta_button', 'big_center', 'minimal'])
    );

    // ── Scrape handler ──────────────────────────────────────────────────────
    const handleScrape = async () => {
        if (!scrapeUrl.trim()) return;
        setIsScraping(true);
        setScrapeError('');
        setScrapedImages([]);
        setSelectedImages(new Set());

        try {
            const res = await fetch('/api/scrape-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
                body: JSON.stringify({ url: scrapeUrl.trim() })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to scrape URL');
            const data = await res.json();
            const imgs = data.images || [];
            setScrapedImages(imgs);
            setSelectedImages(new Set(imgs.map((_, i) => i)));
        } catch (err) {
            setScrapeError(err.message);
        } finally {
            setIsScraping(false);
        }
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
            if (next.has(id) && next.size === 1) return prev; // keep at least 1
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

    // ── Generate handler ────────────────────────────────────────────────────
    const handleGenerate = async () => {
        const selected = scrapedImages.filter((_, i) => selectedImages.has(i));
        if (selected.length === 0 || isGenerating) return;

        setIsGenerating(true);
        const boardList = existingBoards.split('\n').map(b => b.trim()).filter(Boolean);

        try {
            const response = await fetch('/api/scrape-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
                body: JSON.stringify({
                    images: selected,
                    variationCount,
                    niche,
                    geminiKey: geminiKey.trim(),
                    existingBoards: boardList,
                    sourceUrl: scrapeUrl.trim(),
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

            {/* ── URL Input ── */}
            <div>
                <label className="sidebar-label">Page URL to scrape images from</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="url"
                        id="scrape-url-input"
                        className="glass-input"
                        style={{ flex: 1, fontSize: '0.8rem' }}
                        placeholder="https://example.com/article"
                        value={scrapeUrl}
                        onChange={e => setScrapeUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleScrape()}
                    />
                    <button
                        id="scrape-find-btn"
                        className="btn btn-primary"
                        style={{
                            padding: '0.5rem 0.875rem', fontSize: '0.8rem',
                            borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', flexShrink: 0
                        }}
                        onClick={handleScrape}
                        disabled={isScraping || !scrapeUrl.trim()}
                    >
                        {isScraping
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="animate-spin">⟳</span> Scanning
                            </span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <FiSearch size={13} /> Find
                            </span>
                        }
                    </button>
                </div>
                {scrapeError && (
                    <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--danger)' }}>
                        ⚠ {scrapeError}
                    </p>
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
                                {/* Mini 2:3 preview */}
                                <div style={{ aspectRatio: '2/3', position: 'relative' }}>
                                    {t.preview}
                                </div>

                                {/* Selected badge */}
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

                                {/* Label */}
                                <div style={{ padding: '0.35rem 0.4rem 0.4rem', background: 'var(--surface)' }}>
                                    <div style={{
                                        fontSize: '0.67rem', fontWeight: 700,
                                        color: 'var(--foreground)', lineHeight: 1.2
                                    }}>{t.name}</div>
                                    <div style={{
                                        fontSize: '0.6rem', color: 'var(--text-muted)',
                                        marginTop: '1px', lineHeight: 1.3
                                    }}>{t.desc}</div>
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
