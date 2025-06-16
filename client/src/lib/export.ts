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
  
  // Create OnePager HTML structure for PDF generation
  const htmlContent = `
    <html>
    <head>
      <title>Shift Report - ${options.startDate} to ${options.endDate}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          line-height: 1.5; 
          color: #333;
          font-size: 14px;
        }
        .onepager-container {
          max-width: 100%;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #1e40af, #2563eb);
          color: white;
          padding: 20px 30px;
          border-radius: 10px;
          margin-bottom: 25px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: bold;
        }
        .period-subtitle {
          margin: 8px 0 0 0;
          font-size: 18px;
          opacity: 0.9;
        }
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 25px;
        }
        .summary-card {
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 12px;
        }
        .summary-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 8px;
        }
        .stat-box {
          text-align: center;
          background: white;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }
        .stat-value {
          font-size: 16px;
          font-weight: bold;
          color: #1e40af;
          display: block;
        }
        .stat-label {
          font-size: 9px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 15px;
          text-align: center;
        }
        .daily-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .daily-table th {
          background: linear-gradient(135deg, #1e40af, #2563eb);
          color: white;
          border: none;
          padding: 12px 16px;
          font-weight: 600;
          font-size: 16px;
          text-transform: uppercase;
        }
        .daily-table td {
          border: 1px solid #e2e8f0;
          padding: 10px 16px;
          font-size: 14px;
        }
        .daily-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .shifts-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .shifts-table th {
          background: linear-gradient(135deg, #1e40af, #2563eb);
          color: white;
          border: none;
          padding: 12px 10px;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
        }
        .shifts-table td {
          border: 1px solid #e2e8f0;
          padding: 8px 10px;
          font-size: 12px;
        }
        .shifts-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .shift-type {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        .morning { background: #d1fae5; color: #065f46; }
        .evening { background: #fef3c7; color: #92400e; }
        .night { background: #e0e7ff; color: #3730a3; }
        .double { background: #fecaca; color: #991b1b; }
        .custom { background: #e9d5ff; color: #6b21a8; }
        .daily-summary {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
        }
        .total-highlight {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          font-weight: bold;
          font-size: 16px;
        }
        .total-highlight td {
          font-size: 16px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="onepager-container">
        <div class="header">
          <h1>Shift Report</h1>
          <div class="period-subtitle">
            ${formatDateDDMMYYYY(options.startDate)} to ${formatDateDDMMYYYY(options.endDate)}
          </div>
        </div>
        
        <div class="content-grid">
          <!-- Daily Summary Section -->
          <div class="daily-summary">
            <div class="section-title">Daily Hours</div>
            <table class="daily-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                ${dailyHours.map(day => `
                  <tr>
                    <td>${formatDateDDMMYYYY(day.date)}</td>
                    <td>${day.totalHours.toFixed(2)}h</td>
                  </tr>
                `).join('')}
                <tr class="total-highlight">
                  <td><strong>TOTAL</strong></td>
                  <td><strong>${calculateTotalHours(sortedShifts).toFixed(2)}h</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Detailed Shifts Section -->
          <div class="shifts-section">
            <div class="section-title">Detailed Shift Log</div>
            <table class="shifts-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
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
                      <td><span class="shift-type ${shift.shiftType}">${shift.shiftType}</span></td>
                      <td>${shift.startTime}</td>
                      <td>${shift.endTime}</td>
                      <td><strong>${duration.toFixed(2)}h</strong></td>
                      <td>${shift.notes ? shift.notes.substring(0, 25) + (shift.notes.length > 25 ? '...' : '') : '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
