import logger from '../utils/logger.js';

class PineconeService {
  constructor() {
    this.client = null;
    this.index = null;
    this.initialized = false;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'legal-documents';
    this.dimension = 1024; // Updated to match your index
    
    logger.info('PineconeService created (not initialized yet)');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeClient();
      this.initialized = true;
      logger.info('✅ PineconeService initialized successfully');
    } catch (error) {
      logger.warn('⚠️  PineconeService initialization failed:', error.message);
    }
  }

  async initializeClient() {
    const apiKey = process.env.PINECONE_API_KEY;
    
    if (!apiKey) {
      logger.warn('⚠️  No Pinecone API key found');
      return;
    }

    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      
      // Initialize with the new Pinecone client (no environment needed)
      this.client = new Pinecone({
        apiKey: apiKey
      });

      // Get the existing index (don't try to create it)
      this.index = this.client.index(this.indexName);
      
      // Test the connection
      await this.testConnection();
      
      logger.info(`✅ Pinecone service connected to index: ${this.indexName}`);
    } catch (error) {
      logger.error('Failed to initialize Pinecone client:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      // Try to get index stats to verify connection
      const stats = await this.index.describeIndexStats();
      logger.info(`✅ Pinecone connection verified. Total vectors: ${stats.totalVectorCount || 0}`);
      return true;
    } catch (error) {
      logger.error('Pinecone connection test failed:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async upsertVector(vectorData) {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('Pinecone service not available');
    }

    try {
      // Ensure vector has correct dimensions
      if (vectorData.values.length !== this.dimension) {
        throw new Error(`Vector dimension mismatch. Expected ${this.dimension}, got ${vectorData.values.length}`);
      }

      await this.index.upsert([vectorData]);
      logger.debug(`Vector upserted: ${vectorData.id}`);
      return true;
    } catch (error) {
      logger.error(`Failed to upsert vector ${vectorData.id}:`, error);
      throw error;
    }
  }

  async upsertVectors(vectors) {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('Pinecone service not available');
    }

    try {
      // Validate all vectors
      for (const vector of vectors) {
        if (vector.values.length !== this.dimension) {
          throw new Error(`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.values.length}`);
        }
      }

      const batchSize = 100;
      let totalUpserted = 0;
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
        totalUpserted += batch.length;
        logger.debug(`Batch upserted: ${totalUpserted}/${vectors.length}`);
      }

      logger.info(`✅ Successfully upserted ${totalUpserted} vectors`);
      return true;
    } catch (error) {
      logger.error('Failed to upsert vectors:', error);
      throw error;
    }
  }

  async queryVectors(queryVector, options = {}) {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('Pinecone service not available');
    }

    // Validate query vector dimensions
    if (queryVector.length !== this.dimension) {
      throw new Error(`Query vector dimension mismatch. Expected ${this.dimension}, got ${queryVector.length}`);
    }

    const {
      topK = 5,
      includeMetadata = true,
      includeValues = false,
      filter = {}
    } = options;

    try {
      const queryResponse = await this.index.query({
        vector: queryVector,
        topK,
        includeMetadata,
        includeValues,
        filter: Object.keys(filter).length > 0 ? filter : undefined
      });

      return queryResponse;
    } catch (error) {
      logger.error('Failed to query vectors:', error);
      throw error;
    }
  }

  async deleteVectors(options = {}) {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('Pinecone service not available');
    }

    try {
      if (options.ids) {
        await this.index.deleteMany(options.ids);
        logger.info(`Deleted ${options.ids.length} vectors by ID`);
      } else if (options.filter) {
        await this.index.deleteMany({
          filter: options.filter
        });
        logger.info('Deleted vectors by filter');
      } else {
        throw new Error('Must provide either ids or filter for deletion');
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete vectors:', error);
      throw error;
    }
  }

  async getIndexStats() {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      logger.error('Failed to get index stats:', error);
      return null;
    }
  }

  isAvailable() {
    return this.initialized && this.client && this.index;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      indexName: this.indexName,
      dimension: this.dimension,
      available: this.isAvailable()
    };
  }

  getDimensions() {
    return this.dimension;
  }
}

const pineconeService = new PineconeService();

export default pineconeService;
