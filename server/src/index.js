import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import winston from "winston";
import fs from "fs/promises";
import path from "path";

// Import routes
import documentRoutes from "./routes/documents.js";
import analysisRoutes from "./routes/analysis.js";
import voiceRoutes from "./routes/voice.js";
import chatRoutes from "./routes/chat.js";
import healthRoutes from "./routes/health.js";

// Import services
import databaseService from "./services/databaseService.js";
import { setupSocketHandlers } from "./services/socketService.js";
import pineconeService from "./services/pineconeService.js";
import embeddingService from "./services/embeddingService.js";
import ragService from "./services/ragService.js";

// Load environment variables
dotenv.config();

// Create logs directory if it doesn't exist
try {
  await fs.mkdir(path.join(process.cwd(), 'logs'), { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "lexiplain-backend" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:8086",
    methods: ["GET", "POST"],
  },
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:8086",
    credentials: true,
  }),
);
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(limiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Make io available to routes
app.set("io", io);

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/chat", chatRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File too large",
      message: `File size should be less than ${process.env.MAX_FILE_SIZE_MB || 50}MB`,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message,
    });
  }

  res.status(500).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Initialize RAG services
async function initializeRAGServices() {
  try {
    logger.info('🤖 Initializing RAG services...');
    
    // Check for required environment variables
    const requiredEnvVars = {
      'PINECONE_API_KEY': process.env.PINECONE_API_KEY,
      'GEMINI_API_KEY': process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    };
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      if (!value) {
        logger.warn(`⚠️  ${key} not found, RAG features may be limited`);
      }
    }
    
    // Initialize services in order
    if (requiredEnvVars.PINECONE_API_KEY) {
      try {
        await pineconeService.initialize();
        logger.info('✅ Pinecone service initialized');
      } catch (error) {
        logger.error('❌ Failed to initialize Pinecone:', error.message);
      }
    }
    
    // Embedding service initializes automatically
    try {
      const embeddingHealth = await embeddingService.healthCheck();
      if (embeddingHealth.gemini || embeddingHealth.openai) {
        logger.info('✅ Embedding service initialized');
      } else {
        logger.warn('⚠️  No embedding providers available');
      }
    } catch (error) {
      logger.error('❌ Embedding service check failed:', error.message);
    }
    
    // Initialize RAG service
    if (requiredEnvVars.GEMINI_API_KEY) {
      try {
        await ragService.initialize();
        logger.info('✅ RAG service initialized');
      } catch (error) {
        logger.error('❌ Failed to initialize RAG service:', error.message);
      }
    }
    
    logger.info('🚀 RAG services initialization complete');
  } catch (error) {
    logger.error('❌ Failed to initialize RAG services:', error);
    // Don't exit, let the server run without RAG features
  }
}

// Initialize services
async function startServer() {
  try {
    // Create necessary directories
    const directories = ['uploads/documents', 'data'];
    for (const dir of directories) {
      try {
        await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
    
    // Initialize database
    await databaseService.initialize();
    logger.info("✅ Database initialized successfully");

    // Initialize RAG services
    await initializeRAGServices();

    // Setup Socket.IO handlers
    setupSocketHandlers(io);
    logger.info("✅ Socket.IO handlers setup complete");

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      logger.info(`🚀 LexiPlain Backend Server running on port ${PORT}`);
      logger.info(
        `📚 API Documentation available at http://localhost:${PORT}/api/health`,
      );
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`💾 Database: SQLite`);
      logger.info(`🤖 RAG Features: ${process.env.PINECONE_API_KEY && process.env.GEMINI_API_KEY ? 'Enabled' : 'Limited'}`);
      logger.info(`🗣️  Chat & Voice features enabled`);
      logger.info(`📁 File uploads: ${path.join(process.cwd(), 'uploads')}`);
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
startServer();