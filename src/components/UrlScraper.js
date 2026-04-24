"use client";

import { useState, useRef } from 'react';
import { FiSearch, FiCheck, FiImage, FiPlus, FiTrash2, FiCopy, FiChevronLeft, FiChevronRight, FiLink } from 'react-icons/fi';

const TEMPLATES = [
    {
        id: 'top_bar', name: 'Top Bar', desc: 'Dark bar + gold number',
        preview: (<div style={{ width:'100%',height:'100%',background:'linear-gradient(160deg,#b0a5e0,#9580d4)',position:'relative',display:'flex',flexDirection:'column' }}>
            <div style={{ background:'rgba(6,6,6,0.87)',padding:'0.28rem 0.32rem',display:'flex',alignItems:'center',gap:'4px',flexShrink:0 }}>
                <span style={{ color:'#C8961C',fontWeight:900,fontSize:'0.8rem',fontFamily:'sans-serif',lineHeight:1,flexShrink:0 }}>8</span>
                <div style={{ flex:1,display:'flex',flexDirection:'column',gap:'2.5px' }}>
                    <div style={{ background:'rgba(255,255,255,0.93)',height:'3.5px',borderRadius:'2px' }}/>
                    <div style={{ background:'rgba(255,255,255,0.68)',height:'3.5px',borderRadius:'2px',width:'72%' }}/>
                </div>
            </div>
        </div>),
    },
    {
        id: 'cta_button', name: 'CTA Button', desc: 'Title on image + red CTA',
        preview: (<div style={{ width:'100%',height:'100%',background:'linear-gradient(160deg,#b0a5e0,#9580d4)',position:'relative',display:'flex',flexDirection:'column' }}>
            <div style={{ padding:'0.3rem 0.38rem 0',display:'flex',flexDirection:'column',alignItems:'center',gap:'2.5px' }}>
                <div style={{ background:'rgba(255,255,255,0.92)',height:'5.5px',borderRadius:'3px',width:'52%',boxShadow:'0 2px 5px rgba(0,0,0,0.6)' }}/>
                <div style={{ background:'rgba(255,255,255,0.78)',height:'4.5px',borderRadius:'3px',width:'78%' }}/>
            </div>
            <div style={{ position:'absolute',bottom:'5px',left:'6%',right:'6%',background:'#C91C1C',borderRadius:'100px',padding:'4px 0',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <div style={{ background:'rgba(255,255,255,0.88)',height:'3.5px',borderRadius:'2px',width:'52%' }}/>
            </div>
        </div>),
    },
    {
        id: 'big_center', name: 'Big Center', desc: 'Massive centered text',
        preview: (<div style={{ width:'100%',height:'100%',background:'linear-gradient(160deg,#b0a5e0,#9580d4)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'2.5px' }}>
            <div style={{ background:'rgba(255,255,255,0.60)',height:'4px',borderRadius:'2px',width:'22%' }}/>
            <div style={{ background:'rgba(255,255,255,0.96)',height:'7px',borderRadius:'3px',width:'90%' }}/>
            <div style={{ background:'rgba(255,255,255,0.82)',height:'7px',borderRadius:'3px',width:'76%' }}/>
        </div>),
    },
    {
        id: 'minimal', name: 'Minimal', desc: 'Clean image, no overlay',
        preview: (<div style={{ width:'100%',height:'100%',background:'linear-gradient(160deg,#b0a5e0,#9580d4)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'4px' }}>
            <FiImage size={16} color="rgba(255,255,255,0.65)"/>
            <div style={{ fontSize:'0.42rem',color:'rgba(255,255,255,0.55)',fontFamily:'sans-serif',letterSpacing:'0.06em',textTransform:'uppercase' }}>No text</div>
        </div>),
    },
];

const makeJob = (url = '', position = 1) => ({
    id: Date.now() + Math.random(),
    url,
    imagePosition: position,
    scraped: null,      // { images:[], total:0, pageTitle:'' }
    isScraping: false,
    scrapeError: '',
});

export default function UrlScraper({ apiKey, geminiKey, niche, existingBoards, onPinGenerated, isGenerating, setIsGenerating }) {
    const [jobs, setJobs] = useState([makeJob()]);
    const [variationCount, setVariationCount] = useState(1);
    const [selectedTemplates, setSelectedTemplates] = useState(new Set(['top_bar', 'cta_button', 'big_center', 'minimal']));
    const cache = useRef({});   // url → scraped data

    const updateJob = (id, patch) => setJobs(p => p.map(j => j.id === id ? { ...j, ...patch } : j));
    const addJob = () => setJobs(p => [...p, makeJob()]);
    const removeJob = (id) => setJobs(p => p.length > 1 ? p.filter(j => j.id !== id) : p);

    const duplicateJob = (job) => {
        const sameUrl = jobs.filter(j => j.url.trim() === job.url.trim());
        const nextPos = Math.max(...sameUrl.map(j => j.imagePosition)) + 1;
        const dup = makeJob(job.url, nextPos);
        if (cache.current[job.url.trim()]) {
            dup.scraped = cache.current[job.url.trim()];
            dup.imagePosition = Math.min(nextPos, dup.scraped.images.length);
        }
        setJobs(p => {
            const idx = p.findIndex(j => j.id === job.id);
            const next = [...p];
            next.splice(idx + 1, 0, dup);
            return next;
        });
    };

    const scrapeJob = async (id) => {
        const job = jobs.find(j => j.id === id);
        if (!job?.url.trim()) return;
        const url = job.url.trim();
        if (cache.current[url]) {
            updateJob(id, { scraped: cache.current[url], scrapeError: '' });
            return;
        }
        updateJob(id, { isScraping: true, scrapeError: '', scraped: null });
        try {
            const res = await fetch('/api/scrape-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
                body: JSON.stringify({ url }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Scrape failed');
            const data = await res.json();
            const scraped = { images: data.images || [], total: data.total || 0, pageTitle: data.pageTitle || '' };
            cache.current[url] = scraped;
            updateJob(id, { scraped, isScraping: false, imagePosition: 1 });
        } catch (err) {
            updateJob(id, { isScraping: false, scrapeError: err.message });
        }
    };

    const toggleTemplate = (id) => setSelectedTemplates(prev => {
        const next = new Set(prev);
        if (next.has(id) && next.size === 1) return prev;
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const handleGenerate = async () => {
        const ready = jobs.filter(j => j.scraped?.images?.length > 0);
        if (!ready.length || isGenerating) return;

        const jobsPayload = ready.map(j => {
            const idx = Math.min(j.imagePosition - 1, j.scraped.images.length - 1);
            const img = j.scraped.images[idx];
            return { imageUrl: img.src, imageAlt: img.alt || '', sourceUrl: j.url.trim(), totalScraped: j.scraped.total, imagePosition: j.imagePosition };
        });

        setIsGenerating(true);
        const boardList = existingBoards.split('\n').map(b => b.trim()).filter(Boolean);

        try {
            const response = await fetch('/api/scrape-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey.trim() },
                body: JSON.stringify({ jobs: jobsPayload, variationCount, niche, geminiKey: geminiKey.trim(), existingBoards: boardList, templates: Array.from(selectedTemplates) }),
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
                    for (const ev of events) {
                        if (ev.startsWith('data: ')) {
                            try { onPinGenerated(JSON.parse(ev.substring(6))); } catch (_) {}
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

    const readyCount = jobs.filter(j => j.scraped?.images?.length > 0).length;
    const totalPins = readyCount * variationCount;

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.125rem' }}>

            {/* ── URL Job List ── */}
            <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                    <label className="sidebar-label" style={{ marginBottom:0 }}>Article Sources</label>
                    <button id="add-url-btn" onClick={addJob} style={{ display:'flex',alignItems:'center',gap:'0.3rem',fontSize:'0.72rem',fontWeight:600,color:'var(--primary)',background:'none',border:'none',cursor:'pointer',padding:'0.2rem 0' }}>
                        <FiPlus size={12}/> Add URL
                    </button>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                    {jobs.map((job, idx) => {
                        const hasData = job.scraped?.images?.length > 0;
                        const total = hasData ? job.scraped.images.length : 0;
                        const imgIdx = hasData ? Math.min(job.imagePosition - 1, total - 1) : -1;
                        const currentImg = imgIdx >= 0 ? job.scraped.images[imgIdx] : null;

                        return (
                            <div key={job.id} style={{ background:'var(--surface)', border:'1px solid var(--surface-border)', borderRadius:'var(--radius-md)', padding:'0.55rem 0.6rem', display:'flex', flexDirection:'column', gap:'0.45rem' }}>

                                {/* Row 1: URL + actions */}
                                <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                                    <FiLink size={11} color="var(--text-muted)" style={{ flexShrink:0 }}/>
                                    <input
                                        type="url"
                                        id={`url-input-${idx}`}
                                        className="glass-input"
                                        style={{ flex:1, fontSize:'0.78rem', padding:'0.3rem 0.5rem' }}
                                        placeholder="https://example.com/article"
                                        value={job.url}
                                        onChange={e => updateJob(job.id, { url: e.target.value, scraped: null, scrapeError: '' })}
                                        onKeyDown={e => e.key === 'Enter' && scrapeJob(job.id)}
                                    />
                                    <button
                                        onClick={() => scrapeJob(job.id)}
                                        disabled={job.isScraping || !job.url.trim()}
                                        style={{ display:'flex',alignItems:'center',gap:'0.25rem',padding:'0.28rem 0.55rem',fontSize:'0.7rem',fontWeight:600,borderRadius:'var(--radius-md)',border:'1px solid var(--primary)',background:'transparent',color:'var(--primary)',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,opacity:(job.isScraping||!job.url.trim())?0.5:1 }}
                                    >
                                        {job.isScraping ? <span className="animate-spin">⟳</span> : <FiSearch size={11}/>}
                                    </button>
                                    <button onClick={() => duplicateJob(job)} title="Duplicate (next image)" style={{ display:'flex',alignItems:'center',padding:'0.28rem',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',flexShrink:0 }}>
                                        <FiCopy size={13}/>
                                    </button>
                                    {jobs.length > 1 && (
                                        <button onClick={() => removeJob(job.id)} style={{ display:'flex',alignItems:'center',padding:'0.28rem',background:'none',border:'none',cursor:'pointer',color:'var(--danger)',flexShrink:0 }}>
                                            <FiTrash2 size={13}/>
                                        </button>
                                    )}
                                </div>

                                {/* Row 2: Thumbnail + position picker */}
                                {hasData && currentImg && (
                                    <div style={{ display:'flex', alignItems:'center', gap:'0.55rem' }}>
                                        {/* Thumbnail */}
                                        <div style={{ width:'52px',height:'52px',borderRadius:'6px',overflow:'hidden',flexShrink:0,background:'var(--surface-border)',position:'relative' }}>
                                            <img src={currentImg.src} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} onError={e => { e.target.style.display='none'; }}/>
                                            <div style={{ position:'absolute',bottom:'2px',left:'2px',background:'rgba(0,0,0,0.6)',borderRadius:'3px',fontSize:'0.55rem',color:'#fff',padding:'1px 4px',fontWeight:700,lineHeight:1 }}>
                                                #{job.imagePosition}
                                            </div>
                                        </div>
                                        {/* Position picker */}
                                        <div style={{ flex:1 }}>
                                            <div style={{ display:'flex',alignItems:'center',gap:'0.35rem',marginBottom:'0.25rem' }}>
                                                <button
                                                    onClick={() => updateJob(job.id, { imagePosition: Math.max(1, job.imagePosition - 1) })}
                                                    disabled={job.imagePosition <= 1}
                                                    style={{ display:'flex',alignItems:'center',padding:'0.2rem',background:'none',border:'1px solid var(--surface-border)',borderRadius:'4px',cursor:'pointer',color:'var(--foreground)',opacity:job.imagePosition<=1?0.3:1 }}
                                                ><FiChevronLeft size={12}/></button>
                                                <span style={{ fontSize:'0.7rem',fontWeight:600,color:'var(--foreground)',minWidth:'80px',textAlign:'center' }}>
                                                    Image {job.imagePosition} of {total}
                                                </span>
                                                <button
                                                    onClick={() => updateJob(job.id, { imagePosition: Math.min(total, job.imagePosition + 1) })}
                                                    disabled={job.imagePosition >= total}
                                                    style={{ display:'flex',alignItems:'center',padding:'0.2rem',background:'none',border:'1px solid var(--surface-border)',borderRadius:'4px',cursor:'pointer',color:'var(--foreground)',opacity:job.imagePosition>=total?0.3:1 }}
                                                ><FiChevronRight size={12}/></button>
                                            </div>
                                            {job.scraped.pageTitle && (
                                                <div style={{ fontSize:'0.65rem',color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'160px' }} title={job.scraped.pageTitle}>
                                                    {job.scraped.pageTitle}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Error */}
                                {job.scrapeError && (
                                    <p style={{ margin:0,fontSize:'0.68rem',color:'var(--danger)' }}>⚠ {job.scrapeError}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Template Picker ── */}
            <div>
                <label className="sidebar-label">
                    Pin Templates
                    <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:'0.3rem',fontSize:'0.67rem' }}>(applied randomly)</span>
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                    {TEMPLATES.map(t => {
                        const active = selectedTemplates.has(t.id);
                        return (
                            <div key={t.id} id={`template-${t.id}`} onClick={() => toggleTemplate(t.id)} style={{ borderRadius:'8px',overflow:'hidden',border:active?'2.5px solid var(--primary)':'2px solid var(--surface-border)',cursor:'pointer',position:'relative',transition:'border-color 0.15s ease,transform 0.12s ease',transform:active?'scale(0.96)':'scale(1)' }}>
                                <div style={{ aspectRatio:'2/3',position:'relative' }}>{t.preview}</div>
                                {active && <div style={{ position:'absolute',top:'5px',right:'5px',background:'var(--primary)',borderRadius:'50%',width:'14px',height:'14px',display:'flex',alignItems:'center',justifyContent:'center' }}><FiCheck size={8} color="white"/></div>}
                                <div style={{ padding:'0.35rem 0.4rem 0.4rem',background:'var(--surface)' }}>
                                    <div style={{ fontSize:'0.67rem',fontWeight:700,color:'var(--foreground)',lineHeight:1.2 }}>{t.name}</div>
                                    <div style={{ fontSize:'0.6rem',color:'var(--text-muted)',marginTop:'1px' }}>{t.desc}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Variations ── */}
            <div>
                <label className="sidebar-label" style={{ marginBottom:'0.35rem' }}>Pins per URL</label>
                <input
                    id="variation-count-input"
                    type="number" min="1" max="10"
                    className="glass-input"
                    style={{ width:'100%', fontSize:'0.875rem' }}
                    value={variationCount}
                    onChange={e => setVariationCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                />
            </div>

            {/* ── Generate ── */}
            <button
                id="scrape-generate-btn"
                className="btn btn-primary"
                style={{ width:'100%', borderRadius:'100px' }}
                onClick={handleGenerate}
                disabled={isGenerating || readyCount === 0}
            >
                {isGenerating
                    ? <><span className="animate-pulse">⏳</span> Generating…</>
                    : readyCount === 0
                        ? 'Scan a URL to generate pins'
                        : <>Generate {totalPins} {totalPins === 1 ? 'Pin' : 'Pins'} →</>
                }
            </button>
        </div>
    );
}
