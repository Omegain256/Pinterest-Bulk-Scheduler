"use client";

import { useState } from 'react';
import { FiCalendar, FiClock, FiShuffle } from 'react-icons/fi';

export default function SchedulingTools({ pins, onApplySchedule }) {
    const [startDate, setStartDate] = useState('');
    const [scheduleMode, setScheduleMode] = useState('interval'); // 'interval' | 'random'
    const [intervalDays, setIntervalDays] = useState(1);

    const handleApply = () => {
        if (!startDate || pins.length === 0) return;

        const baseDate = new Date(startDate);
        const now = new Date();

        if (scheduleMode === 'interval' && baseDate <= now) {
            alert("Please select a date and time in the future.");
            return;
        }

        const baseStart = new Date(startDate);

        const updatedPins = pins.map((pin, index) => {
            const scheduledDate = new Date(baseStart.getTime());

            if (scheduleMode === 'interval') {
                scheduledDate.setDate(scheduledDate.getDate() + (index * intervalDays));
            } else if (scheduleMode === 'random') {
                // Random time between 8 AM and 10 PM (8 to 22)
                const randomHour = Math.floor(Math.random() * (22 - 8)) + 8;
                const randomMinute = Math.floor(Math.random() * 60);
                scheduledDate.setHours(randomHour, randomMinute, 0);
            }

            return {
                ...pin,
                publishDate: scheduledDate.toISOString()
            };
        });

        onApplySchedule(updatedPins);
    };

    if (!pins || pins.length === 0) return null;

    return (
        <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-glass)' }}>
            <h3 className="flex items-center gap-2" style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--foreground)', fontWeight: '600' }}>
                <FiCalendar /> Auto-Schedule Batch
            </h3>

            <div className="flex-col gap-4">
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        Scheduling Mode
                    </label>
                    <div className="flex gap-2">
                        <button
                            className="btn"
                            style={{
                                flex: 1,
                                fontSize: '0.875rem',
                                padding: '0.5rem',
                                background: scheduleMode === 'interval' ? 'var(--foreground)' : 'var(--input-bg)',
                                color: scheduleMode === 'interval' ? 'var(--background)' : 'var(--text-muted)',
                                border: '1px solid var(--surface-border)'
                            }}
                            onClick={() => setScheduleMode('interval')}
                        >
                            <FiClock /> Daily
                        </button>
                        <button
                            className="btn"
                            style={{
                                flex: 1,
                                fontSize: '0.875rem',
                                padding: '0.5rem',
                                background: scheduleMode === 'random' ? 'var(--foreground)' : 'var(--input-bg)',
                                color: scheduleMode === 'random' ? 'var(--background)' : 'var(--text-muted)',
                                border: '1px solid var(--surface-border)'
                            }}
                            onClick={() => setScheduleMode('random')}
                        >
                            <FiShuffle /> Random
                        </button>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {scheduleMode === 'interval' ? 'Start Date & Time' : 'Target Date'}
                    </label>
                    <input
                        type={scheduleMode === 'interval' ? 'datetime-local' : 'date'}
                        className="glass-input"
                        style={{ width: '100%', fontSize: '0.875rem' }}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>

                {scheduleMode === 'interval' && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Interval Between Pins (Days)
                        </label>
                        <input
                            type="number"
                            min="0"
                            className="glass-input"
                            style={{ width: '100%', fontSize: '0.875rem' }}
                            value={intervalDays}
                            onChange={(e) => setIntervalDays(parseInt(e.target.value))}
                        />
                    </div>
                )}

                {scheduleMode === 'random' && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pins will be randomly staggered between 8am and 10pm on the selected target date.</p>
                )}

                <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    onClick={handleApply}
                    disabled={!startDate}
                >
                    Apply to {pins.length} Pins
                </button>
            </div>
        </div>
    );
}
