from models import LegalCorpus, db
from sentence_transformers import SentenceTransformer
import numpy as np
from googletrans import Translator
from langdetect import detect
import json
import os
import sys

# Add parent directory to path for model imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from model.similarity import get_document as get_document_category
from model.bot import get_response as get_bot_response

class AIService:
    def __init__(self):
        self.model = None
        self.translator = Translator()
        self.supported_languages = ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'pa', 'or']
        
        # Initialize multilingual model
        try:
            self.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        except Exception as e:
            print(f"Failed to load multilingual model: {e}")
            # Fallback to English model
            try:
                self.model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
            except Exception as e:
                print(f"Failed to load English model: {e}")
    
    def get_chat_response(self, message, user_language='en', user_id=None):
        """Get AI chat response with multilingual support"""
        try:
            # Detect input language
            try:
                detected_lang = detect(message)
            except:
                detected_lang = 'en'
            
            # Translate to English if needed for processing
            if detected_lang != 'en':
                translated_message = self.translator.translate(message, dest='en').text
            else:
                translated_message = message
            
            # Get response using existing models
            response = self._get_enhanced_response(translated_message, user_id)
            
            # Translate response to user's preferred language if needed
            if user_language != 'en' and user_language in self.supported_languages:
                try:
                    translated_response = self.translator.translate(response, dest=user_language).text
                    return translated_response
                except:
                    return response
            
            return response
            
        except Exception as e:
            return f"I apologize, but I'm having trouble processing your request. Please try again. Error: {str(e)}"
    
    def _get_enhanced_response(self, message, user_id=None):
        """Get enhanced response using multiple AI models"""
        try:
            # First, try to get document category
            category_response = get_document_category(message)
            
            # If it's a specific document category, provide more detailed response
            if "Please refer to" in category_response:
                # Get more specific information from legal corpus
                corpus_response = self._search_legal_corpus(message)
                if corpus_response:
                    return f"{category_response}\n\nAdditional Information:\n{corpus_response}"
            
            # Try the bot model for more conversational responses
            bot_response = get_bot_response(message)
            
            # If bot response is generic, use category response
            if "I am unable to process" in bot_response:
                return category_response
            
            return bot_response
            
        except Exception as e:
            return "I'm here to help with legal document assistance. Could you please rephrase your question?"
    
    def _search_legal_corpus(self, query, limit=3):
        """Search legal corpus for relevant information"""
        try:
            if not self.model:
                return None
            
            # Get query embedding
            query_embedding = self.model.encode([query])
            
            # Get all active corpus entries
            corpus_entries = LegalCorpus.query.filter_by(is_active=True).all()
            
            if not corpus_entries:
                return None
            
            # Calculate similarities
            similarities = []
            for entry in corpus_entries:
                if entry.embedding:
                    entry_embedding = np.array(entry.embedding).reshape(1, -1)
                    similarity = np.dot(query_embedding, entry_embedding.T)[0][0]
                    similarities.append((entry, similarity))
            
            # Sort by similarity and get top results
            similarities.sort(key=lambda x: x[1], reverse=True)
            top_entries = similarities[:limit]
            
            # Format response
            response_parts = []
            for entry, similarity in top_entries:
                if similarity > 0.3:  # Threshold for relevance
                    response_parts.append(f"• {entry.title}: {entry.content[:200]}...")
            
            return "\n".join(response_parts) if response_parts else None
            
        except Exception as e:
            print(f"Corpus search failed: {e}")
            return None
    
    def add_to_legal_corpus(self, title, content, category, language='en', tags=None):
        """Add content to legal corpus"""
        try:
            # Generate embedding if model is available
            embedding = None
            if self.model:
                embedding = self.model.encode([content]).tolist()[0]
            
            corpus_entry = LegalCorpus(
                title=title,
                content=content,
                category=category,
                language=language,
                tags=tags or [],
                embedding=embedding
            )
            
            db.session.add(corpus_entry)
            db.session.commit()
            
            return corpus_entry
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def update_corpus_embeddings(self):
        """Update embeddings for all corpus entries"""
        try:
            if not self.model:
                return False
            
            corpus_entries = LegalCorpus.query.filter_by(is_active=True).all()
            
            for entry in corpus_entries:
                if not entry.embedding:
                    embedding = self.model.encode([entry.content]).tolist()[0]
                    entry.embedding = embedding
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def get_legal_advice(self, query, user_language='en'):
        """Get legal advice based on query"""
        try:
            # Detect language
            try:
                detected_lang = detect(query)
            except:
                detected_lang = 'en'
            
            # Translate to English for processing
            if detected_lang != 'en':
                translated_query = self.translator.translate(query, dest='en').text
            else:
                translated_query = query
            
            # Search corpus for relevant information
            corpus_response = self._search_legal_corpus(translated_query, limit=5)
            
            if corpus_response:
                # Translate response to user language
                if user_language != 'en' and user_language in self.supported_languages:
                    try:
                        translated_response = self.translator.translate(corpus_response, dest=user_language).text
                        return translated_response
                    except:
                        return corpus_response
                return corpus_response
            
            # Fallback to category-based response
            category_response = get_document_category(translated_query)
            
            if user_language != 'en' and user_language in self.supported_languages:
                try:
                    translated_response = self.translator.translate(category_response, dest=user_language).text
                    return translated_response
                except:
                    return category_response
            
            return category_response
            
        except Exception as e:
            return "I apologize, but I'm unable to provide legal advice at the moment. Please consult with a qualified legal professional for specific legal matters."
    
    def get_document_suggestions(self, user_description, user_language='en'):
        """Get document type suggestions based on user description"""
        try:
            # Detect language
            try:
                detected_lang = detect(user_description)
            except:
                detected_lang = 'en'
            
            # Translate to English for processing
            if detected_lang != 'en':
                translated_description = self.translator.translate(user_description, dest='en').text
            else:
                translated_description = user_description
            
            # Get document category
            category = get_document_category(translated_description)
            
            # Map categories to document types
            document_mapping = {
                "Contract Document": "contract",
                "Trademark and Copyright Documents": "trademark",
                "Banking and Finance Documents": "banking",
                "Property Documents": "property",
                "Bonds Documents": "bonds",
                "Criminal Documents": "criminal",
                "Divorce and Family affairs Documents": "divorce"
            }
            
            suggested_type = None
            for key, value in document_mapping.items():
                if key in category:
                    suggested_type = value
                    break
            
            # Get relevant templates
            if suggested_type:
                from models import Template, DocumentType
                templates = Template.query.filter_by(
                    document_type=DocumentType(suggested_type),
                    is_active=True
                ).all()
                
                template_suggestions = [template.to_dict() for template in templates]
            else:
                template_suggestions = []
            
            response = {
                'suggested_type': suggested_type,
                'category': category,
                'templates': template_suggestions
            }
            
            return response
            
        except Exception as e:
            return {
                'suggested_type': None,
                'category': "I'm unable to determine the document type. Please provide more details.",
                'templates': []
            }
    
    def translate_text(self, text, target_language):
        """Translate text to target language"""
        try:
            if target_language not in self.supported_languages:
                return text
            
            result = self.translator.translate(text, dest=target_language)
            return result.text
            
        except Exception as e:
            return text
    
    def detect_language(self, text):
        """Detect language of text"""
        try:
            return detect(text)
        except:
            return 'en'
