from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta
import enum
import json

db = SQLAlchemy()
bcrypt = Bcrypt()

class UserRole(enum.Enum):
    USER = "user"
    ADMIN = "admin"
    LAWYER = "lawyer"

class DocumentType(enum.Enum):
    CONTRACT = "contract"
    TRADEMARK = "trademark"
    COPYRIGHT = "copyright"
    BANKING = "banking"
    PROPERTY = "property"
    BONDS = "bonds"
    CRIMINAL = "criminal"
    DIVORCE = "divorce"
    GST = "gst"
    COMPLIANCE = "compliance"

class NotificationType(enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    PUSH = "push"

class DeadlineType(enum.Enum):
    GST_FILING = "gst_filing"
    RENEWAL = "renewal"
    COMPLIANCE = "compliance"
    CUSTOM = "custom"

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    role = db.Column(db.Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    language_preference = db.Column(db.String(5), default='en', nullable=False)
    timezone = db.Column(db.String(50), default='Asia/Kolkata', nullable=False)
    notification_preferences = db.Column(db.JSON, default=lambda: {
        'email': True,
        'sms': False,
        'whatsapp': False,
        'push': True,
        'quiet_hours_start': '22:00',
        'quiet_hours_end': '08:00'
    })
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    documents = db.relationship('Document', backref='owner', lazy='dynamic', cascade='all, delete-orphan')
    deadlines = db.relationship('Deadline', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'role': self.role.value,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'language_preference': self.language_preference,
            'timezone': self.timezone,
            'notification_preferences': self.notification_preferences,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    document_type = db.Column(db.Enum(DocumentType), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('templates.id'), nullable=True)
    content = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    meta_data = db.Column(db.JSON, default=dict)
    version = db.Column(db.Integer, default=1, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    deadlines = db.relationship('Deadline', backref='document', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'document_type': self.document_type.value,
            'template_id': self.template_id,
            'content': self.content,
            'file_path': self.file_path,
            'metadata': self.meta_data,
            'version': self.version,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Template(db.Model):
    __tablename__ = 'templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    document_type = db.Column(db.Enum(DocumentType), nullable=False)
    description = db.Column(db.Text, nullable=True)
    template_content = db.Column(db.Text, nullable=False)
    form_schema = db.Column(db.JSON, nullable=False)  # JSON schema for form fields
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    documents = db.relationship('Document', backref='template', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'document_type': self.document_type.value,
            'description': self.description,
            'template_content': self.template_content,
            'form_schema': self.form_schema,
            'is_active': self.is_active,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Deadline(db.Model):
    __tablename__ = 'deadlines'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    deadline_type = db.Column(db.Enum(DeadlineType), nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)
    is_recurring = db.Column(db.Boolean, default=False, nullable=False)
    recurrence_pattern = db.Column(db.String(50), nullable=True)  # 'monthly', 'quarterly', 'annually'
    reminder_days = db.Column(db.JSON, default=lambda: [7, 3, 1])  # Days before to send reminders
    is_completed = db.Column(db.Boolean, default=False, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    meta_data = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'document_id': self.document_id,
            'title': self.title,
            'description': self.description,
            'deadline_type': self.deadline_type.value,
            'due_date': self.due_date.isoformat(),
            'is_recurring': self.is_recurring,
            'recurrence_pattern': self.recurrence_pattern,
            'reminder_days': self.reminder_days,
            'is_completed': self.is_completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'metadata': self.meta_data,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    deadline_id = db.Column(db.Integer, db.ForeignKey('deadlines.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    notification_type = db.Column(db.Enum(NotificationType), nullable=False)
    is_sent = db.Column(db.Boolean, default=False, nullable=False)
    sent_at = db.Column(db.DateTime, nullable=True)
    scheduled_for = db.Column(db.DateTime, nullable=False)
    meta_data = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'deadline_id': self.deadline_id,
            'title': self.title,
            'message': self.message,
            'notification_type': self.notification_type.value,
            'is_sent': self.is_sent,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'scheduled_for': self.scheduled_for.isoformat(),
            'metadata': self.meta_data,
            'created_at': self.created_at.isoformat()
        }

class LegalCorpus(db.Model):
    __tablename__ = 'legal_corpus'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    language = db.Column(db.String(5), default='en', nullable=False)
    tags = db.Column(db.JSON, default=list)
    embedding = db.Column(db.JSON, nullable=True)  # Store vector embeddings
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'category': self.category,
            'language': self.language,
            'tags': self.tags,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class ComplianceRule(db.Model):
    __tablename__ = 'compliance_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    rule_type = db.Column(db.String(50), nullable=False)  # 'gst', 'tax', 'legal', 'custom'
    conditions = db.Column(db.JSON, nullable=False)  # Rule conditions
    actions = db.Column(db.JSON, nullable=False)  # Actions to take
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'rule_type': self.rule_type,
            'conditions': self.conditions,
            'actions': self.actions,
            'is_active': self.is_active,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
