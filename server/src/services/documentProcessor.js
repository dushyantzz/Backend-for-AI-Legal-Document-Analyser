import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import winston from "winston";
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { encoding_for_model } from 'tiktoken';
import databaseService from "./databaseService.js";
import embeddingService from "./embeddingService.js";
import qdrantService from "./qdrantService.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "document-processor" },
});

class DocumentProcessor {
  constructor() {
    this.chunkSize = parseInt(process.env.CHUNK_SIZE) || 1000;
    this.chunkOverlap = parseInt(process.env.CHUNK_OVERLAP) || 200;
    this.maxChunks = parseInt(process.env.MAX_CHUNKS_PER_DOCUMENT) || 500;
    this.maxTextLength = parseInt(process.env.MAX_TEXT_LENGTH) || 100000;
    
    try {
      this.tokenizer = encoding_for_model('gpt-3.5-turbo');
    } catch (error) {
      logger.warn('Failed to initialize tokenizer, using fallback estimation');
      this.tokenizer = null;
    }
  }

  // Main document processing function with RAG integration
  async processDocument(file, options = {}) {
    const documentId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info(`Starting RAG document processing for: ${file.originalname}`);

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Extract text from document
      const extractionResult = await this.extractText(file);

      // Save file locally
      const uploadResult = await this.saveFileLocally(file, documentId);

      // Process text for RAG
      const ragResult = await this.processForRAG(documentId, extractionResult.text, {
        filename: file.originalname,
        userId: options.userId,
        documentType: this.getDocumentType(file.mimetype),
        ...extractionResult.metadata
      });

      const processingTime = Date.now() - startTime;

      const result = {
        documentId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filePath: uploadResult.filePath,
        extractedText: extractionResult.text,
        confidence: extractionResult.confidence,
        pages: extractionResult.pages || 1,
        wordCount: this.countWords(extractionResult.text),
        processingTime,
        ragProcessing: ragResult,
        metadata: {
          language: "en",
          encoding: "UTF-8",
          createdAt: new Date().toISOString(),
          ...extractionResult.metadata,
        },
      };

      // Save document to database
      await databaseService.saveDocument({
        id: documentId,
        filename: uploadResult.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: uploadResult.filePath,
        extractedText: extractionResult.text,
        confidence: extractionResult.confidence,
        pages: extractionResult.pages || 1,
        wordCount: this.countWords(extractionResult.text),
        language: "en",
        status: "processed",
        vectorStatus: ragResult.success ? "vectorized" : "failed",
        chunkCount: ragResult.chunkCount || 0
      });

      logger.info(`Document processed successfully: ${documentId} in ${processingTime}ms`);
      return result;
    } catch (error) {
      logger.error(`Document processing failed for ${file.originalname}:`, error);
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  // Process document for RAG (chunking and vectorization)
  async processForRAG(documentId, text, metadata = {}) {
    try {
      logger.info(`Processing document ${documentId} for RAG`);

      // Clean text
      const cleanedText = this.cleanText(text);
      
      // Chunk text
      const chunks = this.chunkText(cleanedText);
      
      if (chunks.length === 0) {
        throw new Error('No valid chunks generated from document');
      }

      // Generate embeddings
      const embeddings = await embeddingService.generateBatchEmbeddings(chunks, 'gemini');
      
      // Store in Qdrant
      const storeResult = await this.storeDocumentVectorsInQdrant(
        documentId, 
        chunks, 
        embeddings, 
        metadata
      );

      logger.info(`RAG processing complete for ${documentId}: ${chunks.length} chunks vectorized`);
      
      return {
        success: true,
        chunkCount: chunks.length,
        vectorCount: embeddings.length,
        storeResult
      };
    } catch (error) {
      logger.error(`RAG processing failed for ${documentId}:`, error);
      return {
        success: false,
        error: error.message,
        chunkCount: 0
      };
    }
  }

  // Store document vectors in Qdrant
  async storeDocumentVectorsInQdrant(documentId, chunks, embeddings, metadata) {
    try {
      let storedCount = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        
        if (embedding && embedding.embedding) {
          const vectorData = {
            id: `${documentId}_chunk_${i}`,
            vector: embedding.embedding,
            metadata: {
              documentId,
              chunkIndex: i,
              content: chunk,
              ...metadata,
              createdAt: new Date().toISOString()
            }
          };
          
          const success = await qdrantService.upsertVector(vectorData);
          if (success) {
            storedCount++;
          }
        }
      }
      
      return {
        success: storedCount > 0,
        storedCount,
        totalChunks: chunks.length
      };
    } catch (error) {
      logger.error('Failed to store vectors in Qdrant:', error);
      return {
        success: false,
        error: error.message,
        storedCount: 0,
        totalChunks: chunks.length
      };
    }
  }

