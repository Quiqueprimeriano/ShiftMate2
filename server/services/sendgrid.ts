import { MailService } from '@sendgrid/mail';

const mailService = new MailService();

// Guard SendGrid initialization - only set API key if it exists and is valid
if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.')) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else if (process.env.NODE_ENV === 'development') {
  console.warn('SendGrid API key not configured or invalid. Email functionality will be disabled in development.');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || "",
      html: params.html || "",
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

interface RosterShift {
  id: number;
  employeeId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  location?: string;
  employeeName: string;
  employeeEmail: string;
}

export async function sendRosterEmail(
  employeeEmail: string,
  employeeName: string,
  shifts: RosterShift[],
  weekStart: string,
  weekEnd: string,
  companyName: string = "ShiftMate"
): Promise<boolean> {
  const subject = `Your Roster Schedule - Week of ${new Date(weekStart).toLocaleDateString()}`;
  
  // Generate HTML email content
  const html = generateRosterEmailHTML(employeeName, shifts, weekStart, weekEnd, companyName);
  const text = generateRosterEmailText(employeeName, shifts, weekStart, weekEnd, companyName);

  return await sendEmail({
    to: employeeEmail,
    from: 'noreply@shiftmate.app', // You should use a verified domain
    subject,
    text,
    html
  });
}

function generateRosterEmailHTML(
  employeeName: string,
  shifts: RosterShift[],
  weekStart: string,
  weekEnd: string,
  companyName: string
): string {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .shifts-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .shifts-table th, .shifts-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .shifts-table th { background-color: #f8f9fa; font-weight: bold; }
        .shift-type { padding: 4px 8px; border-radius: 4px; font-size: 0.875rem; font-weight: 500; }
        .morning { background-color: #fef3c7; color: #92400e; }
        .afternoon { background-color: #dbeafe; color: #1e40af; }
        .evening { background-color: #fde68a; color: #92400e; }
        .night { background-color: #e0e7ff; color: #3730a3; }
        .double { background-color: #f3e8ff; color: #6b21a8; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.875rem; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🗓️ Your Weekly Roster</h1>
        <p>${companyName}</p>
      </div>
      
      <div class="content">
        <h2>Hello ${employeeName}!</h2>
        <p>Here's your roster schedule for the week of <strong>${startDate.toLocaleDateString()}</strong> to <strong>${endDate.toLocaleDateString()}</strong>.</p>
        
        ${shifts.length > 0 ? `
          <table class="shifts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Type</th>
                <th>Location</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${shifts.map(shift => `
                <tr>
                  <td>${new Date(shift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</td>
                  <td>${formatTime(shift.startTime)}</td>
                  <td>${formatTime(shift.endTime)}</td>
                  <td><span class="shift-type ${shift.type.toLowerCase()}">${shift.type}</span></td>
                  <td>${shift.location || '-'}</td>
                  <td>${calculateDuration(shift.startTime, shift.endTime)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p><strong>Total Hours:</strong> ${calculateTotalHours(shifts)} hours</p>
        ` : `
          <p>You have no shifts scheduled for this week.</p>
        `}
        
        <div class="footer">
          <p>If you have any questions about your roster, please contact your manager.</p>
          <p><em>This is an automated message from ${companyName} roster management system.</em></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRosterEmailText(
  employeeName: string,
  shifts: RosterShift[],
  weekStart: string,
  weekEnd: string,
  companyName: string
): string {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  
  let text = `Your Weekly Roster - ${companyName}\n\n`;
  text += `Hello ${employeeName}!\n\n`;
  text += `Here's your roster schedule for the week of ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.\n\n`;
  
  if (shifts.length > 0) {
    text += `SCHEDULED SHIFTS:\n`;
    text += `${'='.repeat(60)}\n`;
    
    shifts.forEach(shift => {
      const date = new Date(shift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const duration = calculateDuration(shift.startTime, shift.endTime);
      text += `${date}\n`;
      text += `  Time: ${formatTime(shift.startTime)} - ${formatTime(shift.endTime)} (${duration})\n`;
      text += `  Type: ${shift.type}\n`;
      if (shift.location) text += `  Location: ${shift.location}\n`;
      text += `\n`;
    });
    
    text += `Total Hours: ${calculateTotalHours(shifts)} hours\n\n`;
  } else {
    text += `You have no shifts scheduled for this week.\n\n`;
  }
  
  text += `If you have any questions about your roster, please contact your manager.\n\n`;
  text += `This is an automated message from ${companyName} roster management system.`;
  
  return text;
}

function formatTime(time: string): string {
  // Convert 24-hour format to 12-hour format
  const [hours, minutes] = time.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
}

function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  let diffMs = end.getTime() - start.getTime();
  
  // Handle overnight shifts
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

function calculateTotalHours(shifts: RosterShift[]): string {
  let totalMinutes = 0;
  
  shifts.forEach(shift => {
    const start = new Date(`2000-01-01T${shift.startTime}:00`);
    const end = new Date(`2000-01-01T${shift.endTime}:00`);
    let diffMs = end.getTime() - start.getTime();
    
    // Handle overnight shifts
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    totalMinutes += diffMs / (1000 * 60);
  });
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  
  if (minutes === 0) {
    return `${hours}`;
  } else {
    return `${hours}.${Math.round((minutes / 60) * 10)}`;
  }
}