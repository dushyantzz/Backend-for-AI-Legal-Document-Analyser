import { QdrantClient } from '@qdrant/js-client-rest';
import logger from '../utils/logger.js';

class QdrantService {
  constructor() {
    this.client = null;
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'legal';
    this.initialized = false;
    this.vectorSize = 768; // Default embedding size for most models
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeClient();
      await this.ensureCollection();
      this.initialized = true;
      logger.info('✅ QdrantService initialized successfully');
    } catch (error) {
      logger.error('❌ QdrantService failed:', error.message);
      logger.warn('⚠️  Qdrant unavailable - RAG features will use local storage only');
      // Don't throw error - allow server to continue without Qdrant
      this.initialized = false;
    }
  }

  async initializeClient() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    
    if (!url || !apiKey) {
      logger.warn('⚠️  Qdrant URL or API key not found');
      return;
    }

    // Retry connection logic
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        logger.info(`Connecting to Qdrant... (attempt ${retryCount + 1}/${maxRetries})`);
        
        this.client = new QdrantClient({
          url: url,
          apiKey: apiKey,
          checkCompatibility: false, // Skip version check for cloud instances
          timeout: 15000 // Increased timeout
        });

        // Test connection by getting collections info
        await this.client.getCollections();
        
        this.initialized = true;
        logger.info(`✅ Qdrant connected successfully`);
        break;
      } catch (error) {
        retryCount++;
        logger.error(`Qdrant connection failed (attempt ${retryCount}/${maxRetries}):`, {
          message: error.message,
          url: url,
          apiKeyPresent: !!apiKey,
          collectionName: this.collectionName,
          errorType: error.constructor.name
        });
        
        if (retryCount >= maxRetries) {
          logger.warn('⚠️  Qdrant unavailable after all retry attempts - RAG features will use local storage only');
          this.initialized = false;
          break;
        } else {
          logger.info(`Retrying Qdrant connection in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  async ensureCollection() {
    if (!this.initialized) {
      logger.warn('⚠️  Qdrant not initialized, skipping collection check');
      return;
    }
    
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        logger.info(`Creating Qdrant collection: ${this.collectionName}`);
        
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine'
          }
        });
        
        logger.info(`✅ Collection '${this.collectionName}' created successfully`);
      } else {
        logger.info(`✅ Collection '${this.collectionName}' already exists`);
      }
    } catch (error) {
      logger.error('Failed to ensure collection:', error.message);
      // Don't throw error - allow server to continue
    }
  }

  async upsertVector(vectorData) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const { id, vector, metadata } = vectorData;
      
      // Convert string ID to integer for Qdrant
      const numericId = Math.abs(id.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0));
      
      // Add timeout to prevent hanging
      const upsertPromise = this.client.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: numericId,
          vector: vector,
          payload: metadata
        }]
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upsert timeout')), 15000)
      );
      
      await Promise.race([upsertPromise, timeoutPromise]);

      logger.debug(`Vector upserted: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to upsert vector:', {
        message: error.message,
        vectorLength: vectorData.vector ? vectorData.vector.length : 'undefined',
        id: vectorData.id,
        collectionName: this.collectionName
      });
      return false;
    }
  }

  async searchSimilarVectors(queryVector, limit = 5, scoreThreshold = 0.7, filter = null) {
    if (!this.isAvailable()) {
      logger.warn('Qdrant not available for search');
      return [];
    }

    try {
      logger.debug(`Searching Qdrant with vector length: ${queryVector.length}, limit: ${limit}, threshold: ${scoreThreshold}, filter:`, filter);
      
      const searchOptions = {
        vector: queryVector,
        limit: limit,
        with_payload: true,
        score_threshold: scoreThreshold
      };

      if (filter) {
        searchOptions.filter = filter;
      }
      
      // Add timeout to prevent hanging
      const searchPromise = this.client.search(this.collectionName, searchOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 10000)
      );
      
      const searchResult = await Promise.race([searchPromise, timeoutPromise]);
      
      logger.debug(`Qdrant search returned ${searchResult.length} results`);

      return searchResult.map(result => ({
        id: result.id,
        score: result.score,
        metadata: result.payload
      }));
    } catch (error) {
      logger.error('Failed to search vectors:', error.message);
      return [];
    }
  }

  async deleteVector(vectorId) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [vectorId]
      });

      logger.debug(`Vector deleted: ${vectorId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete vector:', error.message);
      return false;
    }
  }

  async deleteVectorsByFilter(filter) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: filter
      });

      logger.debug('Vectors deleted by filter');
      return true;
    } catch (error) {
      logger.error('Failed to delete vectors by filter:', error.message);
      return false;
    }
  }

  async getCollectionInfo() {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        name: info.collection_name,
        pointsCount: info.points_count,
        vectorsCount: info.vectors_count,
        indexedVectorsCount: info.indexed_vectors_count
      };
    } catch (error) {
      logger.error('Failed to get collection info:', error.message);
      return null;
    }
  }

  isAvailable() {
    return this.initialized && this.client !== null;
  }

  async healthCheck() {
    if (!this.isAvailable()) {
      return { status: 'unavailable', reason: 'Not initialized' };
    }

    try {
      await this.client.getCollections();
      const info = await this.getCollectionInfo();
      return { 
        status: 'healthy', 
        collection: info 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        reason: error.message 
      };
    }
  }
}

// Export singleton instance
export default new QdrantService();
