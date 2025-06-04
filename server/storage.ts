import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
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

// Parse and reconstruct the connection string to handle special characters
let encodedConnectionString = connectionString;
try {
  const url = new URL(connectionString);
  // The URL constructor automatically encodes the password
  encodedConnectionString = url.toString();
} catch (error) {
  // If URL parsing fails, try manual encoding
  encodedConnectionString = connectionString.replace(/:[^:@]*@/, (match) => {
    const password = match.slice(1, -1);
    return ':' + encodeURIComponent(password) + '@';
  });
}

console.log('Connecting to database...');
const connection = neon(encodedConnectionString);
const db = drizzle(connection);

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
    return result.rowCount > 0;
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
      
      totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
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
}

export const storage = new DbStorage();
