import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { generateVerificationToken, sendVerificationEmail, sendLoginVerificationEmail } from "./services/email";
import multer from "multer";
import { uploadProfilePicture, deleteFile } from "./services/upload";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Schema for user registration
const registerSchema = insertUserSchema.extend({
  isServiceProvider: z.preprocess(
    // Convert string 'true'/'false' to boolean
    (val) => val === 'true' || val === true,
    z.boolean()
  ),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

// Schema for service provider additional info
const providerExtendedSchema = z.object({
  categoryId: z.preprocess(
    // Convert string to number
    (val) => Number(val),
    z.number()
  ),
  hourlyRate: z.preprocess(
    // Convert string to number
    (val) => Number(val),
    z.number().min(1)
  ),
  bio: z.string().optional(),
  yearsOfExperience: z.preprocess(
    // Convert string to number
    (val) => val ? Number(val) : undefined,
    z.number().optional()
  ),
  availability: z.string().optional(),
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  }
});

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "Find My Helper-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password"
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          // Check if email is verified
          if (!user.emailVerified) {
            // Generate new verification token
            const token = generateVerificationToken();
            const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            await storage.updateUser(user.id, {
              verificationToken: token,
              verificationTokenExpires: tokenExpires
            });
            
            // Send verification email
            await sendVerificationEmail(user.email, token);
            
            return done(null, false, { 
              message: "Please verify your email address. A new verification link has been sent to your email." 
            });
          }
          
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", upload.single('profilePicture'), async (req, res, next) => {
    try {
      console.log("Received registration request:", {
        body: req.body,
        file: req.file ? { ...req.file, buffer: '[Buffer]' } : null
      });

      // Parse boolean value from string
      req.body.isServiceProvider = req.body.isServiceProvider === 'true';
      
      // Validate the registration data
      const validatedData = registerSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      
      // Check if email already exists
      const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Check if username already exists
      const existingUserByUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Handle profile picture upload
      let profilePicturePath = null;
      if (req.file) {
        try {
          profilePicturePath = await uploadProfilePicture(req.file);
        } catch (error) {
          console.error('Error uploading profile picture:', error);
          // Continue registration without profile picture if upload fails
        }
      }
      
      // Generate verification token
      const verificationToken = generateVerificationToken();
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Hash password and create the user
      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
        verificationToken,
        verificationTokenExpires: tokenExpires,
        emailVerified: false,
        profilePicture: profilePicturePath
      });
      
      // Send verification email
      const emailInfo = await sendVerificationEmail(user.email, verificationToken);
      console.log("Verification email sent:", emailInfo);
      
      // If user is a service provider, create service provider profile
      if (validatedData.isServiceProvider) {
        try {
          const providerData = providerExtendedSchema.parse(req.body);
          
          await storage.createServiceProvider({
            userId: user.id,
            categoryId: providerData.categoryId,
            hourlyRate: providerData.hourlyRate,
            bio: providerData.bio || "",
            yearsOfExperience: providerData.yearsOfExperience || 0,
            availability: providerData.availability || ""
          });
        } catch (err) {
          console.error("Failed to create service provider profile:", err);
          return res.status(201).json({ 
            user,
            warning: "User created but service provider profile could not be created"
          });
        }
      }

      return res.status(201).json({ 
        user,
        message: "Registration successful. Please check your email to verify your account."
      });
    } catch (err) {
      console.error("Registration error:", err);
      
      // If there was an error and we uploaded a file, clean it up
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: err.errors 
        });
      }
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
  
  app.get("/api/user/provider", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const provider = await storage.getServiceProviderByUserId(req.user.id);
      if (!provider) {
        return res.status(404).json({ message: "Provider profile not found" });
      }
      
      const providerWithDetails = await storage.getServiceProviderWithUser(provider.id);
      res.json(providerWithDetails);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Email verification endpoint
  app.get("/api/verify-email", async (req, res) => {
    const { token } = req.query;
    
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid verification token" });
    }
    
    try {
      // Find user by verification token
      const user = await storage.getUserByVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid verification token" });
      }
      
      // Check if token is expired
      if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
        return res.status(400).json({ message: "Verification token has expired" });
      }
      
      // Update user as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null
      });
      
      // Log the user in
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Error logging in" });
        return res.json({ message: "Email verified successfully" });
      });
    } catch (err) {
      console.error("Error verifying email:", err);
      res.status(500).json({ message: "Error verifying email" });
    }
  });

  // Resend verification email
  app.post("/api/resend-verification", async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    try {
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      
      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }
      
      // Generate new verification token
      const verificationToken = generateVerificationToken();
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.updateUser(user.id, {
        verificationToken,
        verificationTokenExpires: tokenExpires
      });
      
      // Send new verification email
      await sendVerificationEmail(user.email, verificationToken);
      
      res.json({ message: "Verification email sent successfully" });
    } catch (err) {
      console.error("Error resending verification email:", err);
      res.status(500).json({ message: "Error sending verification email" });
    }
  });
}
