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

// Format date range helper function  
function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`;
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
  link.setAttribute('download', 'Shift Report.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateShiftTableRows(shifts: Shift[]): string {
  // Group shifts by date
  const shiftsByDate: { [key: string]: Shift[] } = {};
  shifts.forEach(shift => {
    if (!shiftsByDate[shift.date]) {
      shiftsByDate[shift.date] = [];
    }
    shiftsByDate[shift.date].push(shift);
  });
  
  let tableRows = '';
  
  // Process each date
  Object.keys(shiftsByDate).sort().forEach(date => {
    const dayShifts = shiftsByDate[date];
    
    // Sort shifts by type (morning first) then by start time
    const typeOrder: { [key: string]: number } = { 'morning': 1, 'evening': 2, 'night': 3, 'double': 4, 'custom': 5 };
    dayShifts.sort((a, b) => {
      const typeA = typeOrder[a.shiftType] || 6;
      const typeB = typeOrder[b.shiftType] || 6;
      if (typeA !== typeB) return typeA - typeB;
      return a.startTime.localeCompare(b.startTime);
    });
    
    // Calculate daily total
    let dailyTotal = 0;
    dayShifts.forEach(shift => {
      const start = new Date('2000-01-01T' + shift.startTime);
      const end = new Date('2000-01-01T' + shift.endTime);
      if (end < start) end.setDate(end.getDate() + 1);
      dailyTotal += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    });
    
    // Get day name
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    
    // Add daily total row
    tableRows += `<tr class="daily-total-row">
        <td><strong>${dayName}</strong></td>
        <td><strong>${formatDateDDMMYYYY(date)}</strong></td>
        <td><strong>DAILY TOTAL</strong></td>
        <td>-</td>
        <td>-</td>
        <td><strong>${dailyTotal.toFixed(2)}h</strong></td>
        <td>-</td>
      </tr>`;
    
    // Add individual shifts
    dayShifts.forEach(shift => {
      const start = new Date('2000-01-01T' + shift.startTime);
      const end = new Date('2000-01-01T' + shift.endTime);
      if (end < start) end.setDate(end.getDate() + 1);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      tableRows += `<tr>
          <td>${dayName}</td>
          <td>${formatDateDDMMYYYY(date)}</td>
          <td><span class="shift-type ${shift.shiftType}">${shift.shiftType}</span></td>
          <td>${shift.startTime}</td>
          <td>${shift.endTime}</td>
          <td>${duration.toFixed(2)}h</td>
          <td>${shift.notes ? shift.notes.substring(0, 20) + (shift.notes.length > 20 ? '...' : '') : '-'}</td>
        </tr>`;
    });
  });
  
  // Add grand total
  tableRows += `<tr class="total-highlight">
      <td colspan="5"><strong>GRAND TOTAL</strong></td>
      <td><strong>${calculateTotalHours(shifts).toFixed(2)}h</strong></td>
      <td><strong>${shifts.length} shifts</strong></td>
    </tr>`;
  
  return tableRows;
}

export function exportToPDF(shifts: Shift[], options: ExportOptions): void {
  const totalHours = calculateTotalHours(shifts);
  
  // Sort shifts chronologically by date and time
  const sortedShifts = [...shifts].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.startTime.localeCompare(b.startTime);
  });

  // Group shifts by date and calculate daily totals
  const shiftsByDate = new Map<string, Shift[]>();
  sortedShifts.forEach(shift => {
    if (!shiftsByDate.has(shift.date)) {
      shiftsByDate.set(shift.date, []);
    }
    shiftsByDate.get(shift.date)!.push(shift);
  });

  let tableRows = '';
  
  // Generate rows for each day
  shiftsByDate.forEach((dayShifts, date) => {
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    let dailyTotal = 0;
    
    // Add shifts for this day
    dayShifts.forEach(shift => {
      const start = new Date('2000-01-01T' + shift.startTime);
      const end = new Date('2000-01-01T' + shift.endTime);
      if (end < start) end.setDate(end.getDate() + 1);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      dailyTotal += duration;
      
      tableRows += `<tr>
          <td>${dayName}</td>
          <td>${formatDateDDMMYYYY(date)}</td>
          <td>${shift.shiftType}</td>
          <td>${shift.startTime}</td>
          <td>${shift.endTime}</td>
          <td>${duration.toFixed(2)}h</td>
          <td>${shift.notes || '-'}</td>
        </tr>`;
    });
    
    // Add daily total row
    tableRows += `<tr class="daily-total">
        <td colspan="5"><strong>Daily Total</strong></td>
        <td><strong>${dailyTotal.toFixed(2)}h</strong></td>
        <td>-</td>
      </tr>`;
  });
  
  // Add period total
  tableRows += `<tr class="period-total">
      <td colspan="5"><strong>Period Total</strong></td>
      <td><strong>${totalHours.toFixed(2)}h</strong></td>
      <td>-</td>
    </tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Shift Report</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { 
          font-family: Arial, sans-serif; 
          font-size: 11px; 
          line-height: 1.3; 
          color: #333; 
          margin: 0; 
          padding: 0; 
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #ddd;
        }
        .header h1 {
          font-size: 18px;
          margin: 0 0 5px 0;
          color: #333;
        }
        .header p {
          font-size: 12px;
          color: #666;
          margin: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th {
          background: #f5f5f5;
          border: 1px solid #ddd;
          padding: 8px 6px;
          font-weight: 600;
          text-align: center;
        }
        td {
          border: 1px solid #ddd;
          padding: 6px;
          text-align: center;
        }
        .daily-total {
          background: #2563eb;
          color: white;
          font-weight: bold;
        }
        .period-total {
          background: #1e40af;
          color: white;
          font-weight: bold;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Shift Report</h1>
        <p>${formatDateRange(options.startDate, options.endDate)}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Date</th>
            <th>Type</th>
            <th>Start</th>
            <th>End</th>
            <th>Duration</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Open print dialog for PDF generation
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.document.title = 'Shift Report';
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
