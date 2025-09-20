// Load environment variables FIRST - before any imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server root directory
const envPath = join(__dirname, '..', '.env');
console.log('🔍 Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ .env file loaded successfully');
}

// Debug environment variables
console.log('🔍 Environment variables check:');
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GOOGLE_API_KEY exists:', !!process.env.GOOGLE_API_KEY);
console.log('PINECONE_API_KEY exists:', !!process.env.PINECONE_API_KEY);

// Now import other modules AFTER environment is loaded
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Import utilities
import logger from './utils/logger.js';
import { createDatabase } from './database/database.js';

// Import routes
import documentRoutes from './routes/documents.js';
import analysisRoutes from './routes/analysis.js';
import chatRoutes from './routes/chat.js';
import voiceRoutes from './routes/voice.js';

const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:8081",
    methods: ["GET", "POST"]
  }
});

// Middleware setup
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:8081",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static file serving
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/voice', voiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: `File size exceeds ${process.env.MAX_FILE_SIZE_MB || 50}MB limit`
      });
    }
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Socket.IO connection handling - SIMPLIFIED
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });
});

// Initialize services after environment is loaded
async function initializeServices() {
  try {
    logger.info('🤖 Initializing services...');
    
    // Initialize database first
    await createDatabase();
    logger.info('✅ Database initialized successfully');
    
    // Initialize RAG services
    logger.info('🤖 Initializing RAG services...');
    
    // Check for required API keys
    if (!process.env.PINECONE_API_KEY) {
      logger.warn('⚠️  PINECONE_API_KEY not found, RAG features may be limited');
    }
    
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      logger.warn('⚠️  GEMINI_API_KEY not found, RAG features may be limited');
    }
    
    // Import and initialize embedding service
    try {
      const embeddingService = await import('./services/embeddingService.js');
      await embeddingService.default.initialize();
    } catch (error) {
      logger.warn('⚠️  Embedding service initialization failed:', error.message);
    }
    
    // Import and initialize other services
    try {
      const pineconeService = await import('./services/pineconeService.js');
      await pineconeService.default.initialize();
    } catch (error) {
      logger.warn('⚠️  Pinecone service initialization failed:', error.message);
    }
    
    try {
      const ragService = await import('./services/ragService.js');
      await ragService.default.initialize();
    } catch (error) {
      logger.warn('⚠️  RAG service initialization failed:', error.message);
    }
    
    logger.info('🚀 RAG services initialization complete');
    
  } catch (error) {
    logger.error('❌ Service initialization failed:', error);
    // Continue anyway - some features may be disabled
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:8086'}`);
      logger.info(`✅ Socket.IO handlers setup complete`);
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
