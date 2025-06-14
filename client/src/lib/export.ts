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

// Helper function to format date as dd/mm/yyyy
function formatDateDDMMYYYY(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function exportToCSV(shifts: Shift[], options: ExportOptions): void {
  // Sort shifts from oldest to newest
  const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
  
  const headers = ['Date', 'Shift Type', 'Start Time', 'End Time', 'Duration (hours)', 'Notes'];
  const rows = sortedShifts.map(shift => {
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);
    
    // Handle overnight shifts
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return [
      formatDateDDMMYYYY(shift.date),
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
  // Sort shifts from oldest to newest
  const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
  const dailyHours = calculateDailyHours(sortedShifts);
  
  // Create a simple HTML structure for PDF generation
  const htmlContent = `
    <html>
    <head>
      <title>Shift Report - ${options.startDate} to ${options.endDate}</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 30px; 
          line-height: 1.6; 
          color: #333;
        }
        h1 { 
          color: #1e40af; 
          font-size: 28px; 
          margin-bottom: 10px;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 10px;
        }
        h2 { 
          color: #1e40af; 
          margin-top: 35px; 
          margin-bottom: 15px;
          font-size: 20px;
        }
        h3 {
          color: #374151;
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 16px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        th, td { 
          border: 1px solid #e5e7eb; 
          padding: 12px 16px; 
          text-align: left; 
        }
        th { 
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        tr:hover {
          background-color: #e0f2fe;
        }
        .summary { 
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          padding: 20px; 
          margin: 25px 0; 
          border-left: 5px solid #2563eb;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .summary-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
        }
        .stat-item {
          text-align: center;
          flex: 1;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
          display: block;
        }
        .stat-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .period-info {
          font-size: 14px;
          color: #6b7280;
          margin-top: 8px;
          font-style: italic;
        }
        .daily-totals table { 
          width: 60%; 
        }
        .daily-totals td:last-child { 
          text-align: right; 
          font-weight: 600; 
        }
        .total-row { 
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          font-weight: bold; 
          font-size: 16px;
        }
        .total-row td {
          border-top: 2px solid #2563eb;
        }
      </style>
    </head>
    <body>
      <h1>Shift Report</h1>
      
      ${options.includeSummary ? `
        <div class="summary">
          <h3>Summary</h3>
          <div class="period-info">
            <strong>Period:</strong> ${formatDateDDMMYYYY(options.startDate)} to ${formatDateDDMMYYYY(options.endDate)}
          </div>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${sortedShifts.length}</span>
              <span class="stat-label">Total Shifts</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${calculateTotalHours(sortedShifts).toFixed(1)}h</span>
              <span class="stat-label">Total Hours</span>
            </div>
          </div>
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
                <td>${formatDateDDMMYYYY(day.date)}</td>
                <td>${day.totalHours.toFixed(2)}h</td>
              </tr>
            `).join('')}
            ${dailyHours.length > 0 ? `
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td><strong>${calculateTotalHours(sortedShifts).toFixed(2)}h</strong></td>
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
            ${sortedShifts.map(shift => {
              const start = new Date(`2000-01-01T${shift.startTime}`);
              const end = new Date(`2000-01-01T${shift.endTime}`);
              
              if (end < start) {
                end.setDate(end.getDate() + 1);
              }
              
              const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              
              return `
                <tr>
                  <td>${formatDateDDMMYYYY(shift.date)}</td>
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
