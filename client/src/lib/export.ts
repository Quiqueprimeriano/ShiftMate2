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
          line-height: 1.4; 
          color: #333;
          font-size: 12px;
        }
        .onepager-container {
          max-width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .header {
          background: linear-gradient(135deg, #1e40af, #2563eb);
          color: white;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 15px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: bold;
        }
        .period-subtitle {
          margin: 5px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 15px;
          flex: 1;
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
          font-size: 14px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 10px;
        }
        .compact-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .compact-table th {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 6px 8px;
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
        }
        .compact-table td {
          border: 1px solid #e2e8f0;
          padding: 4px 8px;
        }
        .compact-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .shifts-grid {
          grid-column: 1 / -1;
          margin-top: 10px;
        }
        .shifts-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }
        .shifts-table th {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: 1px solid #2563eb;
          padding: 6px 8px;
          font-weight: 600;
          font-size: 8px;
          text-transform: uppercase;
        }
        .shifts-table td {
          border: 1px solid #e5e7eb;
          padding: 4px 8px;
        }
        .shifts-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .shift-type {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8px;
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
          padding: 12px;
          max-height: 400px;
          overflow-y: auto;
        }
        .total-highlight {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
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
          <!-- Summary Section -->
          <div class="summary-card">
            <div class="section-title">Summary</div>
            <div class="summary-stats">
              <div class="stat-box">
                <span class="stat-value">${sortedShifts.length}</span>
                <span class="stat-label">Total Shifts</span>
              </div>
              <div class="stat-box">
                <span class="stat-value">${calculateTotalHours(sortedShifts).toFixed(1)}h</span>
                <span class="stat-label">Total Hours</span>
              </div>
            </div>
          </div>
          
          <!-- Daily Summary Section -->
          <div class="daily-summary">
            <div class="section-title">Daily Hours (${dailyHours.length} days)</div>
            <table class="compact-table">
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
                    <td>${day.totalHours.toFixed(1)}h</td>
                  </tr>
                `).join('')}
                <tr class="total-highlight">
                  <td><strong>TOTAL</strong></td>
                  <td><strong>${calculateTotalHours(sortedShifts).toFixed(1)}h</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Detailed Shifts Section -->
          <div class="shifts-grid">
            <div class="section-title">Detailed Shift Log (${sortedShifts.length} shifts)</div>
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
                      <td>${duration.toFixed(1)}h</td>
                      <td>${shift.notes ? shift.notes.substring(0, 20) + (shift.notes.length > 20 ? '...' : '') : '-'}</td>
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
