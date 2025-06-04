import { Shift } from "@shared/schema";

export interface ExportOptions {
  format: 'pdf' | 'csv';
  startDate: string;
  endDate: string;
  includeDetails: boolean;
  includeSummary: boolean;
  includeAverages: boolean;
  includeMissing: boolean;
}

export function exportToCSV(shifts: Shift[], options: ExportOptions): void {
  const headers = ['Date', 'Shift Type', 'Start Time', 'End Time', 'Duration (hours)', 'Notes'];
  const rows = shifts.map(shift => {
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);
    
    // Handle overnight shifts
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return [
      shift.date,
      shift.shiftType,
      shift.startTime,
      shift.endTime,
      duration.toFixed(2),
      shift.notes || ''
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `shifts_${options.startDate}_${options.endDate}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(shifts: Shift[], options: ExportOptions): void {
  const dailyHours = calculateDailyHours(shifts);
  
  // Create a simple HTML structure for PDF generation
  const htmlContent = `
    <html>
    <head>
      <title>Shift Report - ${options.startDate} to ${options.endDate}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2563eb; }
        h2 { color: #1e40af; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .daily-totals { margin-top: 30px; }
        .daily-totals table { width: 50%; }
        .daily-totals td:last-child { text-align: right; font-weight: bold; }
        .total-row { background-color: #e0f2fe; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Shift Report</h1>
      <p><strong>Period:</strong> ${options.startDate} to ${options.endDate}</p>
      
      ${options.includeSummary ? `
        <div class="summary">
          <h3>Summary</h3>
          <p><strong>Total Shifts:</strong> ${shifts.length}</p>
          <p><strong>Total Hours:</strong> ${calculateTotalHours(shifts).toFixed(2)}</p>
          <p><strong>Average Daily Hours:</strong> ${dailyHours.length > 0 ? (calculateTotalHours(shifts) / dailyHours.length).toFixed(2) : '0.00'}</p>
        </div>
      ` : ''}
      
      <div class="daily-totals">
        <h2>Daily Hours Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            ${dailyHours.map(day => `
              <tr>
                <td>${new Date(day.date).toLocaleDateString()}</td>
                <td>${day.totalHours.toFixed(2)}h</td>
              </tr>
            `).join('')}
            ${dailyHours.length > 0 ? `
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td><strong>${calculateTotalHours(shifts).toFixed(2)}h</strong></td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
      
      ${options.includeDetails ? `
        <h2>Detailed Shift Log</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift Type</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Duration</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${shifts.map(shift => {
              const start = new Date(`2000-01-01T${shift.startTime}`);
              const end = new Date(`2000-01-01T${shift.endTime}`);
              
              if (end < start) {
                end.setDate(end.getDate() + 1);
              }
              
              const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              
              return `
                <tr>
                  <td>${new Date(shift.date).toLocaleDateString()}</td>
                  <td>${shift.shiftType}</td>
                  <td>${shift.startTime}</td>
                  <td>${shift.endTime}</td>
                  <td>${duration.toFixed(2)}h</td>
                  <td>${shift.notes || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}
    </body>
    </html>
  `;

  // Open print dialog for PDF generation
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}

function calculateTotalHours(shifts: Shift[]): number {
  return shifts.reduce((total, shift) => {
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);
    
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
}

function calculateDailyHours(shifts: Shift[]): { date: string; totalHours: number }[] {
  const dailyTotals = new Map<string, number>();
  
  shifts.forEach(shift => {
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);
    
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const currentTotal = dailyTotals.get(shift.date) || 0;
    dailyTotals.set(shift.date, currentTotal + duration);
  });
  
  return Array.from(dailyTotals.entries())
    .map(([date, totalHours]) => ({ date, totalHours }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
