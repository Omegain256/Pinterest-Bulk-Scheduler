"use client";

import { useState } from 'react';
import { FiKey, FiSave, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';

const FIELDS = [
    {
        id: 'apiKey',
        storageKey: 'pinterest_tool_api_key',
        label: 'Tool Access Key',
        placeholder: 'pbs-secret-2026',
        hint: 'The master password that locks the tool. Set this in your Vercel env as APP_API_KEY.',
    },
    {
        id: 'geminiKey',
        storageKey: 'pinterest_tool_gemini_key',
        label: 'Google Gemini API Key',
        placeholder: 'AIza...',
        hint: 'Free key from aistudio.google.com — used for AI title & description generation.',
    },
    {
        id: 'imgbbKey',
        storageKey: 'pinterest_tool_imgbb_key',
        label: 'ImgBB API Key',
        placeholder: 'Optional — uses server default if blank',
        hint: 'Optional. Needed only if you want to host composited template images under your own account.',
        optional: true,
    },
    {
        id: 'nvidiaKey',
        storageKey: 'pinterest_tool_nvidia_key',
        label: 'NVIDIA API Key (Minimax)',
        placeholder: 'nvapi-...',
        hint: 'Used specifically for the Scrape URL generation feature.',
        optional: true,
    },
    {
        id: 'wpUrl',
        storageKey: 'pinterest_tool_wp_url',
        label: 'WordPress Site URL',
        placeholder: 'https://yourwebsite.com',
        hint: 'Used for automation. For Vercel Cron, you MUST also set WP_URL in Vercel.',
        optional: true,
    },
    {
        id: 'wpUser',
        storageKey: 'pinterest_tool_wp_user',
        label: 'WordPress Username',
        placeholder: 'admin',
        hint: 'For Vercel Cron, set WP_USER in Vercel.',
        optional: true,
    },
    {
        id: 'wpAppPass',
        storageKey: 'pinterest_tool_wp_apppass',
        label: 'WP Application Password',
        placeholder: 'xxxx xxxx xxxx xxxx',
        hint: 'For Vercel Cron, set WP_APP_PASS in Vercel. Generate in WP Profile.',
        optional: true,
    },
    {
        id: 'dailyPinLimit',
        storageKey: 'pinterest_tool_daily_pin_limit',
        label: 'Daily Pin Limit',
        placeholder: '5',
        hint: 'For Vercel Cron, set DAILY_PIN_LIMIT in Vercel.',
        optional: true,
    },
];


export default function SettingsPanel({ onSave }) {
    const getInitial = (field) => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(field.storageKey) || '';
    };

    const [values, setValues] = useState(() =>
        Object.fromEntries(FIELDS.map(f => [f.id, getInitial(f)]))
    );
    const [visible, setVisible] = useState({});
    const [saved, setSaved] = useState(false);

    const handleChange = (id, value) => {
        setValues(prev => ({ ...prev, [id]: value }));
        setSaved(false);
    };

    const handleSave = () => {
        // Persist to localStorage
        FIELDS.forEach(f => {
            if (values[f.id].trim()) {
                localStorage.setItem(f.storageKey, values[f.id].trim());
            } else {
                localStorage.removeItem(f.storageKey);
            }
        });
        // Notify parent so generate calls use fresh keys immediately
        onSave({
            apiKey: values.apiKey.trim(),
            geminiKey: values.geminiKey.trim(),
            imgbbKey: values.imgbbKey.trim(),
            nvidiaKey: values.nvidiaKey.trim(),
            wpUrl: values.wpUrl.trim(),
            wpUser: values.wpUser.trim(),
            wpAppPass: values.wpAppPass.trim(),
            dailyPinLimit: values.dailyPinLimit.trim(),
        });

        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const toggleVisible = (id) =>
        setVisible(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div style={{
                    width: '26px', height: '26px', background: 'rgba(108,56,255,0.1)',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <FiKey size={13} color="var(--primary)" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--foreground)' }}>
                    API Keys
                </span>
            </div>

            {/* Fields */}
            {FIELDS.map(field => (
                <div key={field.id}>
                    <label className="sidebar-label">
                        {field.label}
                        {field.optional && (
                            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '0.3rem', color: 'var(--text-muted)', fontSize: '0.67rem' }}>
                                (optional)
                            </span>
                        )}
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            id={`settings-${field.id}`}
                            type={visible[field.id] ? 'text' : 'password'}
                            className="glass-input"
                            style={{ width: '100%', paddingRight: '2.25rem', fontSize: '0.82rem' }}
                            placeholder={field.placeholder}
                            value={values[field.id]}
                            onChange={e => handleChange(field.id, e.target.value)}
                            autoComplete="off"
                        />
                        <button
                            onClick={() => toggleVisible(field.id)}
                            style={{
                                position: 'absolute', right: '0.6rem',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                                padding: '0.2rem',
                            }}
                            tabIndex={-1}
                            aria-label={visible[field.id] ? 'Hide' : 'Show'}
                        >
                            {visible[field.id] ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                        </button>
                    </div>
                    <p style={{
                        marginTop: '0.3rem', fontSize: '0.68rem',
                        color: 'var(--text-muted)', lineHeight: 1.4
                    }}>
                        {field.hint}
                    </p>
                </div>
            ))}

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--surface-border)' }} />

            {/* Save Button */}
            <button
                id="settings-save-btn"
                onClick={handleSave}
                className="btn btn-primary"
                style={{
                    width: '100%', borderRadius: '100px',
                    background: saved ? 'var(--success, #22c55e)' : undefined,
                    transition: 'background 0.3s ease',
                }}
            >
                {saved
                    ? <><FiCheck size={14} /> Saved!</>
                    : <><FiSave size={14} /> Save Settings</>
                }
            </button>

            {/* Info box */}
            <div style={{
                background: 'rgba(108,56,255,0.05)',
                border: '1px solid rgba(108,56,255,0.12)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                lineHeight: 1.55,
            }}>
                <strong style={{ color: 'var(--foreground)' }}>🔒 Privacy note:</strong> Keys are saved
                only in your browser's localStorage — they never leave your device and are only sent
                directly to the respective API providers.
            </div>
        </div>
    );
}
