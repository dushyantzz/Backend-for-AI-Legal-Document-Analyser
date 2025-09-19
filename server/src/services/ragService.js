import { GoogleGenerativeAI } from '@google/generative-ai';
import embeddingService from './embeddingService.js';
import pineconeService from './pineconeService.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class RAGService {
  constructor() {
    this.gemini = null;
    this.initialized = false;
    this.defaultModel = 'gemini-pro';
    this.maxContextLength = 4000;
    this.initializeClient();
  }

  /**
   * Initialize Gemini client
   */
  initializeClient() {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
      }

      this.gemini = new GoogleGenerativeAI(apiKey);
      logger.info('RAG Service: Gemini client initialized');
    } catch (error) {
      logger.error('Failed to initialize RAG service:', error);
      throw error;
    }
  }

  /**
   * Initialize all required services
   */
  async initialize() {
    try {
      logger.info('Initializing RAG service...');
      
      // Initialize Pinecone
      if (!pineconeService.initialized) {
        await pineconeService.initialize();
      }
      
      this.initialized = true;
      logger.info('RAG service fully initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize RAG service:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Process a document for RAG (called during document upload)
   */
  async processDocument(documentId, text, metadata = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Processing document ${documentId} for RAG`);

      // This is handled by the document processor
      // This method is mainly for external calls
      return {
        success: true,
        message: 'Document processing is handled by documentProcessor service'
      };
    } catch (error) {
      logger.error('Error processing document for RAG:', error);
      throw error;
    }
  }

  /**
   * Ask a question about documents
   */
  async askQuestion(question, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        documentId = null,
        userId = null,
        maxResults = 5,
        minSimilarity = 0.7,
        includeSourceText = true,
        conversationHistory = []
      } = options;

      logger.info(`Processing question: "${question.substring(0, 100)}..."`);

      // Step 1: Generate query embedding
      const queryEmbedding = await embeddingService.generateQueryEmbedding(question, 'gemini');
      
      // Step 2: Search for relevant chunks
      const searchResults = await pineconeService.searchSimilarChunks(queryEmbedding, {
        topK: maxResults * 2, // Get more results to filter
        minScore: minSimilarity,
        documentId,
        userId
      });

      if (searchResults.filteredResults === 0) {
        return {
          answer: "I couldn't find relevant information in the provided documents to answer your question. Please try rephrasing your question or ensure the document contains the information you're looking for.",
          confidence: 0.1,
          sources: [],
          metadata: {
            searchResults: 0,
            searchPerformed: true,
            documentId,
            userId
          }
        };
      }

      // Step 3: Prepare context from retrieved chunks
      const context = this.prepareContext(searchResults.matches, maxResults);
      
      // Step 4: Generate answer using Gemini
      const answer = await this.generateAnswer(question, context, conversationHistory);
      
      // Step 5: Prepare response with sources
      const sources = searchResults.matches.slice(0, maxResults).map((match, index) => ({
        chunkIndex: match.metadata?.chunkIndex || index,
        documentId: match.metadata?.documentId,
        filename: match.metadata?.filename,
        text: includeSourceText ? (match.metadata?.text || '').substring(0, 300) + '...' : undefined,
        similarity: match.score || 0,
        relevantTo: question.substring(0, 100)
      }));

      const confidence = this.calculateConfidence(searchResults.matches, answer);

      logger.info(`Generated answer with confidence ${confidence} using ${sources.length} sources`);

      return {
        answer: answer.trim(),
        confidence,
        sources,
        metadata: {
          searchResults: searchResults.totalResults,
          filteredResults: searchResults.filteredResults,
          contextLength: context.length,
          searchPerformed: true,
          documentId,
          userId,
          model: this.defaultModel
        }
      };
    } catch (error) {
      logger.error('Error answering question:', error);
      return {
        answer: `I encountered an error while processing your question: ${error.message}. Please try again or contact support if the issue persists.`,
        confidence: 0,
        sources: [],
        metadata: {
          error: error.message,
          searchPerformed: false
        }
      };
    }
  }

  /**
   * Prepare context from search results
   */
  prepareContext(matches, maxSources = 5) {
    let context = '';
    let contextLength = 0;
    const usedSources = [];

    // Sort by relevance score
    const sortedMatches = matches.sort((a, b) => (b.score || 0) - (a.score || 0));

    for (const match of sortedMatches.slice(0, maxSources)) {
      const text = match.metadata?.text || '';
      
      // Avoid very short or very long chunks
      if (text.length < 50 || text.length > 2000) {
        continue;
      }

      // Check if we have room for this chunk
      if (contextLength + text.length > this.maxContextLength) {
        // If we already have some context, stop here
        if (usedSources.length > 0) {
          break;
        }
        // Otherwise, truncate this chunk to fit
        const remainingLength = this.maxContextLength - contextLength - 100;
        if (remainingLength > 200) {
          const truncatedText = text.substring(0, remainingLength) + '...';
          context += `\n\nSource ${usedSources.length + 1}:\n${truncatedText}`;
          usedSources.push(match);
        }
        break;
      }

      context += `\n\nSource ${usedSources.length + 1}:\n${text}`;
      contextLength += text.length + 50; // Account for formatting
      usedSources.push(match);
    }

    logger.info(`Prepared context with ${usedSources.length} sources, ${contextLength} characters`);
    return context;
  }

  /**
   * Generate answer using Gemini
   */
  async generateAnswer(question, context, conversationHistory = []) {
    try {
      const model = this.gemini.getGenerativeModel({ model: this.defaultModel });

      // Prepare conversation context
      let conversationContext = '';
      if (conversationHistory.length > 0) {
        conversationContext = '\n\nPrevious conversation:\n' + 
          conversationHistory.slice(-3).map(msg => 
            `${msg.role}: ${msg.content}`
          ).join('\n');
      }

      const prompt = `You are a helpful AI assistant that answers questions based on provided document context. 
Please provide accurate, concise answers based only on the information given in the context.

Context from documents:
${context}
${conversationContext}

Question: ${question}

Instructions:
1. Answer based only on the provided context
2. If the context doesn't contain relevant information, say so clearly
3. Be concise but thorough
4. If referencing specific parts of the context, mention which source
5. Use a professional, helpful tone

Answer:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      if (!answer || answer.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }

      return answer;
    } catch (error) {
      logger.error('Error generating answer with Gemini:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Calculate confidence based on search results and answer quality
   */
  calculateConfidence(matches, answer) {
    if (!matches || matches.length === 0) {
      return 0.1;
    }

    // Base confidence on similarity scores
    const avgSimilarity = matches.reduce((sum, match) => sum + (match.score || 0), 0) / matches.length;
    
    // Adjust based on number of sources
    const sourceMultiplier = Math.min(matches.length / 3, 1);
    
    // Adjust based on answer length (very short answers might be less confident)
    const answerLengthMultiplier = answer.length < 50 ? 0.8 : 1;
    
    // Check if answer indicates uncertainty
    const uncertaintyPenalty = (
      answer.toLowerCase().includes("i don't know") ||
      answer.toLowerCase().includes("not sure") ||
      answer.toLowerCase().includes("unclear")
    ) ? 0.7 : 1;

    const confidence = avgSimilarity * sourceMultiplier * answerLengthMultiplier * uncertaintyPenalty;
    
    return Math.max(0.1, Math.min(0.99, confidence));
  }

  /**
   * Get document summary
   */
  async summarizeDocument(documentId, options = {}) {
    try {
      const { maxLength = 500, userId = null } = options;
      
      // Get document chunks
      const dummyEmbedding = new Array(768).fill(0);
      const searchResults = await pineconeService.searchSimilarChunks(dummyEmbedding, {
        topK: 20,
        minScore: 0,
        documentId,
        userId
      });

      if (searchResults.matches.length === 0) {
        return {
          summary: 'Document not found or no content available for summarization.',
          confidence: 0.1
        };
      }

      // Prepare content for summarization
      const content = searchResults.matches
        .sort((a, b) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0))
        .map(match => match.metadata?.text || '')
        .join('\n\n');

      const model = this.gemini.getGenerativeModel({ model: this.defaultModel });
      
      const prompt = `Please provide a comprehensive summary of the following document content. 
The summary should be approximately ${maxLength} characters and capture the key points, main topics, and important details.

Document content:
${content.substring(0, 8000)}

Summary:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      return {
        summary: summary.trim(),
        confidence: 0.8,
        documentId,
        chunkCount: searchResults.matches.length
      };
    } catch (error) {
      logger.error('Error summarizing document:', error);
      throw error;
    }
  }

  /**
   * Get related questions for a document
   */
  async getRelatedQuestions(documentId, options = {}) {
    try {
      const { count = 5, userId = null } = options;

      // Get some document content
      const dummyEmbedding = new Array(768).fill(0);
      const searchResults = await pineconeService.searchSimilarChunks(dummyEmbedding, {
        topK: 5,
        minScore: 0,
        documentId,
        userId
      });

      if (searchResults.matches.length === 0) {
        return {
          questions: [],
          documentId
        };
      }

      const content = searchResults.matches
        .map(match => match.metadata?.text || '')
        .join('\n\n')
        .substring(0, 2000);

      const model = this.gemini.getGenerativeModel({ model: this.defaultModel });
      
      const prompt = `Based on the following document content, generate ${count} relevant questions that someone might ask about this document. 
The questions should be specific, useful, and answerable from the content.

Document content:
${content}

Generate ${count} questions (one per line, numbered):`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const questionsText = response.text();

      const questions = questionsText
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.?\s*/, '').trim())
        .filter(q => q.length > 10)
        .slice(0, count);

      return {
        questions,
        documentId,
        chunkCount: searchResults.matches.length
      };
    } catch (error) {
      logger.error('Error generating related questions:', error);
      return {
        questions: [],
        documentId,
        error: error.message
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      ragService: false,
      gemini: false,
      embedding: false,
      pinecone: false,
      initialized: this.initialized
    };

    try {
      // Check Gemini
      if (this.gemini) {
        const model = this.gemini.getGenerativeModel({ model: this.defaultModel });
        const result = await model.generateContent('Hello');
        await result.response;
        health.gemini = true;
      }

      // Check embedding service
      const embeddingHealth = await embeddingService.healthCheck();
      health.embedding = embeddingHealth.gemini || embeddingHealth.openai;

      // Check Pinecone
      const pineconeHealth = await pineconeService.healthCheck();
      health.pinecone = pineconeHealth.status === 'healthy';

      health.ragService = health.gemini && health.embedding && health.pinecone;

      return health;
    } catch (error) {
      logger.error('RAG service health check failed:', error);
      return {
        ...health,
        error: error.message
      };
    }
  }
}

export default new RAGService();