import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
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
    this.gemini = null;
    this.openai = null;
    this.defaultProvider = 'gemini';
    this.dimensions = 768; // Gemini embedding dimensions
    this.initializeClients();
  }

  /**
   * Initialize AI clients
   */
  initializeClients() {
    try {
      // Initialize Gemini
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        this.gemini = new GoogleGenerativeAI(apiKey);
        logger.info('Gemini client initialized for embeddings');
      }

      // Initialize OpenAI as fallback
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.info('OpenAI client initialized for embeddings');
      }

      if (!this.gemini && !this.openai) {
        throw new Error('No embedding service API keys provided');
      }
    } catch (error) {
      logger.error('Failed to initialize embedding clients:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Gemini
   */
  async generateGeminiEmbedding(text) {
    try {
      if (!this.gemini) {
        throw new Error('Gemini client not initialized');
      }

      const model = this.gemini.getGenerativeModel({ model: 'embedding-001' });
      const result = await model.embedContent(text);
      
      return result.embedding.values;
    } catch (error) {
      logger.error('Error generating Gemini embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateOpenAIEmbedding(text, model = 'text-embedding-3-small') {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.embeddings.create({
        model: model,
        input: text,
        dimensions: model === 'text-embedding-3-small' ? 1536 : 3072
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating OpenAI embedding:', error);
      throw error;
    }
  }

  /**
   * Generate single embedding with preferred provider
   */
  async generateEmbedding(text, provider = this.defaultProvider) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      // Truncate text if too long (Gemini has limits)
      const maxLength = 2048;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

      if (provider === 'gemini' && this.gemini) {
        return await this.generateGeminiEmbedding(truncatedText);
      } else if (provider === 'openai' && this.openai) {
        return await this.generateOpenAIEmbedding(truncatedText);
      } else {
        // Fallback to available provider
        if (this.gemini) {
          logger.info('Falling back to Gemini for embedding');
          return await this.generateGeminiEmbedding(truncatedText);
        } else if (this.openai) {
          logger.info('Falling back to OpenAI for embedding');
          return await this.generateOpenAIEmbedding(truncatedText);
        } else {
          throw new Error('No embedding providers available');
        }
      }
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts, provider = this.defaultProvider, options = {}) {
    try {
      const {
        batchSize = 10, // Smaller batch size for Gemini
        delay = 500 // Delay between batches
      } = options;

      const allEmbeddings = [];
      
      logger.info(`Generating embeddings for ${texts.length} texts using ${provider}`);
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        logger.info(`Processing embedding batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(texts.length / batchSize)}`);
        
        const batchPromises = batch.map(text => this.generateEmbedding(text, provider));
        const batchEmbeddings = await Promise.all(batchPromises);
        
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
   * Generate query embedding (optimized for search)
   */
  async generateQueryEmbedding(query, provider = this.defaultProvider) {
    try {
      logger.info(`Generating query embedding using ${provider}`);
      return await this.generateEmbedding(query, provider);
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
      return 0;
    }
  }

  /**
   * Get embedding dimensions for current provider
   */
  getEmbeddingDimensions(provider = this.defaultProvider) {
    if (provider === 'gemini') {
      return 768;
    } else if (provider === 'openai') {
      return 1536; // for text-embedding-3-small
    }
    return this.dimensions;
  }

  /**
   * Validate embedding vector
   */
  validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
      return false;
    }
    
    if (embedding.length === 0) {
      return false;
    }
    
    // Check if all elements are numbers
    return embedding.every(val => typeof val === 'number' && !isNaN(val));
  }

  /**
   * Normalize embedding vector
   */
  normalizeEmbedding(embedding) {
    try {
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (norm === 0) {
        return embedding;
      }
      return embedding.map(val => val / norm);
    } catch (error) {
      logger.error('Error normalizing embedding:', error);
      return embedding;
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    const providers = [];
    if (this.gemini) providers.push('gemini');
    if (this.openai) providers.push('openai');
    return providers;
  }

  /**
   * Switch default provider
   */
  setDefaultProvider(provider) {
    const available = this.getAvailableProviders();
    if (available.includes(provider)) {
      this.defaultProvider = provider;
      this.dimensions = this.getEmbeddingDimensions(provider);
      logger.info(`Default embedding provider set to: ${provider}`);
    } else {
      throw new Error(`Provider ${provider} not available. Available: ${available.join(', ')}`);
    }
  }

  /**
   * Health check for embedding services
   */
  async healthCheck() {
    const health = {
      gemini: false,
      openai: false,
      defaultProvider: this.defaultProvider,
      dimensions: this.dimensions,
      availableProviders: []
    };

    try {
      if (this.gemini) {
        await this.generateGeminiEmbedding('test');
        health.gemini = true;
        health.availableProviders.push('gemini');
      }
    } catch (error) {
      logger.warn('Gemini embedding health check failed:', error.message);
    }

    try {
      if (this.openai) {
        await this.generateOpenAIEmbedding('test');
        health.openai = true;
        health.availableProviders.push('openai');
      }
    } catch (error) {
      logger.warn('OpenAI embedding health check failed:', error.message);
    }

    return health;
  }

  /**
   * Clear any cached embeddings (if caching is implemented)
   */
  clearCache() {
    // Placeholder for future caching implementation
    logger.info('Embedding cache cleared');
  }

  /**
   * Get embedding statistics
   */
  getStats() {
    return {
      defaultProvider: this.defaultProvider,
      dimensions: this.dimensions,
      availableProviders: this.getAvailableProviders(),
      geminiAvailable: !!this.gemini,
      openaiAvailable: !!this.openai
    };
  }
}

export default new EmbeddingService();