"use client";

import { useEffect } from 'react';
import { FiX, FiRefreshCw, FiExternalLink, FiTrash2 } from 'react-icons/fi';

export default function PinModal({ pin, onClose, onUpdate, onRegenerate, onDelete, existingBoards = [] }) {
    useEffect(() => {
        const handle = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [onClose]);

    if (!pin) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(11, 16, 33, 0.6)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                animation: 'fadeIn 0.2s ease forwards'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '820px',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    borderRadius: 'var(--radius-xl)',
                    background: '#ffffff',
                    boxShadow: '0 32px 80px -20px rgba(0,0,0,0.35)',
                    animation: 'slideUp 0.25s ease forwards'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Left: Pin Image Preview */}
                <div style={{
                    width: '240px',
                    minWidth: '240px',
                    background: 'var(--background)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem',
                    gap: '0.75rem'
                }}>
                    <div style={{
                        width: '100%',
                        aspectRatio: '2/3',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        background: 'var(--surface-border)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }}>
                        {pin.imageUrl ? (
                            <img
                                src={pin.imageUrl}
                                alt={pin.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🖼️</div>
                        )}
                    </div>

                    {pin.sourceUrl && (
                        <a
                            href={pin.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted',
                                textUnderlineOffset: '2px'
                            }}
                        >
                            View Source <FiExternalLink size={11} />
                        </a>
                    )}
                </div>

                {/* Right: Edit Fields */}
                <div style={{
                    flex: 1,
                    padding: '1.75rem',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.1rem'
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Edit Pin</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                onClick={() => onRegenerate(pin.id)}
                                disabled={pin.isRegenerating}
                                style={{
                                    fontSize: '0.78rem',
                                    padding: '0.4rem 0.875rem',
                                    background: 'rgba(108, 56, 255, 0.08)',
                                    color: 'var(--primary)',
                                    borderRadius: '100px',
                                    border: '1px solid rgba(108,56,255,0.15)',
                                    cursor: pin.isRegenerating ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontWeight: 600,
                                    opacity: pin.isRegenerating ? 0.6 : 1,
                                    fontFamily: 'inherit'
                                }}
                                id="modal-regen-btn"
                            >
                                <FiRefreshCw size={11} className={pin.isRegenerating ? 'animate-spin' : ''} />
                                {pin.isRegenerating ? 'Regenerating…' : 'Regenerate'}
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'var(--background)',
                                    borderRadius: '50%',
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    border: '1px solid var(--surface-border)',
                                    color: 'var(--text-muted)',
                                    flexShrink: 0
                                }}
                                id="modal-close-btn"
                            >
                                <FiX size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'var(--surface-border)' }} />

                    {/* Title */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label>
                        <input
                            type="text"
                            className="glass-input"
                            style={{ width: '100%', fontSize: '0.875rem', fontWeight: 600 }}
                            value={pin.title || ''}
                            onChange={e => onUpdate(pin.id, 'title', e.target.value)}
                            maxLength={100}
                            id="modal-title-input"
                        />
                        <div style={{ textAlign: 'right', fontSize: '0.65rem', color: pin.title?.length > 90 ? 'var(--danger)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {pin.title?.length || 0}/100
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                        <textarea
                            className="glass-input"
                            style={{ width: '100%', minHeight: '100px', fontSize: '0.85rem', resize: 'vertical', lineHeight: 1.6 }}
                            value={pin.description || ''}
                            onChange={e => onUpdate(pin.id, 'description', e.target.value)}
                            maxLength={500}
                            id="modal-desc-input"
                        />
                        <div style={{ textAlign: 'right', fontSize: '0.65rem', color: pin.description?.length > 480 ? 'var(--danger)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {pin.description?.length || 0}/500
                        </div>
                    </div>

                    {/* Keywords + Board — side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keywords</label>
                            <input
                                type="text"
                                className="glass-input"
                                style={{ width: '100%', fontSize: '0.82rem' }}
                                value={pin.keywords || ''}
                                onChange={e => onUpdate(pin.id, 'keywords', e.target.value)}
                                placeholder="comma, separated"
                                id="modal-keywords-input"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Board Name</label>
                            <input
                                type="text"
                                list="modal-boards-list"
                                className="glass-input"
                                style={{ width: '100%', fontSize: '0.82rem' }}
                                value={pin.boardName || ''}
                                onChange={e => onUpdate(pin.id, 'boardName', e.target.value)}
                                id="modal-board-input"
                            />
                            <datalist id="modal-boards-list">
                                {existingBoards.map((b, i) => <option key={i} value={b} />)}
                            </datalist>
                        </div>
                    </div>

                    {/* Publish Date + Destination URL */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Publish Date</label>
                            <input
                                type="datetime-local"
                                className="glass-input"
                                style={{ width: '100%', fontSize: '0.82rem' }}
                                value={pin.publishDate ? new Date(pin.publishDate).toISOString().slice(0, 16) : ''}
                                onChange={e => onUpdate(pin.id, 'publishDate', new Date(e.target.value).toISOString())}
                                id="modal-date-input"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Destination URL</label>
                            <input
                                type="url"
                                className="glass-input"
                                style={{ width: '100%', fontSize: '0.82rem' }}
                                value={pin.sourceUrl || ''}
                                onChange={e => onUpdate(pin.id, 'sourceUrl', e.target.value)}
                                id="modal-url-input"
                            />
                        </div>
                    </div>

                    {/* Done button */}
                    <div style={{ display: 'flex', gap: '0.875rem', marginTop: 'auto' }}>
                        <button
                            onClick={onDelete}
                            className="btn"
                            style={{ 
                                borderRadius: '100px', 
                                padding: '0.65rem 1rem', 
                                background: 'rgba(255, 59, 48, 0.08)', 
                                color: 'var(--danger)', 
                                border: '1px solid rgba(255, 59, 48, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600
                            }}
                            id="modal-delete-btn"
                        >
                            <FiTrash2 size={13} /> Delete
                        </button>
                        <button
                            onClick={onClose}
                            className="btn btn-primary"
                            style={{ borderRadius: '100px', flex: 1 }}
                            id="modal-done-btn"
                        >
                            Done — Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
