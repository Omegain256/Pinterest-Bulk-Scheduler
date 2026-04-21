"use client";

import { useState, useEffect } from 'react';
import { FiImage, FiDownload, FiZap, FiSearch, FiTrash2, FiGrid, FiCalendar } from 'react-icons/fi';
import PinCard from '@/components/PinCard';
import PinModal from '@/components/PinModal';
import SchedulingTools from '@/components/SchedulingTools';
import UrlScraper from '@/components/UrlScraper';
import { exportToPinterestCSV } from '@/utils/csvExport';

export default function Home() {
  const [inputMode, setInputMode] = useState('ai'); // 'ai' | 'scrape'
  const [urls, setUrls] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [existingBoards, setExistingBoards] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPins, setGeneratedPins] = useState([]);
  const [editingPinId, setEditingPinId] = useState(null);

  const [settings, setSettings] = useState({
    niche: 'Auto-Detect (AI)',
    aspectRatio: '9:16',
  });

  // Load saved API keys and boards from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('pinterest_tool_api_key');
      const savedGeminiKey = localStorage.getItem('pinterest_tool_gemini_key');
      const savedBoards = localStorage.getItem('pinterest_tool_existing_boards');
      if (savedApiKey) setApiKey(savedApiKey);
      if (savedGeminiKey) setGeminiKey(savedGeminiKey);
      if (savedBoards) setExistingBoards(savedBoards);
    }
  }, []);

  // ── AI Generate handler (unchanged logic) ────────────────────────────────
  const handleGenerate = async () => {
    if (!urls.trim()) return;

    localStorage.setItem('pinterest_tool_api_key', apiKey.trim());
    localStorage.setItem('pinterest_tool_gemini_key', geminiKey.trim());
    localStorage.setItem('pinterest_tool_existing_boards', existingBoards.trim());

    setIsGenerating(true);

    const boardList = existingBoards.split('\n').map(b => b.trim()).filter(b => b.length > 0);
    const urlList = urls.split('\n').filter(url => url.trim().length > 0);

    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < urlList.length; i += CHUNK_SIZE) {
      chunks.push(urlList.slice(i, i + CHUNK_SIZE));
    }

    try {
      for (const chunk of chunks) {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim()
          },
          body: JSON.stringify({
            urls: chunk,
            niche: settings.niche,
            aspectRatio: settings.aspectRatio,
            geminiKey: geminiKey.trim(),
            existingBoards: boardList
          })
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          alert(`Batch generation failed: ${errJson.error || 'Unknown error'}`);
          setIsGenerating(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let streamDone = false;
        let buffer = '';

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
                  setGeneratedPins(prev => [...prev, pin]);
                } catch (e) {
                  console.error('Failed to parse pin:', e);
                }
              }
            }
          }
        }

        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Shared handlers (unchanged logic) ────────────────────────────────────
  const handleUpdatePin = (id, field, value) => {
    setGeneratedPins(prev => prev.map(pin =>
      pin.id === id ? { ...pin, [field]: value } : pin
    ));
  };

  const handleRegenerate = async (id) => {
    const pinToRegen = generatedPins.find(p => p.id === id);
    if (!pinToRegen) return;

    setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: true } : p));

    const boardList = existingBoards.split('\n').map(b => b.trim()).filter(b => b.length > 0);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim()
        },
        body: JSON.stringify({
          urls: [pinToRegen.sourceUrl],
          niche: settings.niche,
          aspectRatio: settings.aspectRatio,
          geminiKey: geminiKey.trim(),
          existingBoards: boardList
        })
      });

      if (!response.ok) {
        setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: false } : p));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamDone = false;
      let buffer = '';
      let newPin = null;

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
                newPin = JSON.parse(event.substring(6));
              } catch {}
            }
          }
        }
      }

      if (newPin) {
        newPin.id = id;
        setGeneratedPins(prev => prev.map(p => p.id === id ? newPin : p));
      } else {
        setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: false } : p));
      }

    } catch {
      setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: false } : p));
    }
  };

  const boardList = existingBoards.split('\n').map(b => b.trim()).filter(b => b.length > 0);
  const editingPin = editingPinId ? generatedPins.find(p => p.id === editingPinId) : null;

  return (
    <div className="layout-shell">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{
            width: '38px', height: '38px',
            background: 'var(--primary)',
            borderRadius: '11px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-neon)',
            flexShrink: 0
          }}>
            <FiImage size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.025em', lineHeight: 1.2, color: 'var(--foreground)' }}>
              Pin Scheduler
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>AI Bulk Creator</div>
          </div>
        </div>

        {/* ── Mode Toggle ── */}
        <div className="mode-toggle">
          <button
            className={`mode-toggle-btn${inputMode === 'ai' ? ' active' : ''}`}
            onClick={() => setInputMode('ai')}
            id="mode-btn-ai"
          >
            <FiZap size={12} /> AI Generate
          </button>
          <button
            className={`mode-toggle-btn${inputMode === 'scrape' ? ' active' : ''}`}
            onClick={() => setInputMode('scrape')}
            id="mode-btn-scrape"
          >
            <FiSearch size={12} /> Scrape URL
          </button>
        </div>

        <div className="sidebar-divider" />

        {/* ── Shared Settings ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="sidebar-label">Niche</label>
            <select
              className="glass-input"
              style={{ width: '100%', fontSize: '0.82rem', appearance: 'none', cursor: 'pointer', background: '#fafafc' }}
              value={settings.niche}
              onChange={e => setSettings({ ...settings, niche: e.target.value })}
              id="niche-select"
            >
              <option value="Auto-Detect (AI)">✨ Auto-Detect (AI)</option>
              <option value="Beauty & Makeup">Beauty &amp; Makeup</option>
              <option value="Hair Styling">Hair Styling</option>
              <option value="Fashion & Outfits">Fashion &amp; Outfits</option>
              <option value="Nails & Beauty">Nails &amp; Beauty</option>
            </select>
          </div>

          <div>
            <label className="sidebar-label">Pinterest Boards <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(one per line)</span></label>
            <textarea
              className="glass-input"
              style={{ width: '100%', minHeight: '72px', resize: 'vertical', fontSize: '0.82rem', background: '#fafafc' }}
              placeholder={'Style Inspiration\nBeauty Tips\nHome Decor'}
              value={existingBoards}
              onChange={e => setExistingBoards(e.target.value)}
              id="boards-textarea"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <input
              type="password"
              className="glass-input"
              style={{ fontSize: '0.82rem', background: '#fafafc' }}
              placeholder="Tool Access Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              id="api-key-input"
            />
            <input
              type="password"
              className="glass-input"
              style={{ fontSize: '0.82rem', background: '#fafafc' }}
              placeholder="Your Gemini API Key"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              id="gemini-key-input"
            />
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* ── Mode-specific input area ── */}
        {inputMode === 'ai' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="sidebar-label">Destination URLs <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(one per line)</span></label>
              <textarea
                className="glass-input"
                style={{ width: '100%', minHeight: '110px', resize: 'vertical', fontSize: '0.82rem', background: '#fafafc' }}
                placeholder={'https://example.com/blog/post-1\nhttps://example.com/product/item-2'}
                value={urls}
                onChange={e => setUrls(e.target.value)}
                id="urls-textarea"
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', borderRadius: '100px' }}
              onClick={handleGenerate}
              disabled={isGenerating || urls.trim().length === 0}
              id="ai-generate-btn"
            >
              {isGenerating
                ? <><span className="animate-pulse">⏳</span> Generating…</>
                : <>Generate with AI <span style={{ fontSize: '1.1em' }}>→</span></>
              }
            </button>
          </div>
        ) : (
          <UrlScraper
            apiKey={apiKey}
            geminiKey={geminiKey}
            niche={settings.niche}
            existingBoards={existingBoards}
            onPinGenerated={(pin) => setGeneratedPins(prev => [...prev, pin])}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        )}

        {/* ── Scheduling + Export (shown once pins exist) ── */}
        {generatedPins.length > 0 && (
          <>
            <div className="sidebar-divider" />
            <SchedulingTools
              pins={generatedPins}
              onApplySchedule={(newPins) => setGeneratedPins(newPins)}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', borderRadius: '100px' }}
              onClick={() => exportToPinterestCSV(generatedPins)}
              id="export-csv-btn"
            >
              <FiDownload size={14} /> Export CSV
            </button>
          </>
        )}

      </aside>

      {/* ── RIGHT CONTENT AREA ───────────────────────────────────────────── */}
      <main className="content-area">

        {/* Content header bar */}
        <div className="content-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FiGrid size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)' }}>
              {generatedPins.length > 0
                ? <>{generatedPins.length} {generatedPins.length === 1 ? 'pin' : 'pins'} generated</>
                : 'Pin Preview Canvas'
              }
            </span>
            {isGenerating && (
              <span style={{
                fontSize: '0.72rem',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(108,56,255,0.08)',
                borderRadius: '100px',
                padding: '0.2rem 0.6rem',
                fontWeight: 600
              }}>
                <span className="animate-pulse" style={{ display: 'inline-block' }}>●</span>
                Generating…
              </span>
            )}
          </div>

          {generatedPins.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Clear all generated pins?')) setGeneratedPins([]); }}
              style={{
                fontSize: '0.78rem',
                color: 'var(--danger)',
                background: 'rgba(239,68,68,0.07)',
                border: 'none',
                borderRadius: '100px',
                padding: '0.35rem 0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                transition: 'background 0.15s ease'
              }}
              id="clear-pins-btn"
            >
              <FiTrash2 size={12} /> Clear All
            </button>
          )}
        </div>

        {/* Pin grid or empty state */}
        {generatedPins.length > 0 ? (
          <div className="pin-grid">
            {generatedPins.map(pin => (
              <PinCard
                key={pin.id}
                pin={pin}
                onEdit={setEditingPinId}
                onRegenerate={handleRegenerate}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div style={{
              width: '64px', height: '64px',
              background: 'rgba(108, 56, 255, 0.07)',
              borderRadius: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.25rem'
            }}>
              <FiImage size={28} style={{ color: 'var(--primary)', opacity: 0.65 }} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em', color: 'var(--foreground)' }}>
              Your pins will appear here
            </h2>
            <p style={{
              color: 'var(--text-muted)',
              marginTop: '0.5rem',
              fontSize: '0.85rem',
              maxWidth: '320px',
              textAlign: 'center',
              lineHeight: 1.65
            }}>
              Use <strong>AI Generate</strong> to create pins from destination URLs,<br />
              or <strong>Scrape URL</strong> to harvest images from any page.
            </p>

            {/* Decorative pin skeleton placeholder cards */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', opacity: 0.35 }}>
              {[2.2, 2.5, 2.1].map((ratio, i) => (
                <div key={i} style={{
                  width: '90px',
                  aspectRatio: `2/${ratio * 1.5}`,
                  borderRadius: '10px',
                  background: `rgba(108, 56, 255, ${0.04 + i * 0.02})`,
                  border: '1px solid rgba(108,56,255,0.08)'
                }} />
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Pin Edit Modal ── */}
      {editingPin && (
        <PinModal
          pin={editingPin}
          onClose={() => setEditingPinId(null)}
          onUpdate={handleUpdatePin}
          onRegenerate={handleRegenerate}
          existingBoards={boardList}
        />
      )}
    </div>
  );
}
