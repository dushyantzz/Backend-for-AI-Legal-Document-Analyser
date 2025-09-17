#!/usr/bin/env python3
"""
Setup script for Legal Documentation Assistant Backend
"""
import os
import sys
import subprocess
import psycopg2
from dotenv import load_dotenv

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e.stderr}")
        return False

def check_prerequisites():
    """Check if required software is installed"""
    print("🔍 Checking prerequisites...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        return False
    
    # Check PostgreSQL
    try:
        subprocess.run(['psql', '--version'], check=True, capture_output=True)
        print("✅ PostgreSQL is installed")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ PostgreSQL is not installed or not in PATH")
        return False
    
    # Check Redis
    try:
        subprocess.run(['redis-server', '--version'], check=True, capture_output=True)
        print("✅ Redis is installed")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Redis is not installed or not in PATH")
        return False
    
    print("✅ All prerequisites are met")
    return True

def setup_environment():
    """Set up environment variables"""
    print("🔧 Setting up environment...")
    
    if not os.path.exists('.env'):
        if os.path.exists('env.example'):
            run_command('cp env.example .env', 'Creating .env file from template')
            print("📝 Please edit .env file with your configuration")
        else:
            print("❌ env.example file not found")
            return False
    
    load_dotenv()
    return True

def setup_database():
    """Set up PostgreSQL database"""
    print("🗄️ Setting up database...")
    
    try:
        # Get database connection details
        db_host = os.getenv('DATABASE_HOST', 'localhost')
        db_name = os.getenv('DATABASE_NAME', 'docbuddy')
        db_user = os.getenv('DATABASE_USER', 'postgres')
        db_password = os.getenv('PASSWORD', 'postgres')
        db_port = os.getenv('DATABASE_PORT', '5432')
        
        # Test connection
        conn = psycopg2.connect(
            host=db_host,
            database='postgres',  # Connect to default database first
            user=db_user,
            password=db_password,
            port=db_port
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        # Create database if it doesn't exist
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
        if not cur.fetchone():
            cur.execute(f"CREATE DATABASE {db_name}")
            print(f"✅ Database '{db_name}' created")
        else:
            print(f"✅ Database '{db_name}' already exists")
        
        cur.close()
        conn.close()
        
        # Initialize database schema
        if run_command('python createdatabase.py', 'Initializing database schema'):
            return True
        else:
            return False
            
    except psycopg2.Error as e:
        print(f"❌ Database setup failed: {e}")
        return False

def install_dependencies():
    """Install Python dependencies"""
    print("📦 Installing dependencies...")
    
    # Upgrade pip
    run_command('python -m pip install --upgrade pip', 'Upgrading pip')
    
    # Install requirements
    if run_command('pip install -r requirements.txt', 'Installing Python packages'):
        return True
    else:
        return False

def setup_ai_models():
    """Download and setup AI models"""
    print("🤖 Setting up AI models...")
    
    try:
        # Import and download NLTK data
        import nltk
        nltk.download('punkt', quiet=True)
        print("✅ NLTK data downloaded")
        
        # Download sentence transformer model
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        print("✅ Sentence transformer model downloaded")
        
        return True
    except Exception as e:
        print(f"❌ AI model setup failed: {e}")
        return False

def create_directories():
    """Create necessary directories"""
    print("📁 Creating directories...")
    
    directories = [
        'uploads',
        'logs',
        'nltk_data'
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ Created directory: {directory}")
    
    return True

def main():
    """Main setup function"""
    print("🚀 Legal Documentation Assistant Backend Setup")
    print("=" * 50)
    
    # Check prerequisites
    if not check_prerequisites():
        print("❌ Prerequisites check failed. Please install required software.")
        sys.exit(1)
    
    # Setup environment
    if not setup_environment():
        print("❌ Environment setup failed.")
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Dependency installation failed.")
        sys.exit(1)
    
    # Create directories
    if not create_directories():
        print("❌ Directory creation failed.")
        sys.exit(1)
    
    # Setup database
    if not setup_database():
        print("❌ Database setup failed.")
        sys.exit(1)
    
    # Setup AI models
    if not setup_ai_models():
        print("❌ AI model setup failed.")
        sys.exit(1)
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Edit .env file with your configuration")
    print("2. Start Redis server: redis-server")
    print("3. Run the application: python run.py")
    print("4. Start Celery worker: python run_celery.py")
    print("5. Start Celery beat: python run_beat.py")
    print("\n📚 For more information, see README.md")

if __name__ == '__main__':
    main()
