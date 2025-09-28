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
 * Determine the rate type for employee billing purposes
 * Supports: weekday, weeknight, saturday, sunday, publicHoliday
 */
export function getEmployeeRateType(date: string, startTime: string, holidays: string[]): string {
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
    // Weekdays (Monday-Friday) - differentiate between day and night
    const [hour] = startTime.split(':').map(Number);
    
    // Define night shift as starting between 21:00 (9 PM) and 23:59 (11:59 PM)
    if (hour >= 21 && hour <= 23) {
      return "weeknight";
    } else {
      return "weekday";
    }
  }
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
  
  // Determine rate type for employee billing
  const rateType = getEmployeeRateType(date, startTime, holidays);
  
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
  
  // Get the appropriate rate based on rate type
  let hourlyRate: number;
  switch (rateType) {
    case 'weekday':
      hourlyRate = employeeRates.weekdayRate;
      break;
    case 'weeknight':
      hourlyRate = employeeRates.weeknightRate;
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
  
  // Calculate simple hourly billing (no tiers for employee rates)
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