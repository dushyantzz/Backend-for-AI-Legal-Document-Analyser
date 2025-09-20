import logger from '../utils/logger.js';
import embeddingService from './embeddingService.js';
import qdrantService from './qdrantService.js';
import databaseService from './databaseService.js';

class RAGService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
    
    logger.info('RAGService created (not initialized yet)');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeClient();
      this.initialized = true;
      logger.info('✅ RAGService initialized successfully');
    } catch (error) {
      logger.warn('⚠️  RAG Service: No API key provided - RAG functionality will be disabled');
    }
  }

  async initializeClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      logger.warn('⚠️  No Gemini API key found');
      return;
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' 
      });
      logger.info('✅ Gemini client initialized for RAG');
    } catch (error) {
      logger.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async processDocument(documentId, content, metadata = {}) {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('RAG service not available - check API keys');
    }

    try {
      logger.info(`Processing document ${documentId} for RAG`);

      const chunks = embeddingService.chunkText(
        content,
        parseInt(process.env.CHUNK_SIZE) || 1000,
        parseInt(process.env.CHUNK_OVERLAP) || 200
      );

      logger.info(`Generated ${chunks.length} chunks for document ${documentId}`);

      const processedChunks = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          const embeddingResult = await embeddingService.generateEmbedding(chunk.text);
          
          const chunkData = {
            id: `${documentId}_chunk_${i}`,
            vector: embeddingResult.embedding,
            metadata: {
              documentId,
              chunkIndex: i,
              content: chunk.text,
              startPosition: chunk.start,
              endPosition: chunk.end,
              ...metadata,
              createdAt: new Date().toISOString()
            }
          };

          await qdrantService.upsertVector(chunkData);
          processedChunks.push(chunkData);
          
        } catch (error) {
          logger.error(`Failed to process chunk ${i} for document ${documentId}:`, error);
        }
      }

      logger.info(`Successfully processed ${processedChunks.length}/${chunks.length} chunks for document ${documentId}`);
      
      return {
        documentId,
        totalChunks: chunks.length,
        processedChunks: processedChunks.length,
        failed: chunks.length - processedChunks.length
      };

    } catch (error) {
      logger.error(`Failed to process document ${documentId}:`, error);
      throw error;
    }
  }

  async queryDocuments(query, options = {}) {
    await this.ensureInitialized();
    
    // Always try to provide a response, even if RAG service has issues
    if (!this.isAvailable()) {
      logger.warn('RAG service not fully available, using fallback mode');
    }

    logger.info(`RAG queryDocuments called with query: "${query}", options:`, options);

    const {
      documentId = null,
      userId = null,
      maxResults = 5,
      minSimilarity = 0.7
    } = options;

    try {
      logger.info(`Processing RAG query: ${query.substring(0, 100)}...`);

      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      const searchOptions = {
        topK: maxResults,
        includeMetadata: true,
        filter: {}
      };

      if (documentId) {
        searchOptions.filter = {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId
              }
            }
          ]
        };
      }

      if (userId) {
        searchOptions.filter.must = searchOptions.filter.must || [];
        searchOptions.filter.must.push({
          key: 'userId',
          match: {
            value: userId
          }
        });
      }

      const searchResults = await qdrantService.searchSimilarVectors(
        queryEmbedding.embedding,
        searchOptions.topK,
        searchOptions.minSimilarity || minSimilarity,
        Object.keys(searchOptions.filter).length > 0 ? searchOptions.filter : null
      );

      const relevantChunks = searchResults
        ?.filter(match => match.score >= minSimilarity)
        ?.map(match => ({
          content: match.metadata?.content || '',
          score: match.score,
          documentId: match.metadata?.documentId,
          chunkIndex: match.metadata?.chunkIndex,
          metadata: match.metadata
        })) || [];

      if (relevantChunks.length === 0) {
        logger.warn(`No relevant chunks found for query: ${query}, trying fallback method`);
        
        // Fallback: Get document content from database and generate response
        if (documentId) {
          try {
            const document = await databaseService.getDocumentById(documentId);
            if (document && document.extracted_text) {
              const content = document.extracted_text;
              
              logger.info(`Using fallback method with document content (${content.length} chars)`);
              
              // Generate response using the full document content
              const response = await this.generateResponse(query, content);
              return {
                response: response.text,
                sources: [{
                  documentId: documentId,
                  content: content.substring(0, 200) + '...',
                  similarity: 0.6, // Medium confidence for fallback
                  metadata: { fallback: true, method: 'database' }
                }],
                confidence: 0.6,
                processingTime: response.processingTime
              };
            } else {
              logger.warn(`Document ${documentId} not found in database or has no extracted text`);
            }
          } catch (fallbackError) {
            logger.error('Fallback method failed:', fallbackError);
          }
        }
        
        // Final fallback: Generate a generic response using Gemini
        try {
          const genericResponse = await this.generateResponse(query, "You are a helpful legal document assistant. Please provide a helpful response to the user's question about legal documents.");
          return {
            response: genericResponse.text,
            sources: [],
            confidence: 0.3,
            processingTime: genericResponse.processingTime
          };
        } catch (error) {
          logger.error('Final fallback failed:', error);
          return {
            response: "I'm having trouble processing your question right now. Please try again in a moment.",
            sources: [],
            confidence: 0.1,
            processingTime: 0
          };
        }
      }

      const context = relevantChunks
        .map(chunk => chunk.content)
        .join('\n\n');

      const response = await this.generateResponse(query, context);

      return {
        response: response.text,
        sources: relevantChunks.map(chunk => ({
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.substring(0, 200) + '...',
          similarity: chunk.score,
          metadata: chunk.metadata
        })),
        confidence: this.calculateConfidence(relevantChunks),
        processingTime: response.processingTime
      };

    } catch (error) {
      logger.error('RAG query failed:', error);
      throw error;
    }
  }

  async generateResponse(query, context) {
    const startTime = Date.now();
    
    const prompt = `
You are a helpful AI assistant that answers questions based on provided document context.

Context from documents:
${context}

Question: ${query}

Instructions:
- Answer the question using only the information provided in the context
- Be concise and accurate
- If the context doesn't contain enough information to answer the question, say so
- Cite specific parts of the context when relevant
- Do not make up information not present in the context

Answer:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        text: response.text(),
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Failed to generate response:', error);
      throw new Error(`Response generation failed: ${error.message}`);
    }
  }

  calculateConfidence(chunks) {
    if (!chunks || chunks.length === 0) return 0;
    
    const avgScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;
    const maxScore = Math.max(...chunks.map(chunk => chunk.score));
    
    return Math.round((avgScore * 0.7 + maxScore * 0.3) * 100) / 100;
  }

  async deleteDocumentVectors(documentId) {
    try {
      await qdrantService.deleteVectorsByFilter({
        must: [
          {
            key: 'documentId',
            match: {
              value: documentId
            }
          }
        ]
      });
      
      logger.info(`Deleted vectors for document ${documentId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete vectors for document ${documentId}:`, error);
      throw error;
    }
  }

  isAvailable() {
    return this.initialized && this.model && embeddingService.isAvailable() && qdrantService.isAvailable();
  }

  getStatus() {
    return {
      ragService: this.initialized && !!this.model,
      embeddingService: embeddingService.isAvailable(),
      qdrantService: qdrantService.isAvailable(),
      availableProviders: embeddingService.getAvailableProviders()
    };
  }
}

const ragService = new RAGService();

export default ragService;
