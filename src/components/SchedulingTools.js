"use client";

import { useState } from 'react';
import { FiCalendar, FiClock, FiShuffle } from 'react-icons/fi';

export default function SchedulingTools({ pins, onApplySchedule }) {
    const [startDate, setStartDate] = useState('');
    const [scheduleMode, setScheduleMode] = useState('interval'); // 'interval' | 'spread'
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
            } else if (scheduleMode === 'spread') {
                const startHour = 8;
                const endHour = 22;
                const totalMinutes = (endHour - startHour) * 60;
                
                // Evenly space them out across the 14 hour window
                const spacingMinutes = pins.length > 1 ? Math.floor(totalMinutes / pins.length) : 0;
                
                // Add jitter of +/- 7 minutes to make it look organic
                let offsetMinutes = (startHour * 60) + (index * spacingMinutes);
                offsetMinutes += Math.floor(Math.random() * 15) - 7;
                
                const hour = Math.floor(offsetMinutes / 60);
                const minute = offsetMinutes % 60;
                
                scheduledDate.setHours(hour, minute, 0);
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
                                background: scheduleMode === 'spread' ? 'var(--foreground)' : 'var(--input-bg)',
                                color: scheduleMode === 'spread' ? 'var(--background)' : 'var(--text-muted)',
                                border: '1px solid var(--surface-border)'
                            }}
                            onClick={() => setScheduleMode('spread')}
                        >
                            <FiShuffle /> Spread Daily
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

                {scheduleMode === 'spread' && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pins will be evenly spread out between 8am and 10pm on the target date.</p>
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
