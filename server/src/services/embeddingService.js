import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';
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

class EmbeddingService {
  constructor() {
    this.openai = null;
    this.cohere = null;
    this.defaultModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536;
    this.initializeClients();
  }

  /**
   * Initialize AI clients
   */
  initializeClients() {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.info('OpenAI client initialized for embeddings');
      }

      if (process.env.COHERE_API_KEY) {
        this.cohere = new CohereClient({
          apiKey: process.env.COHERE_API_KEY
        });
        logger.info('Cohere client initialized for embeddings');
      }

      if (!this.openai && !this.cohere) {
        throw new Error('No embedding service API keys provided');
      }
    } catch (error) {
      logger.error('Failed to initialize embedding clients:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateOpenAIEmbedding(text, model = this.defaultModel) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.embeddings.create({
        model: model,
        input: text,
        dimensions: this.dimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating OpenAI embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Cohere
   */
  async generateCohereEmbedding(text, model = 'embed-english-v3.0') {
    try {
      if (!this.cohere) {
        throw new Error('Cohere client not initialized');
      }

      const response = await this.cohere.embed({
        texts: [text],
        model: model,
        inputType: 'search_document'
      });

      return response.embeddings[0];
    } catch (error) {
      logger.error('Error generating Cohere embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts, provider = 'openai', options = {}) {
    try {
      const {
        batchSize = 100,
        model = this.defaultModel,
        delay = 100
      } = options;

      const allEmbeddings = [];
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        logger.info(`Processing embedding batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(texts.length / batchSize)}`);
        
        let batchEmbeddings;
        
        if (provider === 'openai') {
          batchEmbeddings = await this.processOpenAIBatch(batch, model);
        } else if (provider === 'cohere') {
          batchEmbeddings = await this.procesCohereBatch(batch, model);
        } else {
          throw new Error(`Unsupported embedding provider: ${provider}`);
        }
        
        allEmbeddings.push(...batchEmbeddings);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < texts.length && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      logger.info(`Generated ${allEmbeddings.length} embeddings using ${provider}`);
      return allEmbeddings;
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Process OpenAI batch
   */
  async processOpenAIBatch(texts, model) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.embeddings.create({
        model: model,
        input: texts,
        dimensions: this.dimensions
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Error processing OpenAI batch:', error);
      throw error;
    }
  }

  /**
   * Process Cohere batch
   */
  async procesCohereBatch(texts, model = 'embed-english-v3.0') {
    try {
      if (!this.cohere) {
        throw new Error('Cohere client not initialized');
      }

      const response = await this.cohere.embed({
        texts: texts,
        model: model,
        inputType: 'search_document'
      });

      return response.embeddings;
    } catch (error) {
      logger.error('Error processing Cohere batch:', error);
      throw error;
    }
  }

  /**
   * Generate query embedding (optimized for search)
   */
  async generateQueryEmbedding(query, provider = 'openai') {
    try {
      logger.info(`Generating query embedding using ${provider}`);
      
      if (provider === 'openai') {
        return await this.generateOpenAIEmbedding(query);
      } else if (provider === 'cohere') {
        // For Cohere, use search_query input type for queries
        const response = await this.cohere.embed({
          texts: [query],
          model: 'embed-english-v3.0',
          inputType: 'search_query'
        });
        return response.embeddings[0];
      } else {
        throw new Error(`Unsupported embedding provider: ${provider}`);
      }
    } catch (error) {
      logger.error('Error generating query embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    try {
      if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimension');
      }

      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] ** 2;
        norm2 += embedding2[i] ** 2;
      }

      norm1 = Math.sqrt(norm1);
      norm2 = Math.sqrt(norm2);

      if (norm1 === 0 || norm2 === 0) {
        return 0;
      }

      return dotProduct / (norm1 * norm2);
    } catch (error) {
      logger.error('Error calculating cosine similarity:', error);
      throw error;
    }
  }

  /**
   * Get embedding dimensions for a given model
   */
  getEmbeddingDimensions(model = this.defaultModel) {
    const dimensionMap = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
      'embed-english-v3.0': 1024,
      'embed-multilingual-v3.0': 1024
    };

    return dimensionMap[model] || this.dimensions;
  }

  /**
   * Health check for embedding services
   */
  async healthCheck() {
    const health = {
      openai: false,
      cohere: false,
      defaultModel: this.defaultModel,
      dimensions: this.dimensions
    };

    try {
      if (this.openai) {
        // Test with a simple embedding
        await this.generateOpenAIEmbedding('test');
        health.openai = true;
      }
    } catch (error) {
      logger.warn('OpenAI embedding health check failed:', error.message);
    }

    try {
      if (this.cohere) {
        // Test with a simple embedding
        await this.generateCohereEmbedding('test');
        health.cohere = true;
      }
    } catch (error) {
      logger.warn('Cohere embedding health check failed:', error.message);
    }

    return health;
  }
}

export default new EmbeddingService();