  // Extract text from different file types
  async extractText(file) {
    try {
      const buffer = file.buffer;
      const mimeType = file.mimetype;

      if (mimeType === "text/plain") {
        return await this.extractTextFromTXT(buffer);
      } else if (mimeType === "application/pdf") {
        return await this.extractTextFromPDF(buffer);
      } else if (mimeType.includes("word") || mimeType.includes("document")) {
        return await this.extractTextFromDOCX(buffer);
      } else if (mimeType.startsWith("image/")) {
        return await this.extractTextFromImage(buffer);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      logger.error("Text extraction failed:", error);
      throw error;
    }
  }

  // Extract text from TXT files
  async extractTextFromTXT(buffer) {
    try {
      const text = buffer.toString("utf-8");
      return {
        text,
        confidence: 1.0,
        pages: Math.ceil(text.length / 2000),
        metadata: { type: "text" },
      };
    } catch (error) {
      throw new Error(`Error reading text file: ${error.message}`);
    }
  }

  // Extract text from PDF files
  async extractTextFromPDF(buffer) {
    try {
      const pdfData = await pdfParse(buffer);
      return {
        text: pdfData.text,
        confidence: 0.9,
        pages: pdfData.numpages,
        metadata: { 
          type: "pdf",
          info: pdfData.info
        },
      };
    } catch (error) {
      throw new Error(`Error processing PDF file: ${error.message}`);
    }
  }

  // Extract text from DOCX files
  async extractTextFromDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: result.value,
        confidence: 0.9,
        pages: Math.ceil(result.value.length / 2000),
        metadata: { 
          type: "docx",
          messages: result.messages
        },
      };
    } catch (error) {
      throw new Error(`Error processing DOCX file: ${error.message}`);
    }
  }

  // Extract text from images (placeholder for OCR)
  async extractTextFromImage(buffer) {
    try {
      return {
        text: `Image File: ${buffer.length} bytes\n\nThis is an image file. OCR text extraction would be performed here in a production environment.`,
        confidence: 0.5,
        pages: 1,
        metadata: { type: "image", note: "OCR not implemented" },
      };
    } catch (error) {
      throw new Error(`Error processing image file: ${error.message}`);
    }
  }

  // Clean extracted text
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  // Chunk text for RAG processing
  chunkText(text, options = {}) {
    try {
      const {
        chunkSize = this.chunkSize,
        overlap = this.chunkOverlap
      } = options;

      if (!text || text.length < 50) {
        return [];
      }

      logger.info(`Chunking text: ${text.length} chars, chunk size: ${chunkSize}, overlap: ${overlap}`);

      const chunks = this.chunkByTokens(text, chunkSize, overlap);

      // Filter out empty or very short chunks
      const validChunks = chunks.filter(chunk => chunk.trim().length > 50);

      // Limit number of chunks
      if (validChunks.length > this.maxChunks) {
        logger.warn(`Generated ${validChunks.length} chunks, limiting to ${this.maxChunks}`);
        return validChunks.slice(0, this.maxChunks);
      }

      logger.info(`Generated ${validChunks.length} text chunks`);
      return validChunks;
    } catch (error) {
      logger.error('Error chunking text:', error);
      throw error;
    }
  }

  // Chunk text by tokens
  chunkByTokens(text, chunkSize, overlap) {
    try {
      if (this.tokenizer) {
        const tokens = this.tokenizer.encode(text);
        const chunks = [];
        
        let start = 0;
        while (start < tokens.length) {
          const end = Math.min(start + chunkSize, tokens.length);
          const chunkTokens = tokens.slice(start, end);
          const chunkText = this.tokenizer.decode(chunkTokens);
          
          if (chunkText.trim().length > 0) {
            chunks.push(chunkText.trim());
          }
          
          start = end - overlap;
          if (start >= end) break;
        }
        
        return chunks;
      } else {
        // Fallback to character-based chunking
        return this.chunkByCharacters(text, chunkSize * 4, overlap * 4);
      }
    } catch (error) {
      logger.error('Error chunking by tokens:', error);
      return this.chunkByCharacters(text, chunkSize * 4, overlap * 4);
    }
  }

  // Fallback character-based chunking
  chunkByCharacters(text, chunkSize, overlap) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastSentence, lastNewline);
        
        if (breakPoint > chunkSize * 0.7) {
          chunk = chunk.slice(0, breakPoint + 1);
        }
      }
      
      if (chunk.trim().length > 0) {
        chunks.push(chunk.trim());
      }
      
      start = start + chunk.length - overlap;
      if (start >= text.length) break;
    }
    
    return chunks;
  }

  // Count tokens in text
  countTokens(text) {
    try {
      if (this.tokenizer) {
        return this.tokenizer.encode(text).length;
      }
      return Math.ceil(text.length / 4); // Fallback estimation
    } catch (error) {
      return Math.ceil(text.length / 4);
    }
  }

  // Validate uploaded file
  validateFile(file) {
    const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

    if (!file) {
      return { isValid: false, error: "No file provided" };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${process.env.MAX_FILE_SIZE_MB || 50}MB`,
      };
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${file.mimetype}`,
      };
    }

    return { isValid: true };
  }

  // Save file locally
  async saveFileLocally(file, documentId) {
    try {
      const uploadDir = path.join(process.cwd(), "uploads", "documents");

      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      const filename = `${documentId}_${file.originalname}`;
      const filePath = path.join(uploadDir, filename);

      await fs.writeFile(filePath, file.buffer);

      return {
        filename,
        filePath,
        url: `/uploads/documents/${filename}`,
      };
    } catch (error) {
      logger.error("Failed to save file:", error);
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }

  // Count words in text
  countWords(text) {
    if (!text || typeof text !== "string") return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  // Get document type
  getDocumentType(mimeType) {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('text')) return 'text';
    return 'other';
  }

  // Process multiple documents
  async processDocuments(files, options = {}) {
    const results = {
      totalProcessed: files.length,
      successful: [],
      failed: [],
      successRate: 0,
    };

    for (const file of files) {
      try {
        const result = await this.processDocument(file, options);
        results.successful.push(result);
      } catch (error) {
        results.failed.push({
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    results.successRate = results.successful.length / results.totalProcessed;
    return results;
  }

  // Get processing status
  async getProcessingStatus(documentId) {
    try {
      const document = await databaseService.getDocument(documentId);
      if (!document) {
        return { status: "not_found", message: "Document not found" };
      }

      return {
        status: document.status,
        vectorStatus: document.vectorStatus || 'unknown',
        progress: document.status === "processed" ? 100 : 0,
        message: `Document is ${document.status}`,
        chunkCount: document.chunkCount || 0
      };
    } catch (error) {
      return { status: "error", message: error.message };
    }
  }

  // Health check
  async healthCheck() {
    return {
      status: 'healthy',
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      maxChunks: this.maxChunks,
      maxTextLength: this.maxTextLength,
      tokenizerAvailable: !!this.tokenizer
    };
  }
}

// Export singleton instance
const documentProcessor = new DocumentProcessor();

// Legacy function exports for compatibility
export async function processDocument(file, options = {}) {
  return documentProcessor.processDocument(file, options);
}

export async function processDocuments(files, options = {}) {
  return documentProcessor.processDocuments(files, options);
}

export async function getProcessingStatus(documentId) {
  return documentProcessor.getProcessingStatus(documentId);
}

export default documentProcessor;