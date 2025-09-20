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

    try {
      logger.info('Connecting to Qdrant...');
      
      this.client = new QdrantClient({
        url: url,
        apiKey: apiKey,
        checkCompatibility: false // Skip version check for cloud instances
      });

      // Test connection by getting collections info
      await this.client.getCollections();
      
      logger.info(`✅ Qdrant connected successfully`);
    } catch (error) {
      logger.error('Qdrant connection failed:', {
        message: error.message,
        url: url,
        apiKeyPresent: !!apiKey,
        collectionName: this.collectionName,
        errorType: error.constructor.name
      });
      
      logger.warn('⚠️  Qdrant unavailable - RAG features will use local storage only');
      this.initialized = false;
      // Don't throw error - allow server to continue without Qdrant
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
      
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: id,
          vector: vector,
          payload: metadata
        }]
      });

      logger.debug(`Vector upserted: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to upsert vector:', error.message);
      return false;
    }
  }

  async searchSimilarVectors(queryVector, limit = 5, scoreThreshold = 0.7) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit: limit,
        with_payload: true,
        score_threshold: scoreThreshold
      });

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
