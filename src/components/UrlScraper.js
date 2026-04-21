"use client";

import { useState } from 'react';
import { FiSearch, FiCheck, FiImage } from 'react-icons/fi';

// ── 4 Pin Templates ─────────────────────────────────────────────────────────
const TEMPLATES = [
    {
        id: 'bold_bottom',
        name: 'Bold Bottom',
        desc: 'Gradient scrim + bold title',
        preview: (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #c8b6ff 0%, #a78bfa 100%)', position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(transparent, rgba(0,0,0,0.78))' }} />
                <div style={{ position: 'relative', zIndex: 1, padding: '0.5rem 0.45rem 0.55rem', width: '100%' }}>
                    <div style={{ background: 'rgba(255,255,255,0.95)', height: '5px', borderRadius: '3px', marginBottom: '4px', width: '82%' }} />
                    <div style={{ background: 'rgba(255,255,255,0.7)', height: '4px', borderRadius: '3px', width: '58%', marginBottom: '6px' }} />
                    <div style={{ width: '16px', height: '7px', background: 'white', borderRadius: '2px', margin: '0 auto' }} />
                </div>
                {/* Sparkle dots */}
                <div style={{ position: 'absolute', top: '18%', left: '22%', width: '4px', height: '4px', background: '#FFD700', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: '30%', right: '18%', width: '3px', height: '3px', background: '#FFD700', borderRadius: '50%' }} />
            </div>
        ),
    },
    {
        id: 'centered_box',
        name: 'Center Box',
        desc: 'White card over image',
        preview: (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #c8b6ff 0%, #a78bfa 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    background: 'rgba(255,255,255,0.93)',
                    borderRadius: '5px',
                    padding: '0.45rem 0.5rem',
                    width: '76%',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: '3px', background: '#6c38ff', borderRadius: '2px' }} />
                    <div style={{ background: '#0b1021', height: '5px', borderRadius: '3px', marginBottom: '4px', width: '85%', marginLeft: '6px' }} />
                    <div style={{ background: 'rgba(11,16,33,0.4)', height: '4px', borderRadius: '3px', width: '60%', marginLeft: '6px' }} />
                </div>
            </div>
        ),
    },
    {
        id: 'top_banner',
        name: 'Top Banner',
        desc: 'Brand gradient strip on top',
        preview: (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #c8b6ff 0%, #a78bfa 100%)', position: 'relative' }}>
                <div style={{
                    background: 'linear-gradient(90deg, #3a1db0, #6c38ff)',
                    padding: '0.4rem 0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                }}>
                    <div style={{ background: 'rgba(255,255,255,0.9)', height: '5px', borderRadius: '3px', width: '75%' }} />
                    <div style={{ background: 'rgba(255,255,255,0.55)', height: '4px', borderRadius: '3px', width: '50%' }} />
                </div>
                <div style={{ position: 'absolute', top: '10px', right: '8px', width: '3px', height: '3px', background: '#FFD700', borderRadius: '50%' }} />
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
                background: 'linear-gradient(145deg, #c8b6ff 0%, #a78bfa 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '4px'
            }}>
                <FiImage size={16} color="rgba(255,255,255,0.7)" />
                <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>NO TEXT</div>
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
        new Set(['bold_bottom', 'centered_box', 'top_banner', 'minimal'])
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
                        style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', flexShrink: 0 }}
                        onClick={handleScrape}
                        disabled={isScraping || !scrapeUrl.trim()}
                    >
                        {isScraping
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span className="animate-spin">⟳</span> Scanning</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><FiSearch size={13} /> Find</span>
                        }
                    </button>
                </div>
                {scrapeError && (
                    <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', gap: '0.3rem' }}>
                        ⚠ {scrapeError}
                    </p>
                )}
            </div>

            {/* ── Template Picker (always visible in scrape mode) ── */}
            <div>
                <label className="sidebar-label">Pin Templates
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '0.3rem', fontSize: '0.67rem' }}>
                        (select any, applied randomly)
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
                                    border: active ? '2.5px solid var(--primary)' : '2px solid var(--surface-border)',
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

                                {/* Checkmark badge */}
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

                                {/* Name + desc */}
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
                            {selectedImages.size > 0 && <span style={{ marginLeft: '0.4rem', color: 'var(--primary)' }}>· {selectedImages.size} selected</span>}
                        </span>
                        <button
                            onClick={toggleAllImages}
                            style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '0.2rem 0' }}
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
                                    outline: selectedImages.has(i) ? '2.5px solid var(--primary)' : '2px solid transparent',
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
                        <label className="sidebar-label" style={{ marginBottom: '0.35rem' }}>Pins per image</label>
                        <input
                            id="variation-count-input"
                            type="number" min="1" max="10"
                            className="glass-input"
                            style={{ width: '100%', fontSize: '0.875rem' }}
                            value={variationCount}
                            onChange={e => setVariationCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
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
