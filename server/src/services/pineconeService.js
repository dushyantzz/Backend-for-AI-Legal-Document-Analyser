import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';
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

class PineconeService {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'legal-documents';
    this.dimension = 768; // Gemini embedding dimensions
    this.initialized = false;
  }

  /**
   * Initialize Pinecone client and index
   */
  async initialize() {
    try {
      if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY environment variable is required');
      }

      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      // Check if index exists, create if not
      await this.ensureIndexExists();
      
      this.index = this.pinecone.index(this.indexName);
      this.initialized = true;
      
      logger.info(`Pinecone service initialized with index: ${this.indexName}`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize Pinecone service:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Ensure the Pinecone index exists
   */
  async ensureIndexExists() {
    try {
      const existingIndexes = await this.pinecone.listIndexes();
      const indexExists = existingIndexes.indexes?.some(
        index => index.name === this.indexName
      );

      if (!indexExists) {
        logger.info(`Creating new Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        await this.waitForIndexReady();
      } else {
        logger.info(`Index ${this.indexName} already exists`);
      }
    } catch (error) {
      logger.error('Error ensuring index exists:', error);
      throw error;
    }
  }

  /**
   * Wait for index to be ready
   */
  async waitForIndexReady() {
    let retries = 0;
    const maxRetries = 60; // Increased for serverless
    
    while (retries < maxRetries) {
      try {
        const indexStats = await this.index.describeIndexStats();
        if (indexStats) {
          logger.info(`Index ${this.indexName} is ready`);
          return;
        }
      } catch (error) {
        logger.info(`Waiting for index to be ready... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        retries++;
      }
    }
    
    logger.warn(`Index ${this.indexName} may not be fully ready after ${maxRetries} retries, proceeding anyway`);
  }

  /**
   * Check if service is initialized
   */
  ensureInitialized() {
    if (!this.initialized || !this.index) {
      throw new Error('Pinecone service not initialized. Call initialize() first.');
    }
  }

  /**
   * Store document vectors in Pinecone
   */
  async storeDocumentVectors(documentId, chunks, embeddings, metadata = {}) {
    try {
      this.ensureInitialized();

      if (!documentId) {
        throw new Error('Document ID is required');
      }

      if (!chunks || !embeddings) {
        throw new Error('Chunks and embeddings are required');
      }

      if (chunks.length !== embeddings.length) {
        throw new Error(`Chunks (${chunks.length}) and embeddings (${embeddings.length}) arrays must have the same length`);
      }

      if (chunks.length === 0) {
        throw new Error('No chunks provided for vectorization');
      }

      logger.info(`Storing ${chunks.length} vectors for document ${documentId}`);

      const vectors = chunks.map((chunk, index) => {
        const embedding = embeddings[index];
        
        // Validate embedding
        if (!Array.isArray(embedding) || embedding.length !== this.dimension) {
          throw new Error(`Invalid embedding at index ${index}: expected array of length ${this.dimension}, got ${typeof embedding} of length ${embedding?.length}`);
        }

        return {
          id: `${documentId}_chunk_${index}_${uuidv4()}`,
          values: embedding,
          metadata: {
            documentId,
            chunkIndex: index,
            text: chunk.substring(0, 40000), // Pinecone metadata size limit
            chunkLength: chunk.length,
            ...metadata,
            timestamp: new Date().toISOString()
          }
        };
      });

      // Upsert vectors in batches to avoid rate limits
      const batchSize = 100;
      let storedCount = 0;
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        
        try {
          await this.index.upsert(batch);
          storedCount += batch.length;
          logger.info(`Stored batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(vectors.length / batchSize)} (${storedCount}/${vectors.length} vectors) for document ${documentId}`);
          
          // Small delay between batches
          if (i + batchSize < vectors.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (batchError) {
          logger.error(`Failed to store batch ${Math.floor(i / batchSize) + 1}:`, batchError);
          throw batchError;
        }
      }

      logger.info(`Successfully stored ${storedCount} vectors for document ${documentId}`);
      return {
        success: true,
        vectorCount: storedCount,
        documentId,
        batchesProcessed: Math.ceil(vectors.length / batchSize)
      };
    } catch (error) {
      logger.error('Error storing document vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async searchSimilarChunks(queryEmbedding, options = {}) {
    try {
      this.ensureInitialized();

      if (!Array.isArray(queryEmbedding)) {
        throw new Error('Query embedding must be an array');
      }

      if (queryEmbedding.length !== this.dimension) {
        throw new Error(`Query embedding dimension (${queryEmbedding.length}) doesn't match index dimension (${this.dimension})`);
      }

      const {
        topK = parseInt(process.env.RETRIEVAL_K) || 5,
        filter = {},
        includeMetadata = true,
        includeValues = false,
        minScore = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7,
        documentId = null,
        userId = null
      } = options;

      // Build filter
      const queryFilter = { ...filter };
      if (documentId) {
        queryFilter.documentId = { $eq: documentId };
      }
      if (userId) {
        queryFilter.userId = { $eq: userId };
      }

      const queryRequest = {
        vector: queryEmbedding,
        topK: Math.min(topK, 100), // Pinecone limit
        includeMetadata,
        includeValues
      };

      // Add filter if provided
      if (Object.keys(queryFilter).length > 0) {
        queryRequest.filter = queryFilter;
      }

      logger.info(`Searching for similar chunks with topK=${topK}, minScore=${minScore}`);
      
      const searchResults = await this.index.query(queryRequest);
      
      if (!searchResults.matches) {
        logger.warn('No matches returned from Pinecone query');
        return {
          matches: [],
          totalResults: 0,
          filteredResults: 0
        };
      }
      
      // Filter by minimum score
      const filteredResults = searchResults.matches.filter(
        match => match.score >= minScore
      );

      logger.info(`Found ${searchResults.matches.length} total matches, ${filteredResults.length} above threshold ${minScore}`);
      
      return {
        matches: filteredResults,
        totalResults: searchResults.matches.length,
        filteredResults: filteredResults.length
      };
    } catch (error) {
      logger.error('Error searching similar chunks:', error);
      throw error;
    }
  }

  /**
   * Delete document vectors
   */
  async deleteDocumentVectors(documentId) {
    try {
      this.ensureInitialized();

      if (!documentId) {
        throw new Error('Document ID is required');
      }

      logger.info(`Deleting vectors for document ${documentId}`);
      
      // Delete by metadata filter
      await this.index.deleteMany({
        filter: {
          documentId: { $eq: documentId }
        }
      });

      logger.info(`Deleted vectors for document ${documentId}`);
      return { success: true, documentId };
    } catch (error) {
      logger.error('Error deleting document vectors:', error);
      throw error;
    }
  }

  /**
   * Delete vectors by user ID
   */
  async deleteUserVectors(userId) {
    try {
      this.ensureInitialized();

      if (!userId) {
        throw new Error('User ID is required');
      }

      logger.info(`Deleting vectors for user ${userId}`);
      
      await this.index.deleteMany({
        filter: {
          userId: { $eq: userId }
        }
      });

      logger.info(`Deleted vectors for user ${userId}`);
      return { success: true, userId };
    } catch (error) {
      logger.error('Error deleting user vectors:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats() {
    try {
      this.ensureInitialized();
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      logger.error('Error getting index stats:', error);
      throw error;
    }
  }

  /**
   * List documents for a user
   */
  async listUserDocuments(userId, limit = 50) {
    try {
      this.ensureInitialized();

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Query with zero vector to get documents by metadata filter
      const zeroVector = new Array(this.dimension).fill(0);
      
      const results = await this.index.query({
        vector: zeroVector,
        topK: limit,
        includeMetadata: true,
        filter: {
          userId: { $eq: userId }
        }
      });

      const uniqueDocuments = new Map();
      
      results.matches?.forEach(match => {
        const docId = match.metadata?.documentId;
        if (docId && !uniqueDocuments.has(docId)) {
          uniqueDocuments.set(docId, {
            documentId: docId,
            filename: match.metadata?.filename,
            documentType: match.metadata?.documentType,
            timestamp: match.metadata?.timestamp
          });
        }
      });

      return Array.from(uniqueDocuments.values());
    } catch (error) {
      logger.error('Error listing user documents:', error);
      throw error;
    }
  }

  /**
   * Get document chunk count
   */
  async getDocumentChunkCount(documentId) {
    try {
      this.ensureInitialized();

      const stats = await this.getIndexStats();
      
      // This is an approximation since Pinecone doesn't provide exact counts by filter
      // In production, you might want to store this in your database
      return {
        documentId,
        estimatedChunkCount: stats.totalVectorCount || 0
      };
    } catch (error) {
      logger.error('Error getting document chunk count:', error);
      return {
        documentId,
        estimatedChunkCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'unhealthy',
          error: 'Service not initialized',
          indexName: this.indexName,
          dimension: this.dimension
        };
      }

      const stats = await this.getIndexStats();
      return {
        status: 'healthy',
        indexName: this.indexName,
        vectorCount: stats.totalVectorCount || 0,
        dimension: this.dimension,
        namespaces: stats.namespaces || {}
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        indexName: this.indexName,
        dimension: this.dimension
      };
    }
  }

  /**
   * Clear all vectors (use with caution)
   */
  async clearAllVectors() {
    try {
      this.ensureInitialized();
      
      logger.warn('Clearing all vectors from index');
      await this.index.deleteAll();
      
      logger.info('All vectors cleared from index');
      return { success: true };
    } catch (error) {
      logger.error('Error clearing all vectors:', error);
      throw error;
    }
  }
}

export default new PineconeService();