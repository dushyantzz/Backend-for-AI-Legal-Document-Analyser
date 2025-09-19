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
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536;
  }

  /**
   * Initialize Pinecone client and index
   */
  async initialize() {
    try {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT
      });

      // Check if index exists, create if not
      await this.ensureIndexExists();
      
      this.index = this.pinecone.index(this.indexName);
      logger.info(`Pinecone service initialized with index: ${this.indexName}`);
    } catch (error) {
      logger.error('Failed to initialize Pinecone service:', error);
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
    const maxRetries = 30;
    
    while (retries < maxRetries) {
      try {
        const indexStats = await this.index.describeIndexStats();
        if (indexStats) {
          logger.info(`Index ${this.indexName} is ready`);
          return;
        }
      } catch (error) {
        logger.info(`Waiting for index to be ready... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries++;
      }
    }
    
    throw new Error(`Index ${this.indexName} did not become ready after ${maxRetries} retries`);
  }

  /**
   * Store document vectors in Pinecone
   */
  async storeDocumentVectors(documentId, chunks, embeddings, metadata = {}) {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      if (chunks.length !== embeddings.length) {
        throw new Error('Chunks and embeddings arrays must have the same length');
      }

      const vectors = chunks.map((chunk, index) => ({
        id: `${documentId}_chunk_${index}_${uuidv4()}`,
        values: embeddings[index],
        metadata: {
          documentId,
          chunkIndex: index,
          text: chunk,
          ...metadata,
          timestamp: new Date().toISOString()
        }
      }));

      // Upsert vectors in batches to avoid rate limits
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        logger.info(`Stored batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(vectors.length / batchSize)} for document ${documentId}`);
      }

      logger.info(`Successfully stored ${vectors.length} vectors for document ${documentId}`);
      return {
        success: true,
        vectorCount: vectors.length,
        documentId
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
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const {
        topK = parseInt(process.env.RETRIEVAL_K) || 5,
        filter = {},
        includeMetadata = true,
        includeValues = false,
        minScore = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7
      } = options;

      const queryRequest = {
        vector: queryEmbedding,
        topK,
        includeMetadata,
        includeValues
      };

      // Add filter if provided
      if (Object.keys(filter).length > 0) {
        queryRequest.filter = filter;
      }

      const searchResults = await this.index.query(queryRequest);
      
      // Filter by minimum score
      const filteredResults = searchResults.matches.filter(
        match => match.score >= minScore
      );

      logger.info(`Found ${filteredResults.length} similar chunks above threshold ${minScore}`);
      
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
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

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
   * Get index statistics
   */
  async getIndexStats() {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      logger.error('Error getting index stats:', error);
      throw error;
    }
  }

  /**
   * List all document IDs in the index
   */
  async listDocuments() {
    try {
      if (!this.index) {
        throw new Error('Pinecone service not initialized');
      }

      // Query with empty vector to get all documents (not ideal for production)
      // In production, maintain a separate metadata store
      const dummyVector = new Array(this.dimension).fill(0);
      const results = await this.index.query({
        vector: dummyVector,
        topK: 10000, // Adjust based on your needs
        includeMetadata: true
      });

      const uniqueDocuments = new Set();
      results.matches.forEach(match => {
        if (match.metadata?.documentId) {
          uniqueDocuments.add(match.metadata.documentId);
        }
      });

      return Array.from(uniqueDocuments);
    } catch (error) {
      logger.error('Error listing documents:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const stats = await this.getIndexStats();
      return {
        status: 'healthy',
        indexName: this.indexName,
        vectorCount: stats.totalVectorCount || 0,
        dimension: this.dimension
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export default new PineconeService();