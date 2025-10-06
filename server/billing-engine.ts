import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { rateTiers, publicHolidays, employeeRates } from "@shared/schema";
import { eq, and, or, gte, lte, isNull } from "drizzle-orm";

// Use same database connection as storage.ts
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const match = connectionString.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
if (!match) {
  throw new Error('Invalid DATABASE_URL format');
}

const [, username, password, host, port, database] = match;

const pool = new Pool({
  user: username,
  password: password,
  host: host,
  port: parseInt(port),
  database: database,
  ssl: {
    rejectUnauthorized: false
  }
});

const db = drizzle(pool);

export interface BillingTier {
  tier: number;
  rate: number; // rate per hour in cents
  hours: number;
  subtotal: number; // in cents
}

export interface ShiftBilling {
  shift_id: string | number;
  total_hours: number;
  total_amount: number; // in cents
  date: string;
  day_type: string;
  shift_type: string;
  start_time?: string;
  end_time?: string;
  billing: BillingTier[];
}

/**
 * Determine the base rate type for employee billing purposes
 * Supports: weekday, saturday, sunday, publicHoliday
 * Note: weeknight is handled separately via split billing
 */
export function getEmployeeRateType(date: string, holidays: string[]): string {
  const shiftDate = new Date(date);
  const dayOfWeek = shiftDate.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's a holiday first
  if (holidays.includes(date)) {
    return "publicHoliday";
  }
  
  // Check day of week
  if (dayOfWeek === 0) {
    return "sunday";
  } else if (dayOfWeek === 6) {
    return "saturday";
  } else {
    // Weekdays (Monday-Friday)
    return "weekday";
  }
}

/**
 * Calculate weeknight hours for a weekday shift
 * Returns hours (max 2) that fall between 21:00-23:59 on Monday-Friday
 */
export function calculateWeeknightHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  
  // Handle cross-day shifts
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  
  // Weeknight window: 21:00 (1260 minutes) to 23:59 (1439 minutes)
  const weeknightStart = 21 * 60; // 1260 minutes (9 PM)
  const weeknightEnd = 23 * 60 + 59; // 1439 minutes (11:59 PM)
  
  // Check if shift overlaps with weeknight window
  if (endMinutes <= weeknightStart || startMinutes > weeknightEnd) {
    // No overlap
    return 0;
  }
  
  // Calculate overlap
  const overlapStart = Math.max(startMinutes, weeknightStart);
  const overlapEnd = Math.min(endMinutes, weeknightEnd);
  const overlapMinutes = overlapEnd - overlapStart;
  
  if (overlapMinutes <= 0) {
    return 0;
  }
  
  // Convert to hours and cap at 2 hours
  const overlapHours = overlapMinutes / 60;
  return Math.min(overlapHours, 2);
}

/**
 * Get employee-specific rates
 */
export async function getEmployeeRates(
  userId: number,
  date: string
): Promise<{
  weekdayRate: number;
  weeknightRate: number;
  saturdayRate: number;
  sundayRate: number;
  publicHolidayRate: number;
} | null> {
  const rates = await db
    .select({
      weekdayRate: employeeRates.weekdayRate,
      weeknightRate: employeeRates.weeknightRate,
      saturdayRate: employeeRates.saturdayRate,
      sundayRate: employeeRates.sundayRate,
      publicHolidayRate: employeeRates.publicHolidayRate,
    })
    .from(employeeRates)
    .where(
      and(
        eq(employeeRates.userId, userId),
        or(
          isNull(employeeRates.validFrom),
          lte(employeeRates.validFrom, date)
        ),
        or(
          isNull(employeeRates.validTo),
          gte(employeeRates.validTo, date)
        )
      )
    )
    .limit(1);

  return rates.length > 0 ? rates[0] : null;
}

/**
 * Calculate shift duration in hours, handling cross-day shifts
 */
export function calculateShiftDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  
  // Handle cross-day shifts (e.g., 22:00 to 06:00)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }
  
  const durationMinutes = endMinutes - startMinutes;
  return durationMinutes / 60; // Convert to hours
}

/**
 * Get applicable rate tiers for a shift
 */
export async function getRateTiers(
  companyId: number,
  shiftType: string,
  dayType: string,
  shiftDate: string
): Promise<Array<{
  id: number;
  tierOrder: number;
  hoursInTier: string | null;
  ratePerHour: number;
}>> {
  const tiers = await db
    .select({
      id: rateTiers.id,
      tierOrder: rateTiers.tierOrder,
      hoursInTier: rateTiers.hoursInTier,
      ratePerHour: rateTiers.ratePerHour,
    })
    .from(rateTiers)
    .where(
      and(
        eq(rateTiers.companyId, companyId),
        eq(rateTiers.shiftType, shiftType),
        eq(rateTiers.dayType, dayType),
        or(
          isNull(rateTiers.validFrom),
          gte(rateTiers.validFrom, shiftDate)
        ),
        or(
          isNull(rateTiers.validTo),
          lte(rateTiers.validTo, shiftDate)
        )
      )
    )
    .orderBy(rateTiers.tierOrder);

  return tiers;
}

