from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, UserRole

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != UserRole.ADMIN:
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def role_required(required_role):
    """Decorator to require specific role"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user or user.role != required_role:
                return jsonify({'error': f'{required_role.value} access required'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def lawyer_required(f):
    """Decorator to require lawyer role"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role not in [UserRole.LAWYER, UserRole.ADMIN]:
            return jsonify({'error': 'Lawyer access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def user_required(f):
    """Decorator to require any authenticated user"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active:
            return jsonify({'error': 'Active user access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def validate_json(f):
    """Decorator to validate JSON request"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return jsonify({'error': 'JSON request required'}), 400
        
        return f(*args, **kwargs)
    return decorated_function

def validate_required_fields(required_fields):
    """Decorator to validate required fields in request"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Request data required'}), 400
            
            missing_fields = []
            for field in required_fields:
                if field not in data or not data[field]:
                    missing_fields.append(field)
            
            if missing_fields:
                return jsonify({
                    'error': 'Missing required fields',
                    'missing_fields': missing_fields
                }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def rate_limit(max_requests=100, window_seconds=3600):
    """Decorator to implement rate limiting"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # This is a simplified rate limiting implementation
            # In production, you would use Redis or similar for distributed rate limiting
            from flask import g
            from datetime import datetime, timedelta
            
            # Get client IP
            client_ip = request.remote_addr
            
            # Check rate limit (simplified implementation)
            # In production, this would be stored in Redis
            current_time = datetime.utcnow()
            
            # For now, we'll just allow all requests
            # You can implement proper rate limiting here
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def cache_response(expire_seconds=300):
    """Decorator to cache response"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # This is a simplified caching implementation
            # In production, you would use Redis or similar for caching
            
            # For now, we'll just call the function directly
            # You can implement proper caching here
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def log_request(f):
    """Decorator to log requests"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import g
        import logging
        
        # Log request details
        logging.info(f"Request: {request.method} {request.path} from {request.remote_addr}")
        
        try:
            result = f(*args, **kwargs)
            logging.info(f"Response: {result[1] if isinstance(result, tuple) else 200}")
            return result
        except Exception as e:
            logging.error(f"Error in {f.__name__}: {str(e)}")
            raise
    return decorated_function

def handle_errors(f):
    """Decorator to handle errors gracefully"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            return jsonify({'error': 'Invalid input', 'message': str(e)}), 400
        except PermissionError as e:
            return jsonify({'error': 'Permission denied', 'message': str(e)}), 403
        except FileNotFoundError as e:
            return jsonify({'error': 'Resource not found', 'message': str(e)}), 404
        except Exception as e:
            return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
    return decorated_function

def validate_user_ownership(resource_model, user_id_field='user_id'):
    """Decorator to validate user ownership of resource"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            
            # Get resource ID from kwargs
            resource_id = kwargs.get('id') or kwargs.get('document_id') or kwargs.get('deadline_id')
            
            if resource_id:
                # Check if user owns the resource
                resource = resource_model.query.filter_by(
                    id=resource_id,
                    **{user_id_field: current_user_id}
                ).first()
                
                if not resource:
                    return jsonify({'error': 'Resource not found or access denied'}), 404
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_verification(f):
    """Decorator to require verified user"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_verified:
            return jsonify({'error': 'Email verification required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function
