import logger from '../utils/logger.js';

class EmbeddingService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
    this.initialized = false;
    this.cache = new Map();
    
    logger.info('EmbeddingService created (not initialized yet)');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeClients();
      this.initialized = true;
      logger.info('✅ EmbeddingService initialized successfully');
    } catch (error) {
      logger.warn('⚠️ EmbeddingService initialization failed:', error.message);
      // Don't throw error - allow service to continue without embeddings
    }
  }

  async initializeClients() {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    logger.info('🔍 Checking API keys...');
    logger.info('Gemini key exists:', !!geminiKey);
    logger.info('OpenAI key exists:', !!openaiKey);

    if (!geminiKey && !openaiKey) {
      logger.warn('⚠️  No embedding providers available');
      return;
    }

    if (geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this.geminiClient = new GoogleGenerativeAI(geminiKey);
        logger.info('✅ Gemini client initialized for embeddings');
      } catch (error) {
        logger.error('Failed to initialize Gemini client:', error);
      }
    }

    if (openaiKey) {
      try {
        const { OpenAI } = await import('openai');
        this.openaiClient = new OpenAI({
          apiKey: openaiKey,
        });
        logger.info('✅ OpenAI client initialized for embeddings');
      } catch (error) {
        logger.error('Failed to initialize OpenAI client:', error);
      }
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async generateEmbedding(text) {
    await this.ensureInitialized();
    
    if (!this.geminiClient && !this.openaiClient) {
      throw new Error('No embedding providers available - check API keys');
    }

    const cacheKey = `embedding_${this.hashString(text)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let embedding;
    
    if (this.geminiClient) {
      embedding = await this.generateGeminiEmbedding(text);
    } else if (this.openaiClient) {
      embedding = await this.generateOpenAIEmbedding(text);
    }

    if (embedding) {
      this.cache.set(cacheKey, embedding);
      
      // Limit cache size
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return embedding;
  }

  async generateGeminiEmbedding(text) {
    try {
      // Use text-embedding-004 which produces 768 dimensions
      // We'll need to pad or use a different model for 1024 dimensions
      const model = this.geminiClient.getGenerativeModel({ 
        model: 'text-embedding-004' 
      });
      
      const result = await model.embedContent(text);
      const embedding = result.embedding;
      
      if (!embedding?.values) {
        throw new Error('Invalid embedding response from Gemini');
      }
  
      // Pad the 768-dimensional embedding to 1024 dimensions
      let paddedEmbedding = [...embedding.values];
      while (paddedEmbedding.length < 1024) {
        paddedEmbedding.push(0.0);
      }
      
      return {
        embedding: paddedEmbedding.slice(0, 1024), // Ensure exactly 1024 dimensions
        dimensions: 1024,
        model: 'text-embedding-004',
        provider: 'gemini'
      };
    } catch (error) {
      logger.error('Gemini embedding generation failed:', error);
      throw new Error(`Gemini embedding failed: ${error.message}`);
    }
  }
  

  async generateOpenAIEmbedding(text) {
    try {
      const response = await this.openaiClient.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text,
      });

      const embedding = response.data[0].embedding;
      
      return {
        embedding,
        dimensions: embedding.length,
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        provider: 'openai'
      };
    } catch (error) {
      logger.error('OpenAI embedding generation failed:', error);
      throw new Error(`OpenAI embedding failed: ${error.message}`);
    }
  }

  async generateBatchEmbeddings(texts) {
    await this.ensureInitialized();
    
    if (!this.geminiClient && !this.openaiClient) {
      throw new Error('No embedding providers available - check API keys');
    }

    const embeddings = [];
    
    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      } catch (error) {
        logger.error(`Failed to generate embedding for text: ${text.substring(0, 100)}...`, error);
        embeddings.push(null);
      }
    }

    return embeddings;
  }

  chunkText(text, chunkSize = 1000, overlap = 200) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const lastSpace = text.lastIndexOf(' ', end);
        
        const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
        if (breakPoint > start + chunkSize * 0.5) {
          end = breakPoint + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push({
          text: chunk,
          start,
          end,
          index: chunks.length
        });
      }

      start = Math.max(start + chunkSize - overlap, end);
    }

    return chunks;
  }

  hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString();
  }

  clearCache() {
    this.cache.clear();
    logger.info('Embedding cache cleared');
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000
    };
  }

  isAvailable() {
    return this.initialized && (this.geminiClient || this.openaiClient);
  }

  getAvailableProviders() {
    const providers = [];
    if (this.geminiClient) providers.push('gemini');
    if (this.openaiClient) providers.push('openai');
    return providers;
  }
}

// Create instance but don't initialize immediately
const embeddingService = new EmbeddingService();

export default embeddingService;
