/**
 * Format date to readable format
 * @param {string|Date} date - Date string or Date object
 * @param {string} format - Format type: 'short', 'long', 'date-only'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
    if (!date) return '—';
    
    try {
        const d = new Date(date);
        
        // Check if date is valid
        if (isNaN(d.getTime())) return '—';
        
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const year = d.getFullYear();
        
        switch (format) {
            case 'date-only':
                // Format: 10/18/2005
                return `${month}/${day}/${year}`;
            
            case 'long':
                // Format: 10/18/2005 12:00 PM
                const hours = d.getHours();
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                return `${month}/${day}/${year} ${displayHours}:${minutes} ${ampm}`;
            
            case 'short':
            default:
                // Format: 10/18/2005
                return `${month}/${day}/${year}`;
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return '—';
    }
}

/**
 * Format datetime to readable format
 * @param {string|Date} datetime - Datetime string or Date object
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(datetime) {
    if (!datetime) return '—';
    
    try {
        const d = new Date(datetime);
        
        if (isNaN(d.getTime())) return '—';
        
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        
        return `${month}/${day}/${year} ${displayHours}:${minutes} ${ampm}`;
    } catch (error) {
        console.error('Error formatting datetime:', error);
        return '—';
    }
}

/**
 * Format date for input field (YYYY-MM-DD)
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date string for input
 */
export function formatDateForInput(date) {
    if (!date) return '';
    
    try {
        const d = new Date(date);
        
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date for input:', error);
        return '';
    }
}
