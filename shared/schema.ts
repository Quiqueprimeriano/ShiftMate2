import { pgTable, text, serial, integer, boolean, timestamp, date, time, varchar, jsonb, index, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for persistent authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Companies/Organizations table
export const companies = pgTable("shiftmate_companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  industry: text("industry"), // retail, hospitality, healthcare, etc.
  size: text("size"), // small, medium, large
  timezone: text("timezone").default("UTC"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("shiftmate_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  userType: text("user_type").notNull().default("individual"), // individual, business_owner, employee
  companyId: integer("company_id").references(() => companies.id),
  role: text("role"), // manager, supervisor, employee
  hourlyRate: integer("hourly_rate"), // in cents
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shifts = pgTable("shiftmate_shifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  shiftType: text("shift_type").notNull(), // morning, evening, night, double, custom
  notes: text("notes"),
  location: text("location"), // shift location for roster planning
  status: text("status").default("completed"), // completed, pending_approval, approved, rejected, scheduled
  createdBy: integer("created_by").references(() => users.id), // manager who assigned/created the shift
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // daily, weekly, custom
  recurringEndDate: date("recurring_end_date"),
  templateId: integer("template_id"), // for future shift templates feature
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("shiftmate_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // missing_entries, long_shift
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Refresh tokens for persistent authentication
export const refreshTokens = pgTable("shiftmate_refresh_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rate tiers for tiered billing system
export const rateTiers = pgTable("shiftmate_rate_tiers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  shiftType: text("shift_type").notNull(), // 'Day', 'Night', 'Weekend', 'Holiday', 'Custom'
  tierOrder: integer("tier_order").notNull(), // 1, 2, 3, etc.
  hoursInTier: decimal("hours_in_tier", { precision: 5, scale: 2 }), // NULL for "remaining hours"
  ratePerHour: integer("rate_per_hour").notNull(), // in cents (e.g. 5000 = $50.00)
  dayType: text("day_type").notNull(), // 'weekday', 'saturday', 'sunday', 'holiday'
  currency: text("currency").default("AUD"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Public holidays for holiday rate calculations
export const publicHolidays = pgTable("shiftmate_public_holidays", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Employee-specific rates for the 5 rate types
export const employeeRates = pgTable("shiftmate_employee_rates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  weekdayRate: integer("weekday_rate").notNull(), // in cents (e.g. 2500 = $25.00)
  weeknightRate: integer("weeknight_rate").notNull(), // in cents
  saturdayRate: integer("saturday_rate").notNull(), // in cents
  sundayRate: integer("sunday_rate").notNull(), // in cents
  publicHolidayRate: integer("public_holiday_rate").notNull(), // in cents
  currency: text("currency").default("AUD"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export const insertRateTierSchema = createInsertSchema(rateTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicHolidaySchema = createInsertSchema(publicHolidays).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeRateSchema = createInsertSchema(employeeRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRateTier = z.infer<typeof insertRateTierSchema>;
export type RateTier = typeof rateTiers.$inferSelect;
export type InsertPublicHoliday = z.infer<typeof insertPublicHolidaySchema>;
export type PublicHoliday = typeof publicHolidays.$inferSelect;
export type InsertEmployeeRate = z.infer<typeof insertEmployeeRateSchema>;
export type EmployeeRate = typeof employeeRates.$inferSelect;
