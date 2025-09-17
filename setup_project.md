# Legal Documentation Assistant - Setup Guide

## 🚀 Quick Setup Instructions

### 1. Backend Setup

```bash
# Navigate to server directory
cd server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Copy the config.env file and rename it to .env
# Update the database credentials and other settings

# Set up PostgreSQL database
# Make sure PostgreSQL is running
# Create database: docbuddy

# Initialize database
python createdatabase.py

# Start the backend server
python run.py
```

### 2. Frontend Setup

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start the frontend
npm start
```

### 3. Additional Services (Optional)

#### Redis (for background tasks)
```bash
# Install and start Redis
# On Windows: Download from https://redis.io/download
# On macOS: brew install redis && brew services start redis
# On Linux: sudo apt install redis-server && sudo systemctl start redis
```

#### Celery Workers (for background tasks)
```bash
# In server directory with venv activated
python run_celery.py  # In one terminal
python run_beat.py    # In another terminal
```

## 🔧 Configuration

### Environment Variables (.env file)
Update the following in your `.env` file:

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_NAME=docbuddy
DATABASE_USER=postgres
PASSWORD=your_password
DATABASE_PORT=5432

# Email Configuration (for notifications)
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# Twilio Configuration (for SMS/WhatsApp)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

## 📱 Features Available

### For Authenticated Users:
- **Dashboard**: Overview of documents, deadlines, and notifications
- **Document Management**: Create, edit, and manage legal documents
- **Deadline Tracking**: Set and track legal deadlines with reminders
- **AI Chat**: Multilingual legal assistance
- **Profile Management**: Update personal information and preferences
- **Notifications**: Multi-channel notification system

### For All Users:
- **Document Templates**: Access to various legal document templates
- **AI Chatbot**: Legal assistance and document suggestions
- **Service Information**: Browse available legal services

## 🌐 API Endpoints

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

## 🔐 Default Credentials

After setting up the database, you can create your first user account through the signup page at `http://localhost:3000/signup`.

## 🐛 Troubleshooting

### Common Issues:

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check database credentials in .env file
   - Verify database 'docbuddy' exists

2. **Frontend Not Loading**
   - Check if backend is running on port 5000
   - Verify CORS settings in backend
   - Check browser console for errors

3. **Authentication Issues**
   - Clear browser localStorage
   - Check JWT secret key in .env file
   - Verify token expiration settings

4. **AI Chat Not Working**
   - Check if NLTK data is downloaded
   - Verify sentence-transformers model is loaded
   - Check backend logs for AI service errors

## 📞 Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify all services are running
3. Check the database connection
4. Review the environment variables

## 🎉 You're Ready!

Once everything is set up:
1. Backend running on `http://localhost:5000`
2. Frontend running on `http://localhost:3000`
3. Create your account and start using the platform!

The platform now includes:
- ✅ User authentication and management
- ✅ Document creation and management
- ✅ Deadline tracking with notifications
- ✅ AI-powered legal assistance
- ✅ Multilingual support
- ✅ Compliance checking
- ✅ Modern, responsive UI
