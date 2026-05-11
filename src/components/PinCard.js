"use client";

import { FiRefreshCw, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function PinCard({ pin, onEdit, onRegenerate, onDelete }) {
    return (
        <div
            className="pin-card"
            onClick={() => onEdit(pin.id)}
            id={`pin-card-${pin.id}`}
        >
            {/* Image — 2:3 Pinterest ratio */}
            <div style={{ position: 'relative', background: 'var(--surface-border)' }}>
                <div style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                    {pin.imageUrl ? (
                        <img
                            src={pin.imageUrl}
                            alt={pin.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => {
                                e.target.style.display = 'none';
                                e.target.parentNode.style.background = 'var(--surface-border)';
                            }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontSize: '1.75rem' }}>🖼️</span>
                            <span style={{ fontSize: '0.7rem' }}>No image</span>
                        </div>
                    )}
                </div>

                {/* Hover overlay */}
                <div className="pin-card-overlay">
                    <button
                        onClick={e => { e.stopPropagation(); onEdit(pin.id); }}
                        style={{
                            background: 'rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: '8px',
                            padding: '0.4rem 1rem',
                            color: 'white',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                            transition: 'background 0.15s ease'
                        }}
                    >
                        <FiEdit2 size={12} /> Edit Pin
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onRegenerate(pin.id); }}
                        disabled={pin.isRegenerating}
                        style={{
                            background: 'rgba(255,255,255,0.12)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            padding: '0.4rem 1rem',
                            color: 'white',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: pin.isRegenerating ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            opacity: pin.isRegenerating ? 0.6 : 1
                        }}
                    >
                        <FiRefreshCw size={12} className={pin.isRegenerating ? 'animate-spin' : ''} />
                        {pin.isRegenerating ? 'Regenerating…' : 'Regenerate'}
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        style={{
                            background: 'rgba(255,59,48,0.25)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,59,48,0.3)',
                            borderRadius: '8px',
                            padding: '0.4rem',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                        }}
                        title="Delete Pin"
                    >
                        <FiTrash2 size={13} />
                    </button>
                </div>

                {/* Regenerating pulse overlay */}
                {pin.isRegenerating && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(108, 56, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'inherit'
                    }}>
                        <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, background: 'white', borderRadius: '100px', padding: '0.35rem 0.875rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            <span className="animate-spin" style={{ display: 'inline-block', marginRight: '0.35rem' }}>⟳</span> Regenerating
                        </div>
                    </div>
                )}
            </div>

            {/* Card Body */}
            <div style={{ padding: '0.65rem 0.75rem' }}>
                {/* Title */}
                <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    lineHeight: 1.35,
                    marginBottom: '0.45rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {pin.title || 'Untitled Pin'}
                </div>

                {/* Board + Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{
                        fontSize: '0.65rem',
                        background: 'rgba(108, 56, 255, 0.09)',
                        color: 'var(--primary)',
                        borderRadius: '100px',
                        padding: '0.15rem 0.55rem',
                        fontWeight: 600,
                        maxWidth: '65%',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        flexShrink: 0
                    }}>
                        {pin.boardName || 'No board'}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(pin.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                </div>
            </div>
        </div>
    );
}
