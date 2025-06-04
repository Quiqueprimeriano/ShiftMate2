import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import { insertUserSchema, insertShiftSchema, insertNotificationSchema } from "@shared/schema";
import { z } from "zod";

// Extend the Request interface to include session
interface AuthenticatedRequest extends Request {
  session: any;
  userId?: number;
}

// Configure Google OAuth Strategy
function setupGoogleAuth() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        
        if (!email || !name) {
          return done(new Error('Email or name not provided by Google'));
        }

        // Check if user exists
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
          // Create new user
          user = await storage.createUser({ email, name });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));

    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
      try {
        const user = await storage.getUser(id);
        done(null, user);
      } catch (error) {
        done(error);
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Setup Google OAuth
  setupGoogleAuth();

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    // Store the intent (login or signup) in session
    (req.session as any).authIntent = req.query.intent || 'login';
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get("/api/auth/google/callback", 
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
      // Successful authentication, redirect to dashboard
      res.redirect('/');
    }
  );

  // Email/Password Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, name } = req.body;
      
      console.log('Login attempt:', { email, name });
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // User exists, log them in
        (req.session as any).userId = existingUser.id;
        console.log('Login successful for user:', existingUser.id);
        res.json({ user: existingUser });
      } else {
        // User doesn't exist for login
        res.status(401).json({ message: "User not found. Please sign up first." });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, name } = req.body;
      
      console.log('Signup attempt:', { email, name });
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        res.status(409).json({ message: "User already exists. Please log in instead." });
      } else {
        // Create new user
        console.log('Creating new user:', { email, name });
        const newUser = await storage.createUser({ email, name });
        (req.session as any).userId = newUser.id;
        console.log('Signup successful for user:', newUser.id);
        res.json({ user: newUser });
      }
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: "Signup failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Middleware to check authentication
  const requireAuth = (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    req.userId = userId;
    next();
  };

  // Shift routes
  app.get("/api/shifts", requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByUser(req.userId);
      }
      
      res.json(shifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get shifts" });
    }
  });

  app.post("/api/shifts", requireAuth, async (req: any, res) => {
    try {
      const shiftData = insertShiftSchema.parse({
        ...req.body,
        userId: req.userId
      });

      const shift = await storage.createShift(shiftData);
      res.status(201).json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create shift" });
    }
  });

  app.put("/api/shifts/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const shiftData = insertShiftSchema.partial().parse(req.body);

      const shift = await storage.updateShift(id, shiftData);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update shift" });
    }
  });

  app.delete("/api/shifts/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteShift(id);
      
      if (!success) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.json({ message: "Shift deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete shift" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/weekly-hours", requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const hours = await storage.getWeeklyHours(req.userId, startDate, endDate);
      res.json({ hours });
    } catch (error) {
      res.status(500).json({ message: "Failed to get weekly hours" });
    }
  });

  app.get("/api/analytics/daily-average", requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const average = await storage.getDailyAverage(req.userId, startDate, endDate);
      res.json({ average });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily average" });
    }
  });

  app.get("/api/analytics/missing-entries", requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const missingDates = await storage.getMissingEntries(req.userId, startDate, endDate);
      res.json({ missingDates });
    } catch (error) {
      res.status(500).json({ message: "Failed to get missing entries" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notificationData = insertNotificationSchema.parse({
        ...req.body,
        userId: req.userId
      });

      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid notification data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(id);
      
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
