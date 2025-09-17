import re
from datetime import datetime

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """Validate phone number format (Indian format)"""
    # Remove all non-digit characters
    phone_digits = re.sub(r'\D', '', phone)
    
    # Check if it's a valid Indian mobile number (10 digits starting with 6-9)
    if len(phone_digits) == 10 and phone_digits[0] in '6789':
        return True
    
    # Check if it's a valid Indian mobile number with country code (+91)
    if len(phone_digits) == 12 and phone_digits.startswith('91') and phone_digits[2] in '6789':
        return True
    
    return False

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    return True, "Password is valid"

def validate_date(date_string, format='%Y-%m-%d'):
    """Validate date format"""
    try:
        datetime.strptime(date_string, format)
        return True
    except ValueError:
        return False

def validate_datetime(datetime_string, format='%Y-%m-%dT%H:%M:%S'):
    """Validate datetime format"""
    try:
        datetime.strptime(datetime_string, format)
        return True
    except ValueError:
        return False

def validate_gst_number(gst_number):
    """Validate GST number format"""
    if not gst_number:
        return False
    
    # Remove spaces and convert to uppercase
    gst_number = gst_number.replace(' ', '').upper()
    
    # GST number should be 15 characters long
    if len(gst_number) != 15:
        return False
    
    # Format: 2 digits (state code) + 10 digits (PAN) + 1 digit (entity number) + 1 digit (Z) + 1 digit (checksum)
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$'
    return re.match(pattern, gst_number) is not None

def validate_pan_number(pan_number):
    """Validate PAN number format"""
    if not pan_number:
        return False
    
    # Remove spaces and convert to uppercase
    pan_number = pan_number.replace(' ', '').upper()
    
    # PAN number should be 10 characters long
    if len(pan_number) != 10:
        return False
    
    # Format: 5 letters + 4 digits + 1 letter
    pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    return re.match(pattern, pan_number) is not None

def validate_aadhaar_number(aadhaar_number):
    """Validate Aadhaar number format"""
    if not aadhaar_number:
        return False
    
    # Remove spaces and hyphens
    aadhaar_number = re.sub(r'[\s-]', '', aadhaar_number)
    
    # Aadhaar number should be 12 digits
    if len(aadhaar_number) != 12:
        return False
    
    # Should contain only digits
    return aadhaar_number.isdigit()

def validate_username(username):
    """Validate username format"""
    if not username:
        return False
    
    # Username should be 3-20 characters long
    if len(username) < 3 or len(username) > 20:
        return False
    
    # Should contain only letters, numbers, and underscores
    pattern = r'^[a-zA-Z0-9_]+$'
    return re.match(pattern, username) is not None

def validate_name(name):
    """Validate name format"""
    if not name:
        return False
    
    # Name should be 2-50 characters long
    if len(name) < 2 or len(name) > 50:
        return False
    
    # Should contain only letters, spaces, and common name characters
    pattern = r'^[a-zA-Z\s\.\-\']+$'
    return re.match(pattern, name) is not None

def validate_file_extension(filename, allowed_extensions):
    """Validate file extension"""
    if not filename:
        return False
    
    # Get file extension
    extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    return extension in allowed_extensions

def validate_file_size(file_size, max_size_mb=16):
    """Validate file size"""
    max_size_bytes = max_size_mb * 1024 * 1024
    return file_size <= max_size_bytes

def validate_json_schema(data, schema):
    """Basic JSON schema validation"""
    try:
        # This is a simplified validation
        # In production, you might want to use a proper JSON schema validator like jsonschema
        
        for field, rules in schema.items():
            if rules.get('required', False) and field not in data:
                return False, f"Required field '{field}' is missing"
            
            if field in data:
                value = data[field]
                
                # Check type
                expected_type = rules.get('type')
                if expected_type and not isinstance(value, expected_type):
                    return False, f"Field '{field}' should be of type {expected_type}"
                
                # Check minimum length for strings
                if isinstance(value, str) and 'min_length' in rules:
                    if len(value) < rules['min_length']:
                        return False, f"Field '{field}' is too short"
                
                # Check maximum length for strings
                if isinstance(value, str) and 'max_length' in rules:
                    if len(value) > rules['max_length']:
                        return False, f"Field '{field}' is too long"
                
                # Check minimum value for numbers
                if isinstance(value, (int, float)) and 'min_value' in rules:
                    if value < rules['min_value']:
                        return False, f"Field '{field}' is too small"
                
                # Check maximum value for numbers
                if isinstance(value, (int, float)) and 'max_value' in rules:
                    if value > rules['max_value']:
                        return False, f"Field '{field}' is too large"
        
        return True, "Validation passed"
        
    except Exception as e:
        return False, f"Validation error: {str(e)}"

def sanitize_input(text):
    """Sanitize user input to prevent XSS attacks"""
    if not text:
        return text
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Escape special characters
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#x27;')
    
    return text

def validate_timezone(timezone):
    """Validate timezone string"""
    try:
        import pytz
        pytz.timezone(timezone)
        return True
    except:
        return False

def validate_language_code(language_code):
    """Validate language code"""
    valid_codes = ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'pa', 'or']
    return language_code in valid_codes
