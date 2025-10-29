import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, gte, lte, desc, sql, or, isNull, isNotNull } from "drizzle-orm";
import { 
  users, 
  shifts, 
  notifications,
  companies,
  refreshTokens,
  rateTiers,
  publicHolidays,
  employeeRates,
  type User, 
  type InsertUser, 
  type Shift, 
  type InsertShift,
  type Notification,
  type InsertNotification,
  type Company,
  type InsertCompany,
  type RefreshToken,
  type InsertRefreshToken,
  type RateTier,
  type InsertRateTier,
  type PublicHoliday,
  type InsertPublicHoliday,
  type EmployeeRate,
  type InsertEmployeeRate
} from "@shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

console.log('Connecting to database with PostgreSQL driver...');

// Parse connection string manually to handle special characters
const match = connectionString.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
if (!match) {
  throw new Error('Invalid DATABASE_URL format');
}

const [, username, password, host, port, database] = match;

console.log('Parsed connection details for PostgreSQL');

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

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Company methods
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByEmail(email: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  getCompanyEmployees(companyId: number): Promise<User[]>;
  
  // Shift methods
  getShift(id: number): Promise<Shift | undefined>;
  getShiftsByUser(userId: number): Promise<Shift[]>;
  getShiftsByUserAndDate(userId: number, date: string): Promise<Shift[]>;
  getShiftsByUserAndDateRange(userId: number, startDate: string, endDate: string): Promise<Shift[]>;
  getShiftsByCompany(companyId: number): Promise<Shift[]>;
  getShiftsByCompanyAndDateRange(companyId: number, startDate: string, endDate: string): Promise<Shift[]>;
  getPendingShifts(companyId: number): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  approveShift(id: number, approvedBy: number): Promise<Shift | undefined>;
  
  // Analytics methods
  getWeeklyHours(userId: number, startDate: string, endDate: string): Promise<number>;
  getCompanyWeeklyHours(companyId: number, startDate: string, endDate: string): Promise<number>;
  getDailyAverage(userId: number, startDate: string, endDate: string): Promise<number>;
  getMissingEntries(userId: number, startDate: string, endDate: string): Promise<string[]>;
  
  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<boolean>;
  
  // Refresh token methods
  createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken>;
  getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
  // Admin methods
  getUserCount(): Promise<number>;
  getShiftCount(): Promise<number>;
  getTotalHours(): Promise<number>;
  getNotificationCount(): Promise<number>;
  getAllUsers(): Promise<User[]>;
  getAllShiftsWithUsers(): Promise<any[]>;
  executeRawQuery(query: string): Promise<any>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      console.log('Searching for user with email:', email);
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      console.log('getUserByEmail result:', result);
      return result[0];
    } catch (error) {
      console.error('Error in getUserByEmail:', error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      console.log('Creating user:', user);
      const result = await db.insert(users).values(user).returning();
      console.log('createUser result:', result);
      return result[0];
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  // Company methods
  async getCompany(id: number): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.email, email)).limit(1);
    return result[0];
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }

  async getCompanyEmployees(companyId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.companyId, companyId));
  }

  // Shift methods
  async getShift(id: number): Promise<Shift | undefined> {
    const result = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
    return result[0];
  }

  async getShiftsByUser(userId: number): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.userId, userId)).orderBy(desc(shifts.date));
  }

  async getShiftsByUserAndDate(userId: number, date: string): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(
        and(
          eq(shifts.userId, userId),
          eq(shifts.date, date)
        )
      )
      .orderBy(shifts.startTime);
  }

  async getShiftsByUserAndDateRange(userId: number, startDate: string, endDate: string): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(
        and(
          eq(shifts.userId, userId),
          gte(shifts.date, startDate),
          lte(shifts.date, endDate)
        )
      )
      .orderBy(shifts.date);
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    const result = await db.insert(shifts).values(shift).returning();
    return result[0];
  }

  async updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined> {
    const result = await db.update(shifts).set(shift).where(eq(shifts.id, id)).returning();
    return result[0];
  }

  async deleteShift(id: number): Promise<boolean> {
    const result = await db.delete(shifts).where(eq(shifts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getShiftsByCompany(companyId: number): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.companyId, companyId)).orderBy(desc(shifts.date));
  }

  async getShiftsByCompanyAndDateRange(companyId: number, startDate: string, endDate: string): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(
        and(
          eq(shifts.companyId, companyId),
          gte(shifts.date, startDate),
          lte(shifts.date, endDate)
        )
      )
      .orderBy(shifts.date);
  }

  async getPendingShifts(companyId: number): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(
        and(
          eq(shifts.companyId, companyId),
          eq(shifts.status, 'pending_approval')
        )
      )
      .orderBy(desc(shifts.date));
  }

  async approveShift(id: number, approvedBy: number): Promise<Shift | undefined> {
    const result = await db.update(shifts)
      .set({ 
        status: 'approved', 
        approvedBy: approvedBy, 
        approvedAt: new Date()
      })
      .where(eq(shifts.id, id))
      .returning();
    return result[0];
  }

  // Analytics methods
  async getWeeklyHours(userId: number, startDate: string, endDate: string): Promise<number> {
    const shiftsInRange = await this.getShiftsByUserAndDateRange(userId, startDate, endDate);
    
    // Filter to only include uploaded shifts (exclude roster shifts)
    const uploadedShifts = shiftsInRange.filter(shift => 
      !shift.createdBy || shift.createdBy === userId
    );
    
    let totalMinutes = 0;
    for (const shift of uploadedShifts) {
      const start = new Date(`2000-01-01T${shift.startTime}`);
      const end = new Date(`2000-01-01T${shift.endTime}`);
      
      // Handle overnight shifts
      if (end < start) {
        end.setDate(end.getDate() + 1);
      }
      
      const shiftMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      totalMinutes += shiftMinutes;
    }
    
    return totalMinutes / 60; // Convert to hours
  }

  async getCompanyWeeklyHours(companyId: number, startDate: string, endDate: string): Promise<number> {
    const shiftsInRange = await this.getShiftsByCompanyAndDateRange(companyId, startDate, endDate);
    
    let totalMinutes = 0;
    for (const shift of shiftsInRange) {
      const start = new Date(`2000-01-01T${shift.startTime}`);
      const end = new Date(`2000-01-01T${shift.endTime}`);
      
      // Handle overnight shifts
      if (end < start) {
        end.setDate(end.getDate() + 1);
      }
      
      const shiftMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      totalMinutes += shiftMinutes;
    }
    
    return totalMinutes / 60; // Convert to hours
  }

  async getDailyAverage(userId: number, startDate: string, endDate: string): Promise<number> {
    const totalHours = await this.getWeeklyHours(userId, startDate, endDate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return daysDiff > 0 ? totalHours / daysDiff : 0;
  }

  async getMissingEntries(userId: number, startDate: string, endDate: string): Promise<string[]> {
    const shiftsInRange = await this.getShiftsByUserAndDateRange(userId, startDate, endDate);
    const shiftDates = new Set(shiftsInRange.map(shift => shift.date));
    
    const missingDates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!shiftDates.has(dateStr)) {
        missingDates.push(dateStr);
      }
    }
    
    return missingDates;
  }

  // Notification methods
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Refresh token methods
  async createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken> {
    const result = await db.insert(refreshTokens).values(token).returning();
    return result[0];
  }

  async getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const result = await db.select().from(refreshTokens)
      .where(and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt)
      ))
      .limit(1);
    return result[0];
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async cleanupExpiredTokens(): Promise<void> {
    await db.delete(refreshTokens)
      .where(or(
        isNotNull(refreshTokens.revokedAt),
        lte(refreshTokens.expiresAt, new Date())
      ));
  }

  // Admin methods
  async getUserCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(users);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting user count:', error);
      return 0;
    }
  }

  async getShiftCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(shifts);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting shift count:', error);
      return 0;
    }
  }

  async getTotalHours(): Promise<number> {
    try {
      const allShifts = await db.select().from(shifts);
      let totalHours = 0;
      
      for (const shift of allShifts) {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        
        // Handle overnight shifts
        if (end < start) {
          end.setDate(end.getDate() + 1);
        }
        
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        totalHours += duration;
      }
      
      return totalHours;
    } catch (error) {
      console.error('Error calculating total hours:', error);
      return 0;
    }
  }

  async getNotificationCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(notifications);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting notification count:', error);
      return 0;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users).orderBy(desc(users.createdAt));
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async getAllShiftsWithUsers(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: shifts.id,
          userId: shifts.userId,
          date: shifts.date,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          shiftType: shifts.shiftType,
          notes: shifts.notes,
          createdAt: shifts.createdAt,
          userName: users.name
        })
        .from(shifts)
        .leftJoin(users, eq(shifts.userId, users.id))
        .orderBy(desc(shifts.createdAt));

      // Calculate duration for each shift
      return result.map(shift => {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        
        // Handle overnight shifts
        if (end < start) {
          end.setDate(end.getDate() + 1);
        }
        
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        return {
          ...shift,
          duration
        };
      });
    } catch (error) {
      console.error('Error getting all shifts with users:', error);
      return [];
    }
  }

  async executeRawQuery(query: string): Promise<any> {
    try {
      const result = await db.execute(sql.raw(query));
      return result;
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw error;
    }
  }

  // Rate Tier Methods
  async getRateTiersByCompany(companyId: number): Promise<any[]> {
    try {
      return await db
        .select()
        .from(rateTiers)
        .where(eq(rateTiers.companyId, companyId))
        .orderBy(rateTiers.shiftType, rateTiers.dayType, rateTiers.tierOrder);
    } catch (error) {
      console.error('Error fetching rate tiers:', error);
      throw error;
    }
  }

  async createRateTier(data: any): Promise<any> {
    try {
      const [result] = await db
        .insert(rateTiers)
        .values(data)
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating rate tier:', error);
      throw error;
    }
  }

  // Public Holiday Methods
  async getAllPublicHolidays(): Promise<any[]> {
    try {
      return await db
        .select()
        .from(publicHolidays)
        .orderBy(publicHolidays.date);
    } catch (error) {
      console.error('Error fetching public holidays:', error);
      throw error;
    }
  }

  async createPublicHoliday(data: any): Promise<any> {
    try {
      const [result] = await db
        .insert(publicHolidays)
        .values(data)
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating public holiday:', error);
      throw error;
    }
  }

  // Employee Rate Methods
  async getEmployeeRates(userId: number): Promise<any> {
    try {
      const [result] = await db
        .select()
        .from(employeeRates)
        .where(eq(employeeRates.userId, userId))
        .limit(1);
      return result || null;
    } catch (error) {
      console.error('Error fetching employee rates:', error);
      throw error;
    }
  }

  async getEmployeeRatesByCompany(companyId: number): Promise<any[]> {
    try {
      return await db
        .select({
          id: employeeRates.id,
          userId: employeeRates.userId,
          weekdayRate: employeeRates.weekdayRate,
          weeknightRate: employeeRates.weeknightRate,
          saturdayRate: employeeRates.saturdayRate,
          sundayRate: employeeRates.sundayRate,
          publicHolidayRate: employeeRates.publicHolidayRate,
          currency: employeeRates.currency,
          validFrom: employeeRates.validFrom,
          validTo: employeeRates.validTo,
          userName: users.name,
          userEmail: users.email
        })
        .from(employeeRates)
        .leftJoin(users, eq(employeeRates.userId, users.id))
        .where(eq(employeeRates.companyId, companyId))
        .orderBy(users.name);
    } catch (error) {
      console.error('Error fetching company employee rates:', error);
      throw error;
    }
  }

  async createEmployeeRates(data: any): Promise<any> {
    try {
      const [result] = await db
        .insert(employeeRates)
        .values(data)
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating employee rates:', error);
      throw error;
    }
  }

  async updateEmployeeRates(userId: number, data: any): Promise<any> {
    try {
      const [result] = await db
        .update(employeeRates)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(employeeRates.userId, userId))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating employee rates:', error);
      throw error;
    }
  }

  async deleteEmployeeRates(userId: number): Promise<boolean> {
    try {
      await db
        .delete(employeeRates)
        .where(eq(employeeRates.userId, userId));
      return true;
    } catch (error) {
      console.error('Error deleting employee rates:', error);
      throw error;
    }
  }
}

export const storage = new DbStorage();
