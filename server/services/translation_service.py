from googletrans import Translator
from langdetect import detect
import json
import os

class TranslationService:
    def __init__(self):
        self.translator = Translator()
        self.supported_languages = {
            'en': 'English',
            'hi': 'Hindi',
            'bn': 'Bengali',
            'te': 'Telugu',
            'mr': 'Marathi',
            'ta': 'Tamil',
            'ur': 'Urdu',
            'gu': 'Gujarati',
            'kn': 'Kannada',
            'ml': 'Malayalam',
            'pa': 'Punjabi',
            'or': 'Odia'
        }
        
        # Load legal terminology translations
        self.legal_terms = self._load_legal_terms()
    
    def _load_legal_terms(self):
        """Load legal terminology translations"""
        try:
            # This would typically load from a JSON file or database
            # For now, we'll use a basic dictionary
            return {
                'contract': {
                    'en': 'Contract',
                    'hi': 'अनुबंध',
                    'bn': 'চুক্তি',
                    'te': 'ఒప్పందం',
                    'mr': 'करार',
                    'ta': 'ஒப்பந்தம்',
                    'ur': 'معاہدہ',
                    'gu': 'કરાર',
                    'kn': 'ಒಪ್ಪಂದ',
                    'ml': 'കരാർ',
                    'pa': 'ਇਕਰਾਰਨਾਮਾ',
                    'or': 'ଚୁକ୍ତି'
                },
                'deadline': {
                    'en': 'Deadline',
                    'hi': 'समय सीमा',
                    'bn': 'নির্দিষ্ট সময়',
                    'te': 'గడువు',
                    'mr': 'मुदत',
                    'ta': 'காலக்கெடு',
                    'ur': 'آخری تاریخ',
                    'gu': 'મુદત',
                    'kn': 'ಕೊನೆಯ ದಿನಾಂಕ',
                    'ml': 'അവസാന തീയതി',
                    'pa': 'ਅੰਤਿਮ ਤਾਰੀਖ',
                    'or': 'ଶେଷ ତାରିଖ'
                },
                'gst': {
                    'en': 'GST',
                    'hi': 'जीएसटी',
                    'bn': 'জিএসটি',
                    'te': 'జీఎస్టీ',
                    'mr': 'जीएसटी',
                    'ta': 'ஜிஎஸ்டி',
                    'ur': 'جی ایس ٹی',
                    'gu': 'જીએસટી',
                    'kn': 'ಜಿಎಸ್ಟಿ',
                    'ml': 'ജിഎസ്ടി',
                    'pa': 'ਜੀਐਸਟੀ',
                    'or': 'ଜିଏସଟି'
                }
            }
        except Exception as e:
            print(f"Failed to load legal terms: {e}")
            return {}
    
    def translate_text(self, text, target_language, source_language=None):
        """Translate text to target language"""
        try:
            if target_language not in self.supported_languages:
                return text
            
            # Detect source language if not provided
            if not source_language:
                try:
                    source_language = detect(text)
                except:
                    source_language = 'en'
            
            # If source and target are the same, return original text
            if source_language == target_language:
                return text
            
            # Translate using Google Translate
            result = self.translator.translate(text, dest=target_language, src=source_language)
            return result.text
            
        except Exception as e:
            print(f"Translation failed: {e}")
            return text
    
    def translate_legal_document(self, document_content, target_language):
        """Translate legal document content with proper terminology"""
        try:
            # First, translate the content
            translated_content = self.translate_text(document_content, target_language)
            
            # Replace legal terms with proper translations
            for term, translations in self.legal_terms.items():
                if target_language in translations:
                    # Replace English terms with target language terms
                    translated_content = translated_content.replace(
                        term.title(), translations[target_language]
                    )
                    translated_content = translated_content.replace(
                        term.upper(), translations[target_language]
                    )
            
            return translated_content
            
        except Exception as e:
            print(f"Legal document translation failed: {e}")
            return document_content
    
    def translate_form_schema(self, form_schema, target_language):
        """Translate form schema fields and labels"""
        try:
            if not isinstance(form_schema, dict):
                return form_schema
            
            translated_schema = form_schema.copy()
            
            # Translate field labels
            if 'fields' in translated_schema:
                for field in translated_schema['fields']:
                    if 'label' in field:
                        field['label'] = self.translate_text(field['label'], target_language)
                    if 'placeholder' in field:
                        field['placeholder'] = self.translate_text(field['placeholder'], target_language)
                    if 'help_text' in field:
                        field['help_text'] = self.translate_text(field['help_text'], target_language)
                    if 'options' in field:
                        for option in field['options']:
                            if isinstance(option, dict) and 'label' in option:
                                option['label'] = self.translate_text(option['label'], target_language)
                            elif isinstance(option, str):
                                option = self.translate_text(option, target_language)
            
            # Translate form title and description
            if 'title' in translated_schema:
                translated_schema['title'] = self.translate_text(translated_schema['title'], target_language)
            if 'description' in translated_schema:
                translated_schema['description'] = self.translate_text(translated_schema['description'], target_language)
            
            return translated_schema
            
        except Exception as e:
            print(f"Form schema translation failed: {e}")
            return form_schema
    
    def translate_notification(self, notification, target_language):
        """Translate notification content"""
        try:
            translated_notification = {
                'title': self.translate_text(notification.get('title', ''), target_language),
                'message': self.translate_text(notification.get('message', ''), target_language)
            }
            
            return translated_notification
            
        except Exception as e:
            print(f"Notification translation failed: {e}")
            return notification
    
    def detect_language(self, text):
        """Detect language of text"""
        try:
            return detect(text)
        except:
            return 'en'
    
    def get_supported_languages(self):
        """Get list of supported languages"""
        return self.supported_languages
    
    def get_language_name(self, language_code):
        """Get language name from code"""
        return self.supported_languages.get(language_code, language_code)
    
    def translate_user_interface(self, ui_text, target_language):
        """Translate user interface text"""
        try:
            # Common UI translations
            ui_translations = {
                'en': {
                    'login': 'Login',
                    'register': 'Register',
                    'logout': 'Logout',
                    'dashboard': 'Dashboard',
                    'documents': 'Documents',
                    'deadlines': 'Deadlines',
                    'notifications': 'Notifications',
                    'settings': 'Settings',
                    'profile': 'Profile',
                    'save': 'Save',
                    'cancel': 'Cancel',
                    'delete': 'Delete',
                    'edit': 'Edit',
                    'create': 'Create',
                    'submit': 'Submit',
                    'loading': 'Loading...',
                    'error': 'Error',
                    'success': 'Success',
                    'warning': 'Warning',
                    'info': 'Information'
                },
                'hi': {
                    'login': 'लॉगिन',
                    'register': 'रजिस्टर',
                    'logout': 'लॉगआउट',
                    'dashboard': 'डैशबोर्ड',
                    'documents': 'दस्तावेज',
                    'deadlines': 'समय सीमा',
                    'notifications': 'सूचनाएं',
                    'settings': 'सेटिंग्स',
                    'profile': 'प्रोफाइल',
                    'save': 'सहेजें',
                    'cancel': 'रद्द करें',
                    'delete': 'हटाएं',
                    'edit': 'संपादित करें',
                    'create': 'बनाएं',
                    'submit': 'जमा करें',
                    'loading': 'लोड हो रहा है...',
                    'error': 'त्रुटि',
                    'success': 'सफलता',
                    'warning': 'चेतावनी',
                    'info': 'जानकारी'
                }
            }
            
            if target_language in ui_translations:
                return ui_translations[target_language].get(ui_text, ui_text)
            else:
                return self.translate_text(ui_text, target_language)
                
        except Exception as e:
            print(f"UI translation failed: {e}")
            return ui_text
    
    def batch_translate(self, texts, target_language, source_language=None):
        """Translate multiple texts in batch"""
        try:
            translated_texts = []
            
            for text in texts:
                translated_text = self.translate_text(text, target_language, source_language)
                translated_texts.append(translated_text)
            
            return translated_texts
            
        except Exception as e:
            print(f"Batch translation failed: {e}")
            return texts
