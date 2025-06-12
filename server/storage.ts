import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { 
  users, 
  shifts, 
  notifications,
  type User, 
  type InsertUser, 
  type Shift, 
  type InsertShift,
  type Notification,
  type InsertNotification
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
  
  // Shift methods
  getShiftsByUser(userId: number): Promise<Shift[]>;
  getShiftsByUserAndDateRange(userId: number, startDate: string, endDate: string): Promise<Shift[]>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  
  // Analytics methods
  getWeeklyHours(userId: number, startDate: string, endDate: string): Promise<number>;
  getDailyAverage(userId: number, startDate: string, endDate: string): Promise<number>;
  getMissingEntries(userId: number, startDate: string, endDate: string): Promise<string[]>;
  
  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<boolean>;
  
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

  // Shift methods
  async getShiftsByUser(userId: number): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.userId, userId)).orderBy(desc(shifts.date));
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

  // Analytics methods
  async getWeeklyHours(userId: number, startDate: string, endDate: string): Promise<number> {
    const shiftsInRange = await this.getShiftsByUserAndDateRange(userId, startDate, endDate);
    
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
    return result.rowCount > 0;
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
}

export const storage = new DbStorage();
