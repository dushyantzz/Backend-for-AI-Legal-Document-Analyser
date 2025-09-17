from flask import current_app
from models import User, db
from utils.validators import validate_email, validate_phone
import re

class AuthService:
    def __init__(self):
        pass
    
    def register_user(self, user_data):
        """Register a new user with validation"""
        try:
            # Validate email format
            if not validate_email(user_data['email']):
                raise ValueError('Invalid email format')
            
            # Validate phone if provided
            if user_data.get('phone') and not validate_phone(user_data['phone']):
                raise ValueError('Invalid phone format')
            
            # Check if user already exists
            if User.query.filter_by(email=user_data['email']).first():
                raise ValueError('Email already registered')
            
            if User.query.filter_by(username=user_data['username']).first():
                raise ValueError('Username already taken')
            
            # Create new user
            user = User(
                email=user_data['email'],
                username=user_data['username'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                phone=user_data.get('phone'),
                language_preference=user_data.get('language_preference', 'en'),
                timezone=user_data.get('timezone', 'Asia/Kolkata')
            )
            user.set_password(user_data['password'])
            
            db.session.add(user)
            db.session.commit()
            
            return user
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def authenticate_user(self, email, password):
        """Authenticate user with email and password"""
        try:
            user = User.query.filter_by(email=email).first()
            
            if not user or not user.check_password(password):
                return None
            
            if not user.is_active:
                raise ValueError('Account is deactivated')
            
            return user
            
        except Exception as e:
            raise e
    
    def update_user_profile(self, user_id, profile_data):
        """Update user profile information"""
        try:
            user = User.query.get(user_id)
            
            if not user:
                raise ValueError('User not found')
            
            # Update allowed fields
            if 'first_name' in profile_data:
                user.first_name = profile_data['first_name']
            if 'last_name' in profile_data:
                user.last_name = profile_data['last_name']
            if 'phone' in profile_data:
                if profile_data['phone'] and not validate_phone(profile_data['phone']):
                    raise ValueError('Invalid phone format')
                user.phone = profile_data['phone']
            if 'language_preference' in profile_data:
                user.language_preference = profile_data['language_preference']
            if 'timezone' in profile_data:
                user.timezone = profile_data['timezone']
            if 'notification_preferences' in profile_data:
                user.notification_preferences = profile_data['notification_preferences']
            
            db.session.commit()
            return user
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def change_password(self, user_id, current_password, new_password):
        """Change user password"""
        try:
            user = User.query.get(user_id)
            
            if not user:
                raise ValueError('User not found')
            
            if not user.check_password(current_password):
                raise ValueError('Current password is incorrect')
            
            user.set_password(new_password)
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def deactivate_user(self, user_id):
        """Deactivate user account"""
        try:
            user = User.query.get(user_id)
            
            if not user:
                raise ValueError('User not found')
            
            user.is_active = False
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            raise e
