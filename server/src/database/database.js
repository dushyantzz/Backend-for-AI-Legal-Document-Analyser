import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';

let db = null;

export async function createDatabase() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const dbPath = path.join(dataDir, 'lexiplain.db');
    
    db = new sqlite3.Database(dbPath);
    
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            originalName TEXT NOT NULL,
            mimeType TEXT NOT NULL,
            fileSize INTEGER NOT NULL,
            filePath TEXT NOT NULL,
            extractedText TEXT,
            confidence REAL,
            pages INTEGER,
            wordCount INTEGER,
            language TEXT,
            status TEXT DEFAULT 'processing',
            vectorStatus TEXT DEFAULT 'pending',
            chunkCount INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            documentId TEXT NOT NULL,
            title TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            sessionId TEXT NOT NULL,
            documentId TEXT NOT NULL,
            content TEXT NOT NULL,
            messageType TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sessionId) REFERENCES chat_sessions(id),
            FOREIGN KEY (documentId) REFERENCES documents(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    console.log('✅ Database initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export function getDatabase() {
  return db;
}
