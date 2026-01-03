/**
 * Utility functions for CSV export functionality
 */

/**
 * Converts an array of objects to CSV format
 * @param data Array of objects to convert
 * @param headers Array of header names
 * @param keys Array of object keys corresponding to headers
 * @returns CSV string
 */
export function convertToCSV<T>(
  data: T[],
  headers: string[],
  keys: (keyof T)[]
): string {
  // Create header row
  const headerRow = headers.join(',');

  // Create data rows
  const dataRows = data.map((item) => {
    return keys
      .map((key) => {
        const value = item[key];
        // Handle values that might contain commas or quotes
        const stringValue = String(value ?? '');
        // Wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Downloads a CSV file with the given content
 * @param csvContent The CSV content string
 * @param filename The name of the file to download
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create a Blob from the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a temporary download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Formats current date as YYYY-MM-DD
 * @returns Formatted date string
 */
export function getFormattedDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
