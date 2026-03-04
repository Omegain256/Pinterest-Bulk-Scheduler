// utils/csvExport.js

/**
 * Formats an array of pin objects into a Pinterest-compatible CSV string and triggers a download.
 * @param {Array} pins - Array of objects containing pin data.
 */
export function exportToPinterestCSV(pins) {
    if (!pins || pins.length === 0) return;

    // Pinterest required columns for Bulk Upload
    const headers = [
        'Title',
        'Media URL',
        'Pinterest board',
        'Thumbnail',
        'Description',
        'Link',
        'Publish date',
        'Keywords'
    ];

    // Format the data rows
    const rows = pins.map(pin => {
        // Helper to escape strings containing commas or quotes for CSV safety
        const escapeCSV = (str, maxLength) => {
            if (!str) return '""';
            let stringified = String(str);
            if (maxLength) {
                stringified = stringified.substring(0, maxLength);
            }
            if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
                return `"${stringified.replace(/"/g, '""')}"`;
            }
            return stringified;
        };

        // Format the date strictly in EST (America/New_York) for Pinterest (YYYY-MM-DDTHH:MM:SS)
        const dateObj = new Date(pin.publishDate);
        const estFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hourCycle: 'h23'
        });
        const [dateStr, timeStr] = estFormatter.format(dateObj).split(', ');
        const [month, day, year] = dateStr.split('/');
        const formattedDate = `${year}-${month}-${day}T${timeStr}`;

        return [
            escapeCSV(pin.title, 100),
            escapeCSV(pin.imageUrl),
            escapeCSV(pin.boardName),
            '""', // Thumbnail blank for images
            escapeCSV(pin.description, 500),
            escapeCSV(pin.sourceUrl),
            escapeCSV(formattedDate),
            escapeCSV(pin.keywords || '')
        ].join(',');
    });

    // Combine Headers and Rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Add UTF-8 BOM
    const bom = '\uFEFF';
    const finalCsvData = bom + csvContent;

    // Use Base64 URI encoding to bypass Blob construction issues
    const base64Data = btoa(unescape(encodeURIComponent(finalCsvData)));
    const encodedUri = 'data:text/csv;charset=utf-8;base64,' + base64Data;

    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pinterest-bulk-upload-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
