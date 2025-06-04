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
  // Create a simple HTML structure for PDF generation
  const htmlContent = `
    <html>
    <head>
      <title>Shift Report - ${options.startDate} to ${options.endDate}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb; }
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
        </div>
      ` : ''}
      
      ${options.includeDetails ? `
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
                  <td>${shift.date}</td>
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