/**
 * Get public holidays as an array of date strings
 */
export async function getPublicHolidays(): Promise<string[]> {
  const holidays = await db
    .select({ date: publicHolidays.date })
    .from(publicHolidays);
  
  return holidays.map(h => h.date);
}

/**
 * Calculate employee-based billing for a shift
 */
export async function calculateShiftBilling(
  shiftId: string | number,
  userId: number,
  date: string,
  startTime: string,
  endTime: string,
  shiftType: string
): Promise<ShiftBilling> {
  // Calculate total hours
  const totalHours = calculateShiftDuration(startTime, endTime);
  
  // Get holidays
  const holidays = await getPublicHolidays();
  
  // Determine base rate type for employee billing
  const rateType = getEmployeeRateType(date, holidays);
  
  // Get employee rates
  const employeeRates = await getEmployeeRates(userId, date);
  
  // If no employee rates found, use fallback rate
  if (!employeeRates) {
    const fallbackRate = 2500; // $25.00 per hour in cents - fallback rate
    return {
      shift_id: shiftId,
      total_hours: totalHours,
      total_amount: Math.round(totalHours * fallbackRate),
      date,
      day_type: rateType,
      shift_type: shiftType,
      billing: [
        {
          tier: 1,
          rate: fallbackRate,
          hours: totalHours,
          subtotal: Math.round(totalHours * fallbackRate)
        }
      ]
    };
  }
  
  // Handle weekday shifts with potential weeknight hours
  if (rateType === 'weekday') {
    const weeknightHours = calculateWeeknightHours(startTime, endTime);
    
    if (weeknightHours > 0) {
      // Split billing: weeknight hours + weekday hours
      const weekdayHours = totalHours - weeknightHours;
      const weeknightAmount = Math.round(weeknightHours * employeeRates.weeknightRate);
      const weekdayAmount = Math.round(weekdayHours * employeeRates.weekdayRate);
      const totalAmount = weeknightAmount + weekdayAmount;
      
      return {
        shift_id: shiftId,
        total_hours: totalHours,
        total_amount: totalAmount,
        date,
        day_type: 'weekday/weeknight', // Indicates split billing
        shift_type: shiftType,
        start_time: startTime,
        end_time: endTime,
        billing: [
          {
            tier: 1,
            rate: employeeRates.weekdayRate,
            hours: weekdayHours,
            subtotal: weekdayAmount
          },
          {
            tier: 2,
            rate: employeeRates.weeknightRate,
            hours: weeknightHours,
            subtotal: weeknightAmount
          }
        ]
      };
    }
  }
  
  // Get the appropriate rate based on rate type (non-weekday or weekday without weeknight hours)
  let hourlyRate: number;
  switch (rateType) {
    case 'weekday':
      hourlyRate = employeeRates.weekdayRate;
      break;
    case 'saturday':
      hourlyRate = employeeRates.saturdayRate;
      break;
    case 'sunday':
      hourlyRate = employeeRates.sundayRate;
      break;
    case 'publicHoliday':
      hourlyRate = employeeRates.publicHolidayRate;
      break;
    default:
      hourlyRate = employeeRates.weekdayRate; // fallback to weekday rate
  }
  
  // Calculate simple hourly billing
  const totalAmount = Math.round(totalHours * hourlyRate);
  
  return {
    shift_id: shiftId,
    total_hours: totalHours,
    total_amount: totalAmount,
    date,
    day_type: rateType,
    shift_type: shiftType,
    start_time: startTime,
    end_time: endTime,
    billing: [
      {
        tier: 1,
        rate: hourlyRate,
        hours: totalHours,
        subtotal: totalAmount
      }
    ]
  };
}

/**
 * Format currency amount from cents to display string
 */
export function formatCurrency(amountInCents: number, currency: string = "AUD"): string {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Batch calculate billing for multiple shifts using employee rates
 */
export async function calculateMultipleShiftsBilling(
  shifts: Array<{
    id: string | number;
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    shiftType: string;
  }>
): Promise<ShiftBilling[]> {
  const results = await Promise.all(
    shifts.map(shift => 
      calculateShiftBilling(
        shift.id,
        shift.userId,
        shift.date,
        shift.startTime,
        shift.endTime,
        shift.shiftType
      )
    )
  );
  
  return results;
}