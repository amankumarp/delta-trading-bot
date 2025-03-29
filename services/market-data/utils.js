/**
 * Convert a timestamp to a human-readable date.
 * @param {number} timestamp - The timestamp in milliseconds.
 * @returns {string} - The formatted date string.
 */
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString(undefined, {timeZone: 'Asia/Kolkata'});
}

/**
 * 
 * Helper function to convert interval to seconds.
 * @param {string} interval - The interval (e.g., '1m', '5m', '1h').
 * @returns {number} - The interval in seconds.
 */
function parseIntervalToSeconds(interval) {
    const unit = interval.slice(-1); // Get the last character (e.g., 'm', 'h', 'd')
    const value = parseInt(interval.slice(0, -1), 10); // Get the numeric part

    switch (unit) {
        case 'm': return value * 60; // Minutes to seconds
        case 'h': return value * 60 * 60; // Hours to seconds
        case 'd': return value * 24 * 60 * 60; // Days to seconds
        default: throw new Error(`Invalid interval: ${interval}`);
    }
}


module.exports = { formatTimestamp , parseIntervalToSeconds};