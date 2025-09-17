from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token, create_refresh_token
from flask_migrate import Migrate
import os
import sys
from datetime import datetime, timedelta
import pytz

# Add parent directory to path for model imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from config import config
from models import db, User, Document, Template, Deadline, Notification, LegalCorpus, ComplianceRule, UserRole, DocumentType, DeadlineType, NotificationType
from services.auth_service import AuthService
from services.document_service import DocumentService
from services.deadline_service import DeadlineService
from services.notification_service import NotificationService
from services.ai_service import AIService
from services.compliance_service import ComplianceService
from services.translation_service import TranslationService
from utils.validators import validate_email, validate_phone
from utils.decorators import admin_required, role_required

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    migrate = Migrate(app, db)
    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})
    
    # Initialize services
    auth_service = AuthService()
    document_service = DocumentService()
    deadline_service = DeadlineService()
    notification_service = NotificationService()
    ai_service = AIService()
    compliance_service = ComplianceService()
    translation_service = TranslationService()
    
    # Create upload directory
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request', 'message': str(error)}), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden', 'message': 'Insufficient permissions'}), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found', 'message': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': 'Internal server error', 'message': 'An unexpected error occurred'}), 500
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0'
        })
    
    # Authentication routes
    @app.route('/api/auth/register', methods=['POST'])
    def register():
        try:
            data = request.get_json()
            
            # Validate required fields
            required_fields = ['email', 'username', 'password', 'first_name', 'last_name']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'{field} is required'}), 400
            
            # Validate email format
            if not validate_email(data['email']):
                return jsonify({'error': 'Invalid email format'}), 400
            
            # Validate phone if provided
            if data.get('phone') and not validate_phone(data['phone']):
                return jsonify({'error': 'Invalid phone format'}), 400
            
            # Check if user already exists
            if User.query.filter_by(email=data['email']).first():
                return jsonify({'error': 'Email already registered'}), 409
            
            if User.query.filter_by(username=data['username']).first():
                return jsonify({'error': 'Username already taken'}), 409
            
            # Create new user
            user = User(
                email=data['email'],
                username=data['username'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                phone=data.get('phone'),
                language_preference=data.get('language_preference', 'en'),
                timezone=data.get('timezone', 'Asia/Kolkata')
            )
            user.set_password(data['password'])
            
            db.session.add(user)
            db.session.commit()
            
            # Create access and refresh tokens
            access_token = create_access_token(identity=user.id)
            refresh_token = create_refresh_token(identity=user.id)
            
            return jsonify({
                'message': 'User registered successfully',
                'user': user.to_dict(),
                'access_token': access_token,
                'refresh_token': refresh_token
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Registration failed', 'message': str(e)}), 500
    
    @app.route('/api/auth/login', methods=['POST'])
    def login():
        try:
            data = request.get_json()
            
            if not data.get('email') or not data.get('password'):
                return jsonify({'error': 'Email and password are required'}), 400
            
            user = User.query.filter_by(email=data['email']).first()
            
            if not user or not user.check_password(data['password']):
                return jsonify({'error': 'Invalid credentials'}), 401
            
            if not user.is_active:
                return jsonify({'error': 'Account is deactivated'}), 401
            
            # Create tokens
            access_token = create_access_token(identity=user.id)
            refresh_token = create_refresh_token(identity=user.id)
            
            return jsonify({
                'message': 'Login successful',
                'user': user.to_dict(),
                'access_token': access_token,
                'refresh_token': refresh_token
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Login failed', 'message': str(e)}), 500
    
    @app.route('/api/auth/refresh', methods=['POST'])
    @jwt_required(refresh=True)
    def refresh():
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user or not user.is_active:
                return jsonify({'error': 'User not found or inactive'}), 401
            
            new_access_token = create_access_token(identity=current_user_id)
            
            return jsonify({
                'access_token': new_access_token
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Token refresh failed', 'message': str(e)}), 500
    
    @app.route('/api/auth/profile', methods=['GET'])
    @jwt_required()
    def get_profile():
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            return jsonify({
                'user': user.to_dict()
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get profile', 'message': str(e)}), 500
    
    @app.route('/api/auth/profile', methods=['PUT'])
    @jwt_required()
    def update_profile():
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            data = request.get_json()
            
            # Update allowed fields
            if 'first_name' in data:
                user.first_name = data['first_name']
            if 'last_name' in data:
                user.last_name = data['last_name']
            if 'phone' in data:
                if data['phone'] and not validate_phone(data['phone']):
                    return jsonify({'error': 'Invalid phone format'}), 400
                user.phone = data['phone']
            if 'language_preference' in data:
                user.language_preference = data['language_preference']
            if 'timezone' in data:
                user.timezone = data['timezone']
            if 'notification_preferences' in data:
                user.notification_preferences = data['notification_preferences']
            
            user.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': 'Profile updated successfully',
                'user': user.to_dict()
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to update profile', 'message': str(e)}), 500
    
    # Document routes
    @app.route('/api/documents', methods=['GET'])
    @jwt_required()
    def get_documents():
        try:
            current_user_id = get_jwt_identity()
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 10, type=int)
            document_type = request.args.get('type')
            
            query = Document.query.filter_by(user_id=current_user_id, is_active=True)
            
            if document_type:
                query = query.filter_by(document_type=DocumentType(document_type))
            
            documents = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return jsonify({
                'documents': [doc.to_dict() for doc in documents.items],
                'total': documents.total,
                'pages': documents.pages,
                'current_page': page
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get documents', 'message': str(e)}), 500
    
    @app.route('/api/documents', methods=['POST'])
    @jwt_required()
    def create_document():
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            # Validate required fields
            if not data.get('title') or not data.get('document_type'):
                return jsonify({'error': 'Title and document_type are required'}), 400
            
            # Create document
            document = Document(
                user_id=current_user_id,
                title=data['title'],
                document_type=DocumentType(data['document_type']),
                template_id=data.get('template_id'),
                content=data.get('content'),
                metadata=data.get('metadata', {})
            )
            
            db.session.add(document)
            db.session.commit()
            
            return jsonify({
                'message': 'Document created successfully',
                'document': document.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to create document', 'message': str(e)}), 500
    
    @app.route('/api/documents/<int:document_id>', methods=['GET'])
    @jwt_required()
    def get_document(document_id):
        try:
            current_user_id = get_jwt_identity()
            document = Document.query.filter_by(
                id=document_id, user_id=current_user_id, is_active=True
            ).first()
            
            if not document:
                return jsonify({'error': 'Document not found'}), 404
            
            return jsonify({
                'document': document.to_dict()
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get document', 'message': str(e)}), 500
    
    @app.route('/api/documents/<int:document_id>', methods=['PUT'])
    @jwt_required()
    def update_document(document_id):
        try:
            current_user_id = get_jwt_identity()
            document = Document.query.filter_by(
                id=document_id, user_id=current_user_id, is_active=True
            ).first()
            
            if not document:
                return jsonify({'error': 'Document not found'}), 404
            
            data = request.get_json()
            
            # Update allowed fields
            if 'title' in data:
                document.title = data['title']
            if 'content' in data:
                document.content = data['content']
            if 'metadata' in data:
                document.metadata = data['metadata']
            
            document.version += 1
            document.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': 'Document updated successfully',
                'document': document.to_dict()
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to update document', 'message': str(e)}), 500
    
    @app.route('/api/documents/<int:document_id>', methods=['DELETE'])
    @jwt_required()
    def delete_document(document_id):
        try:
            current_user_id = get_jwt_identity()
            document = Document.query.filter_by(
                id=document_id, user_id=current_user_id, is_active=True
            ).first()
            
            if not document:
                return jsonify({'error': 'Document not found'}), 404
            
            document.is_active = False
            document.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': 'Document deleted successfully'
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to delete document', 'message': str(e)}), 500
    
    # Template routes
    @app.route('/api/templates', methods=['GET'])
    def get_templates():
        try:
            document_type = request.args.get('type')
            
            query = Template.query.filter_by(is_active=True)
            
            if document_type:
                query = query.filter_by(document_type=DocumentType(document_type))
            
            templates = query.all()
            
            return jsonify({
                'templates': [template.to_dict() for template in templates]
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get templates', 'message': str(e)}), 500
    
    # Deadline routes
    @app.route('/api/deadlines', methods=['GET'])
    @jwt_required()
    def get_deadlines():
        try:
            current_user_id = get_jwt_identity()
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 10, type=int)
            deadline_type = request.args.get('type')
            upcoming_only = request.args.get('upcoming_only', 'false').lower() == 'true'
            
            query = Deadline.query.filter_by(user_id=current_user_id)
            
            if deadline_type:
                query = query.filter_by(deadline_type=DeadlineType(deadline_type))
            
            if upcoming_only:
                query = query.filter(Deadline.due_date > datetime.utcnow())
            
            deadlines = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return jsonify({
                'deadlines': [deadline.to_dict() for deadline in deadlines.items],
                'total': deadlines.total,
                'pages': deadlines.pages,
                'current_page': page
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get deadlines', 'message': str(e)}), 500
    
    @app.route('/api/deadlines', methods=['POST'])
    @jwt_required()
    def create_deadline():
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            # Validate required fields
            if not data.get('title') or not data.get('due_date') or not data.get('deadline_type'):
                return jsonify({'error': 'Title, due_date, and deadline_type are required'}), 400
            
            # Parse due date
            try:
                due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid due_date format'}), 400
            
            # Create deadline
            deadline = Deadline(
                user_id=current_user_id,
                document_id=data.get('document_id'),
                title=data['title'],
                description=data.get('description'),
                deadline_type=DeadlineType(data['deadline_type']),
                due_date=due_date,
                is_recurring=data.get('is_recurring', False),
                recurrence_pattern=data.get('recurrence_pattern'),
                reminder_days=data.get('reminder_days', [7, 3, 1]),
                metadata=data.get('metadata', {})
            )
            
            db.session.add(deadline)
            db.session.commit()
            
            # Schedule notifications
            notification_service.schedule_deadline_notifications(deadline)
            
            return jsonify({
                'message': 'Deadline created successfully',
                'deadline': deadline.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to create deadline', 'message': str(e)}), 500
    
    # AI Chat routes
    @app.route('/api/chat', methods=['POST'])
    @jwt_required()
    def chat():
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            data = request.get_json()
            
            if not data.get('message'):
                return jsonify({'error': 'Message is required'}), 400
            
            # Get AI response
            response = ai_service.get_chat_response(
                message=data['message'],
                user_language=user.language_preference,
                user_id=current_user_id
            )
            
            return jsonify({
                'response': response
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get chat response', 'message': str(e)}), 500
    
    # Compliance routes
    @app.route('/api/compliance/check', methods=['POST'])
    @jwt_required()
    def check_compliance():
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            if not data.get('document_type') or not data.get('user_data'):
                return jsonify({'error': 'document_type and user_data are required'}), 400
            
            # Check compliance
            compliance_result = compliance_service.check_compliance(
                document_type=data['document_type'],
                user_data=data['user_data'],
                user_id=current_user_id
            )
            
            return jsonify({
                'compliance_result': compliance_result
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to check compliance', 'message': str(e)}), 500
    
    # Notification routes
    @app.route('/api/notifications', methods=['GET'])
    @jwt_required()
    def get_notifications():
        try:
            current_user_id = get_jwt_identity()
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 10, type=int)
            unread_only = request.args.get('unread_only', 'false').lower() == 'true'
            
            query = Notification.query.filter_by(user_id=current_user_id)
            
            if unread_only:
                query = query.filter_by(is_sent=False)
            
            notifications = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return jsonify({
                'notifications': [notification.to_dict() for notification in notifications.items],
                'total': notifications.total,
                'pages': notifications.pages,
                'current_page': page
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get notifications', 'message': str(e)}), 500
    
    # Admin routes
    @app.route('/api/admin/users', methods=['GET'])
    @jwt_required()
    @admin_required
    def get_all_users():
        try:
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 10, type=int)
            
            users = User.query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return jsonify({
                'users': [user.to_dict() for user in users.items],
                'total': users.total,
                'pages': users.pages,
                'current_page': page
            }), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to get users', 'message': str(e)}), 500
    
    @app.route('/api/admin/templates', methods=['POST'])
    @jwt_required()
    @admin_required
    def create_template():
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            # Validate required fields
            required_fields = ['name', 'document_type', 'template_content', 'form_schema']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'{field} is required'}), 400
            
            # Create template
            template = Template(
                name=data['name'],
                document_type=DocumentType(data['document_type']),
                description=data.get('description'),
                template_content=data['template_content'],
                form_schema=data['form_schema'],
                created_by=current_user_id
            )
            
            db.session.add(template)
            db.session.commit()
            
            return jsonify({
                'message': 'Template created successfully',
                'template': template.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to create template', 'message': str(e)}), 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
