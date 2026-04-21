"use client";

import { useState } from 'react';
import { FiSearch, FiCheck, FiX } from 'react-icons/fi';

export default function UrlScraper({
    apiKey,
    geminiKey,
    niche,
    existingBoards,
    onPinGenerated,
    isGenerating,
    setIsGenerating
}) {
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const [scrapedImages, setScrapedImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [variationCount, setVariationCount] = useState(1);
    const [scrapeError, setScrapeError] = useState('');
    const [pageTitle, setPageTitle] = useState('');

    const handleScrape = async () => {
        if (!scrapeUrl.trim()) return;
        setIsScraping(true);
        setScrapeError('');
        setScrapedImages([]);
        setSelectedImages(new Set());
        setPageTitle('');

        try {
            const res = await fetch('/api/scrape-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey.trim()
                },
                body: JSON.stringify({ url: scrapeUrl.trim() })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to scrape URL');
            }

            const data = await res.json();
            const imgs = data.images || [];
            setScrapedImages(imgs);
            setPageTitle(data.pageTitle || '');
            // Auto-select all by default
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
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedImages.size === scrapedImages.length) {
            setSelectedImages(new Set());
        } else {
            setSelectedImages(new Set(scrapedImages.map((_, i) => i)));
        }
    };

    const handleGenerate = async () => {
        const selected = scrapedImages.filter((_, i) => selectedImages.has(i));
        if (selected.length === 0 || isGenerating) return;

        setIsGenerating(true);

        const boardList = existingBoards.split('\n').map(b => b.trim()).filter(b => b.length > 0);

        try {
            const response = await fetch('/api/scrape-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey.trim()
                },
                body: JSON.stringify({
                    images: selected,
                    variationCount,
                    niche,
                    geminiKey: geminiKey.trim(),
                    existingBoards: boardList,
                    sourceUrl: scrapeUrl.trim()
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
            let buffer = '';
            let streamDone = false;

            while (!streamDone) {
                const { value, done } = await reader.read();
                streamDone = done;

                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || '';

                    for (const event of events) {
                        if (event.startsWith('data: ')) {
                            try {
                                const pin = JSON.parse(event.substring(6));
                                onPinGenerated(pin);
                            } catch (e) {
                                console.error('Parse error:', e);
                            }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* URL Input */}
            <div>
                <label className="sidebar-label">Page URL to scrape images from</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="url"
                        className="glass-input"
                        style={{ flex: 1, fontSize: '0.8rem' }}
                        placeholder="https://example.com/article"
                        value={scrapeUrl}
                        onChange={e => setScrapeUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleScrape()}
                        id="scrape-url-input"
                    />
                    <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', flexShrink: 0 }}
                        onClick={handleScrape}
                        disabled={isScraping || !scrapeUrl.trim()}
                        id="scrape-find-btn"
                    >
                        {isScraping
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span> Scanning</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><FiSearch size={13} /> Find</span>
                        }
                    </button>
                </div>
                {scrapeError && (
                    <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                        ⚠ {scrapeError}
                    </p>
                )}
            </div>

            {/* Image Gallery */}
            {scrapedImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {scrapedImages.length} images found
                            {selectedImages.size > 0 && (
                                <span style={{ marginLeft: '0.4rem', color: 'var(--primary)' }}>
                                    · {selectedImages.size} selected
                                </span>
                            )}
                        </span>
                        <button
                            onClick={toggleAll}
                            style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '0.2rem 0' }}
                        >
                            {selectedImages.size === scrapedImages.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.35rem',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--surface-border)',
                        padding: '0.4rem',
                        background: 'var(--background)'
                    }}>
                        {scrapedImages.map((img, i) => (
                            <div
                                key={i}
                                onClick={() => toggleImage(i)}
                                style={{
                                    position: 'relative',
                                    aspectRatio: '1',
                                    borderRadius: '5px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    outline: selectedImages.has(i) ? '2.5px solid var(--primary)' : '2px solid transparent',
                                    transition: 'outline 0.12s ease, transform 0.12s ease',
                                    transform: selectedImages.has(i) ? 'scale(0.94)' : 'scale(1)',
                                    background: 'var(--surface-border)'
                                }}
                            >
                                <img
                                    src={img.src}
                                    alt={img.alt || ''}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => {
                                        e.target.style.display = 'none';
                                        e.target.parentNode.style.background = 'var(--surface-border)';
                                    }}
                                />
                                {selectedImages.has(i) && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        background: 'var(--primary)',
                                        borderRadius: '50%',
                                        width: '14px',
                                        height: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <FiCheck size={8} color="white" />
                                    </div>
                                )}
                                {img.isFeatured && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        left: '2px',
                                        background: 'rgba(0,0,0,0.65)',
                                        borderRadius: '3px',
                                        fontSize: '0.55rem',
                                        color: 'white',
                                        padding: '1px 3px',
                                        fontWeight: 700
                                    }}>★</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Variation Control */}
                    <div>
                        <label className="sidebar-label" style={{ marginBottom: '0.35rem' }}>Pins per image</label>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                            Default: 1 pin per image. Set higher to generate unique text variations.
                        </p>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            className="glass-input"
                            style={{ width: '100%', fontSize: '0.875rem' }}
                            value={variationCount}
                            onChange={e => setVariationCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                            id="variation-count-input"
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', borderRadius: '100px', marginTop: '0.25rem' }}
                        onClick={handleGenerate}
                        disabled={isGenerating || selectedImages.size === 0}
                        id="scrape-generate-btn"
                    >
                        {isGenerating
                            ? <><span className="animate-pulse">⏳</span> Generating...</>
                            : <>Generate {totalPins} {totalPins === 1 ? 'Pin' : 'Pins'} →</>
                        }
                    </button>
                </div>
            )}
        </div>
    );
}
