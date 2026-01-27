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

// Employee Invitation Email
export async function sendInvitationEmail(
  email: string,
  companyName: string,
  inviterName: string,
  token: string,
  baseUrl: string = process.env.APP_URL || 'http://localhost:3000'
): Promise<boolean> {
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const subject = `You've been invited to join ${companyName} on ShiftMate`;

  const html = generateInvitationEmailHTML(email, companyName, inviterName, inviteUrl);
  const text = generateInvitationEmailText(email, companyName, inviterName, inviteUrl);

  return await sendEmail({
    to: email,
    from: 'noreply@shiftmate.app',
    subject,
    text,
    html
  });
}

function generateInvitationEmailHTML(
  email: string,
  companyName: string,
  inviterName: string,
  inviteUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #3b82f6; color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .invite-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .company-name { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 10px; }
        .cta-button { display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .cta-button:hover { background-color: #2563eb; }
        .footer { padding: 20px; background-color: #f8fafc; text-align: center; font-size: 14px; color: #64748b; }
        .link-fallback { font-size: 12px; color: #64748b; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 You're Invited!</h1>
        </div>

        <div class="content">
          <p>Hi there!</p>

          <p><strong>${inviterName}</strong> has invited you to join their team on ShiftMate.</p>

          <div class="invite-box">
            <div class="company-name">${companyName}</div>
            <p>Join the team and start managing your shifts easily.</p>
            <a href="${inviteUrl}" class="cta-button">Accept Invitation</a>
          </div>

          <p>With ShiftMate, you'll be able to:</p>
          <ul>
            <li>View your assigned shifts and roster</li>
            <li>Track your work hours</li>
            <li>See your earnings in real-time</li>
            <li>Receive notifications about schedule changes</li>
          </ul>

          <p style="color: #64748b; font-size: 14px;">This invitation will expire in 7 days.</p>

          <p class="link-fallback">
            If the button doesn't work, copy and paste this link into your browser:<br>
            ${inviteUrl}
          </p>
        </div>

        <div class="footer">
          <p>This email was sent to ${email} because someone invited you to ShiftMate.</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateInvitationEmailText(
  email: string,
  companyName: string,
  inviterName: string,
  inviteUrl: string
): string {
  return `
You're Invited to Join ${companyName} on ShiftMate!

Hi there!

${inviterName} has invited you to join their team on ShiftMate.

Click the link below to accept the invitation:
${inviteUrl}

With ShiftMate, you'll be able to:
- View your assigned shifts and roster
- Track your work hours
- See your earnings in real-time
- Receive notifications about schedule changes

This invitation will expire in 7 days.

---
This email was sent to ${email} because someone invited you to ShiftMate.
If you didn't expect this invitation, you can safely ignore this email.
  `.trim();
}