import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { rateTiers, publicHolidays } from "@shared/schema";
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
  billing: BillingTier[];
}

/**
 * Determine the day type for billing purposes
 */
export function getDayType(date: string, holidays: string[]): string {
  const shiftDate = new Date(date);
  const dayOfWeek = shiftDate.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's a holiday first
  if (holidays.includes(date)) {
    return "holiday";
  }
  
  // Check day of week
  if (dayOfWeek === 0) {
    return "sunday";
  } else if (dayOfWeek === 6) {
    return "saturday";
  } else {
    return "weekday";
  }
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
 * Calculate tiered billing for a shift
 */
export async function calculateShiftBilling(
  shiftId: string | number,
  companyId: number,
  date: string,
  startTime: string,
  endTime: string,
  shiftType: string
): Promise<ShiftBilling> {
  // Calculate total hours
  const totalHours = calculateShiftDuration(startTime, endTime);
  
  // Get holidays
  const holidays = await getPublicHolidays();
  
  // Determine day type
  const dayType = getDayType(date, holidays);
  
  // Get applicable rate tiers
  const tiers = await getRateTiers(companyId, shiftType, dayType, date);
  
  // If no rate tiers found, use fallback rate (could be from user's hourlyRate)
  if (tiers.length === 0) {
    const fallbackRate = 2500; // $25.00 per hour in cents - this should come from config or user's rate
    return {
      shift_id: shiftId,
      total_hours: totalHours,
      total_amount: Math.round(totalHours * fallbackRate),
      date,
      day_type: dayType,
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
  
  // Apply tiered billing
  const billingTiers: BillingTier[] = [];
  let remainingHours = totalHours;
  let totalAmount = 0;
  
  for (let i = 0; i < tiers.length; i++) {
    if (remainingHours <= 0) break;
    
    const tier = tiers[i];
    const tierHours = tier.hoursInTier ? Math.min(remainingHours, parseFloat(tier.hoursInTier)) : remainingHours;
    const subtotal = Math.round(tierHours * tier.ratePerHour);
    
    billingTiers.push({
      tier: tier.tierOrder,
      rate: tier.ratePerHour,
      hours: tierHours,
      subtotal
    });
    
    totalAmount += subtotal;
    remainingHours -= tierHours;
    
    // If this tier has no hour limit (hoursInTier is null), it handles all remaining hours
    if (!tier.hoursInTier) {
      break;
    }
  }
  
  return {
    shift_id: shiftId,
    total_hours: totalHours,
    total_amount: totalAmount,
    date,
    day_type: dayType,
    shift_type: shiftType,
    billing: billingTiers
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
 * Batch calculate billing for multiple shifts
 */
export async function calculateMultipleShiftsBilling(
  shifts: Array<{
    id: string | number;
    companyId: number;
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
        shift.companyId,
        shift.date,
        shift.startTime,
        shift.endTime,
        shift.shiftType
      )
    )
  );
  
  return results;
}