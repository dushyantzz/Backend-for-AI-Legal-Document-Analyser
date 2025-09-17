# Legal Documentation Assistant - Backend

A comprehensive backend system for legal document management, compliance tracking, and AI-powered assistance with multilingual support.

## Features

### Core Features
- **User Authentication & Management**: JWT-based authentication with role-based access control
- **Document Management**: Create, edit, and manage legal documents with versioning
- **Template System**: Dynamic document templates with form generation
- **Deadline Management**: Track and manage legal deadlines with recurring support
- **Notification System**: Multi-channel notifications (Email, SMS, WhatsApp, Push)
- **AI-Powered Chat**: Multilingual legal assistance with document suggestions
- **Compliance Engine**: GST and legal compliance checking with automated deadline creation
- **Multilingual Support**: Support for 12 Indian languages with translation services

### Advanced Features
- **Real-time Reminders**: Automated deadline reminders with customizable schedules
- **Legal Corpus Search**: AI-powered search through legal knowledge base
- **Compliance Rules Engine**: Customizable compliance rules and validation
- **Background Tasks**: Celery-based task processing for notifications and document generation
- **Admin Panel**: Template and user management for administrators
- **API Documentation**: Comprehensive REST API with proper error handling

## Technology Stack

- **Backend**: Flask, SQLAlchemy, Flask-JWT-Extended
- **Database**: PostgreSQL
- **Task Queue**: Celery with Redis
- **AI/ML**: Sentence Transformers, NLTK, Google Translate
- **Notifications**: Twilio (SMS/WhatsApp), SMTP (Email)
- **Authentication**: JWT tokens with refresh mechanism
- **Validation**: Custom validators with Pydantic support

## Installation

### Prerequisites
- Python 3.8+
- PostgreSQL 12+
- Redis 6+
- Docker (optional, for containerized setup)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Legal-Documentation-Assistant/server
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

5. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb docbuddy
   
   # Initialize database schema
   python createdatabase.py
   ```

6. **Run database migrations**
   ```bash
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   ```

7. **Start Redis server**
   ```bash
   redis-server
   ```

8. **Run the application**
   ```bash
   # Start main application
   python run.py
   
   # In separate terminals, start Celery workers
   python run_celery.py
   python run_beat.py
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Documents
- `GET /api/documents` - Get user documents
- `POST /api/documents` - Create document
- `GET /api/documents/{id}` - Get specific document
- `PUT /api/documents/{id}` - Update document
- `DELETE /api/documents/{id}` - Delete document

### Templates
- `GET /api/templates` - Get available templates
- `POST /api/admin/templates` - Create template (admin only)

### Deadlines
- `GET /api/deadlines` - Get user deadlines
- `POST /api/deadlines` - Create deadline
- `PUT /api/deadlines/{id}` - Update deadline
- `DELETE /api/deadlines/{id}` - Delete deadline

### AI Chat
- `POST /api/chat` - Get AI chat response

### Compliance
- `POST /api/compliance/check` - Check compliance requirements

### Notifications
- `GET /api/notifications` - Get user notifications

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `POST /api/admin/templates` - Create template (admin only)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_HOST` | PostgreSQL host | localhost |
| `DATABASE_NAME` | Database name | docbuddy |
| `DATABASE_USER` | Database user | postgres |
| `PASSWORD` | Database password | postgres |
| `DATABASE_PORT` | Database port | 5432 |
| `SECRET_KEY` | Flask secret key | - |
| `JWT_SECRET_KEY` | JWT secret key | - |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379/0 |
| `MAIL_SERVER` | SMTP server | smtp.gmail.com |
| `MAIL_USERNAME` | Email username | - |
| `MAIL_PASSWORD` | Email password | - |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | - |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | - |

### Database Schema

The system uses the following main tables:
- `users` - User accounts and profiles
- `documents` - Legal documents
- `templates` - Document templates
- `deadlines` - Deadline tracking
- `notifications` - Notification queue
- `legal_corpus` - AI knowledge base
- `compliance_rules` - Custom compliance rules

## Development

### Running Tests
```bash
python -m pytest tests/
```

### Code Style
```bash
black .
flake8 .
```

### Database Migrations
```bash
# Create migration
flask db migrate -m "Description"

# Apply migration
flask db upgrade
```

## Deployment

### Docker Deployment
```bash
# Build image
docker build -t legal-doc-backend .

# Run container
docker run -p 5000:5000 legal-doc-backend
```

### Production Setup
1. Set `FLASK_ENV=production`
2. Use production database
3. Configure proper email/SMS services
4. Set up SSL certificates
5. Use process manager (PM2, systemd)
6. Set up monitoring and logging

## API Documentation

### Authentication Flow
1. Register user with `POST /api/auth/register`
2. Login with `POST /api/auth/login` to get access token
3. Use access token in `Authorization: Bearer <token>` header
4. Refresh token with `POST /api/auth/refresh` when needed

### Error Handling
All endpoints return consistent error responses:
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Rate Limiting
- 100 requests per hour per IP (configurable)
- JWT token refresh limited to 5 times per hour

## Monitoring

### Health Check
- `GET /api/health` - Application health status

### Metrics
- Request count and response times
- Database connection pool status
- Celery task queue status
- Notification delivery rates

## Security

### Authentication
- JWT tokens with configurable expiration
- Refresh token mechanism
- Password hashing with bcrypt

### Authorization
- Role-based access control (User, Admin, Lawyer)
- Resource ownership validation
- API endpoint protection

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation wiki
