"use client";

import { useState } from 'react';
import { FiEdit2, FiCheck, FiRefreshCw } from 'react-icons/fi';

export default function DataGrid({ pins, onUpdate, onRegenerate }) {
    const [editingId, setEditingId] = useState(null);

    if (!pins || pins.length === 0) return null;

    return (
        <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)' }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
                textAlign: 'left'
            }}>
                <thead>
                    <tr style={{
                        borderBottom: '1px solid var(--surface-border)',
                        background: 'rgba(0, 0, 0, 0.02)'
                    }}>
                        <th style={{ padding: '1rem', width: '80px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Media</th>
                        <th style={{ padding: '1rem', width: '25%', minWidth: '250px', color: 'var(--text-muted)' }}>Title</th>
                        <th style={{ padding: '1rem', width: '35%', minWidth: '350px', color: 'var(--text-muted)' }}>Description</th>
                        <th style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Keywords</th>
                        <th style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Board Name</th>
                        <th style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Publish Date</th>
                        <th style={{ padding: '1rem', width: '120px', color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pins.map((pin) => (
                        <tr key={pin.id}
                            style={{
                                borderBottom: '1px solid var(--surface-border)',
                                verticalAlign: 'top',
                                transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >

                            {/* Thumbnail */}
                            <td style={{ padding: '1rem' }}>
                                {pin.imageUrl ? (
                                    <img
                                        src={pin.imageUrl}
                                        alt="Pin thumbnail"
                                        style={{ width: '60px', height: '106px', objectFit: 'cover', borderRadius: '4px' }}
                                    />
                                ) : (
                                    <div style={{ width: '60px', height: '106px', borderRadius: '4px', background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🖼️</div>
                                )}
                            </td>

                            {/* Title */}
                            <td style={{ padding: '1rem' }}>
                                {editingId === pin.id ? (
                                    <textarea
                                        className="glass-input"
                                        style={{ width: '100%', minHeight: '80px', fontSize: '0.875rem' }}
                                        value={pin.title}
                                        onChange={(e) => onUpdate(pin.id, 'title', e.target.value)}
                                    />
                                ) : (
                                    <div style={{ fontWeight: 600 }}>{pin.title}</div>
                                )}
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                                    Source: <a href={pin.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Link</a>
                                </div>
                            </td>

                            {/* Description */}
                            <td style={{ padding: '1rem' }}>
                                {editingId === pin.id ? (
                                    <textarea
                                        className="glass-input"
                                        style={{ width: '100%', minHeight: '120px', fontSize: '0.875rem' }}
                                        value={pin.description}
                                        onChange={(e) => onUpdate(pin.id, 'description', e.target.value)}
                                    />
                                ) : (
                                    <div style={{ color: 'var(--text-muted)' }}>{pin.description}</div>
                                )}
                            </td>

                            {/* Keywords */}
                            <td style={{ padding: '1rem' }}>
                                {editingId === pin.id ? (
                                    <textarea
                                        className="glass-input"
                                        style={{ width: '100%', minHeight: '80px', fontSize: '0.875rem' }}
                                        value={pin.keywords || ''}
                                        onChange={(e) => onUpdate(pin.id, 'keywords', e.target.value)}
                                        placeholder="Comma separated"
                                    />
                                ) : (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{pin.keywords}</div>
                                )}
                            </td>

                            {/* Board Name */}
                            <td style={{ padding: '1rem' }}>
                                {editingId === pin.id ? (
                                    <input
                                        type="text"
                                        className="glass-input"
                                        style={{ width: '100%', fontSize: '0.875rem' }}
                                        value={pin.boardName}
                                        onChange={(e) => onUpdate(pin.id, 'boardName', e.target.value)}
                                    />
                                ) : (
                                    <div>{pin.boardName}</div>
                                )}
                            </td>

                            {/* Publish Date */}
                            <td style={{ padding: '1rem' }}>
                                {editingId === pin.id ? (
                                    <input
                                        type="datetime-local"
                                        className="glass-input"
                                        style={{ width: '100%', fontSize: '0.875rem' }}
                                        value={new Date(pin.publishDate).toISOString().slice(0, 16)}
                                        onChange={(e) => onUpdate(pin.id, 'publishDate', new Date(e.target.value).toISOString())}
                                    />
                                ) : (
                                    <div>{new Date(pin.publishDate).toLocaleString()}</div>
                                )}
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '1rem', width: '120px', textAlign: 'center' }}>
                                {editingId === pin.id ? (
                                    <button
                                        onClick={() => setEditingId(null)}
                                        style={{
                                            color: 'var(--success)',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            padding: '0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'transform 0.2s ease'
                                        }}
                                        title="Save Changes"
                                    >
                                        <FiCheck size={18} />
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => setEditingId(pin.id)}
                                            style={{
                                                color: 'var(--text-muted)',
                                                background: 'rgba(0, 0, 0, 0.05)',
                                                padding: '0.5rem',
                                                borderRadius: 'var(--radius-sm)',
                                                transition: 'transform 0.2s ease'
                                            }}
                                            title="Edit Row"
                                        >
                                            <FiEdit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => onRegenerate(pin.id)}
                                            disabled={pin.isRegenerating}
                                            style={{
                                                color: 'var(--primary)',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                padding: '0.5rem',
                                                borderRadius: 'var(--radius-sm)',
                                                transition: 'transform 0.2s ease',
                                                opacity: pin.isRegenerating ? 0.5 : 1,
                                                cursor: pin.isRegenerating ? 'not-allowed' : 'pointer'
                                            }}
                                            title="Regenerate Image & Text"
                                        >
                                            <FiRefreshCw size={18} className={pin.isRegenerating ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                )}
                            </td>

                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
