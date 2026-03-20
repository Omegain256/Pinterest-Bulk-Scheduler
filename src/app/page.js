"use client";

import { useState } from 'react';
import { FiLink, FiImage, FiSettings, FiDownload, FiPlay } from 'react-icons/fi';
import DataGrid from '@/components/DataGrid';
import SchedulingTools from '@/components/SchedulingTools';
import { exportToPinterestCSV } from '@/utils/csvExport';

export default function Home() {
  const [urls, setUrls] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [existingBoards, setExistingBoards] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPins, setGeneratedPins] = useState([]);

  const [settings, setSettings] = useState({
    niche: 'Auto-Detect (AI)',
    aspectRatio: '9:16',
  });

  // Load saved keys and boards from localStorage on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('pinterest_tool_api_key');
      const savedGeminiKey = localStorage.getItem('pinterest_tool_gemini_key');
      const savedBoards = localStorage.getItem('pinterest_tool_existing_boards');
      if (savedApiKey) setApiKey(savedApiKey);
      if (savedGeminiKey) setGeminiKey(savedGeminiKey);
      if (savedBoards) setExistingBoards(savedBoards);
    }
  });

  const handleGenerate = async () => {
    if (!urls.trim()) return;

    // Save to localStorage
    localStorage.setItem('pinterest_tool_api_key', apiKey.trim());
    localStorage.setItem('pinterest_tool_gemini_key', geminiKey.trim());
    localStorage.setItem('pinterest_tool_existing_boards', existingBoards.trim());

    setIsGenerating(true);

    const boardList = existingBoards.split('\n').map(b => b.trim()).filter(b => b.length > 0);

    // Split URLs by newline
    const urlList = urls.split('\n').filter(url => url.trim().length > 0);
    setGeneratedPins([]); // Clear previous results

    // Chunk size (e.g., 5 URLs per request to avoid Vercel timeouts and rate limits)
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
          const errMsg = errJson.error || "Unknown server error";
          console.error("Batch failed:", errMsg);
          alert(`Batch generation failed: ${errMsg}`);
          setIsGenerating(false); // Stop if a batch fails so they can fix settings
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let streamDone = false;
        let buffer = "";

        while (!streamDone) {
          const { value, done } = await reader.read();
          streamDone = done;

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || "";

            for (const event of events) {
              if (event.startsWith('data: ')) {
                const dataStr = event.substring(6);
                try {
                  const pin = JSON.parse(dataStr);
                  setGeneratedPins(prev => [...prev, pin]);
                } catch (e) {
                  console.error("Failed to parse incoming pin stream:", e);
                }
              }
            }
          }
        }
        // Small delay between chunks to respect rate limits if needed
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      alert("An error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdatePin = (id, field, value) => {
    setGeneratedPins(prev => prev.map(pin =>
      pin.id === id ? { ...pin, [field]: value } : pin
    ));
  };

  const handleRegenerate = async (id) => {
    const pinToRegen = generatedPins.find(p => p.id === id);
    if (!pinToRegen) return;

    // Mark as regenerating to show loading spinner on the button
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
        alert("Failed to regenerate pin.");
        setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: false } : p));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamDone = false;
      let buffer = "";
      let newPin = null;

      while (!streamDone) {
        const { value, done } = await reader.read();
        streamDone = done;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || "";

          for (const event of events) {
            if (event.startsWith('data: ')) {
              const dataStr = event.substring(6);
              try {
                newPin = JSON.parse(dataStr);
              } catch (e) {
                console.error("Parse error:", e);
              }
            }
          }
        }
      }

      if (newPin) {
        // Keep the original ID to ensure stable React ordering/keys
        newPin.id = id;
        setGeneratedPins(prev => prev.map(p => p.id === id ? newPin : p));
      } else {
        setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: false } : p));
      }

    } catch (error) {
      console.error("Regeneration error:", error);
      setGeneratedPins(prev => prev.map(p => p.id === id ? { ...p, isRegenerating: false } : p));
    }
  };

  const boardList = existingBoards.split('\n').map(b => b.trim()).filter(b => b.length > 0);

  return (
    <main className="animate-fade-in" style={{ padding: '4rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <header className="flex-col items-center" style={{ marginBottom: '3rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto 3rem auto' }}>
        <div style={{
          background: 'var(--primary)',
          padding: '1rem',
          borderRadius: '16px',
          display: 'inline-flex',
          boxShadow: 'var(--shadow-neon)',
          marginBottom: '1.5rem'
        }}>
          <FiImage size={28} color="white" />
        </div>
        <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--foreground)', lineHeight: 1.1 }}>
          Create rank-ready <br /> pins in minutes
        </h1>
        <p style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '1.25rem', marginTop: '1rem' }}>
          Generate highly-optimized titles, descriptions, and AI visuals instantly.
        </p>
      </header>

      <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
        {/* Subtle Glow Behind Input */}
        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '5%',
          right: '5%',
          bottom: '-20px',
          background: 'var(--primary)',
          filter: 'blur(60px)',
          opacity: 0.15,
          zIndex: 0,
          borderRadius: '100px'
        }}></div>

        <div className="glass-panel" style={{ padding: '2rem', zIndex: 1, position: 'relative', background: '#ffffff', borderRadius: 'var(--radius-xl)' }}>
          <h2 className="flex items-center gap-2" style={{ fontSize: '1.1rem', marginBottom: '1rem', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <FiLink /> Paste your destination URLs below
          </h2>
          <textarea
            className="glass-input"
            style={{ width: '100%', minHeight: '180px', resize: 'vertical', fontSize: '1.1rem', border: '1px solid var(--surface-border)', background: '#fafafc', marginBottom: '1.5rem' }}
            placeholder="https://example.com/blog/post-1&#10;https://example.com/product/item-2"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />

          <h2 className="flex items-center gap-2" style={{ fontSize: '1.1rem', marginBottom: '1rem', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <FiSettings /> Existing Pinterest Boards (one per line)
          </h2>
          <textarea
            className="glass-input"
            style={{ width: '100%', minHeight: '120px', resize: 'vertical', fontSize: '1rem', border: '1px solid var(--surface-border)', background: '#fafafc' }}
            placeholder="Style Inspiration&#10;Beauty Tips&#10;Home Decor"
            value={existingBoards}
            onChange={(e) => setExistingBoards(e.target.value)}
          />

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input
                  type="password"
                  className="glass-input"
                  style={{ flex: 1, fontSize: '1rem', padding: '1rem 1.5rem', borderRadius: '100px', background: '#ffffff', border: '1px solid var(--surface-border)' }}
                  placeholder="Tool Access Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <input
                  type="password"
                  className="glass-input"
                  style={{ flex: 1, fontSize: '1rem', padding: '1rem 1.5rem', borderRadius: '100px', background: '#ffffff', border: '1px solid var(--surface-border)' }}
                  placeholder="Your Gemini API Key"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>
              <select
                className="glass-input"
                style={{ width: '100%', fontSize: '1rem', padding: '1rem 1.5rem', borderRadius: '100px', background: '#ffffff', appearance: 'none', cursor: 'pointer' }}
                value={settings.niche}
                onChange={(e) => setSettings({ ...settings, niche: e.target.value })}
              >
                <option value="Auto-Detect (AI)">✨ Auto-Detect (AI)</option>
                <option value="Beauty & Makeup">Beauty & Makeup</option>
                <option value="Hair Styling">Hair Styling</option>
                <option value="Fashion & Outfits">Fashion & Outfits</option>
                <option value="Nails & Beauty">Nails & Beauty</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              style={{ padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '100px', whiteSpace: 'nowrap' }}
              onClick={handleGenerate}
              disabled={isGenerating || urls.trim().length === 0}
            >
              {isGenerating ? (
                <>Generating... <span className="animate-pulse">⏳</span></>
              ) : (
                <>Generate with AI <span style={{ fontSize: '1.2em' }}>→</span></>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Data Grid Section (Only shows if there are pins) */}
      {generatedPins.length > 0 && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginTop: '4rem', zIndex: 1, position: 'relative', textAlign: 'left', width: '100%' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Review & Edit</h2>
            <button
              className="btn btn-primary"
              onClick={() => exportToPinterestCSV(generatedPins)}
              style={{ borderRadius: '100px' }}
            >
              <FiDownload /> Export CSV
            </button>
          </div>
          <DataGrid pins={generatedPins} onUpdate={handleUpdatePin} onRegenerate={handleRegenerate} existingBoards={boardList} />

          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.5rem' }}>
            <SchedulingTools
              pins={generatedPins}
              onApplySchedule={(newPins) => setGeneratedPins(newPins)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
