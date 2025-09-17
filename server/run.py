#!/usr/bin/env python3
"""
Main application runner
"""
import os
import sys
from app import create_app

def main():
    """Main function to run the application"""
    # Set environment
    config_name = os.environ.get('FLASK_ENV', 'development')
    
    # Create app
    app = create_app(config_name)
    
    # Create database tables (skip if PostgreSQL not available)
    try:
        with app.app_context():
            from models import db
            db.create_all()
            print("Database tables created successfully!")
    except Exception as e:
        print(f"Database connection failed: {e}")
        print("Running without database - some features may not work")
    
    # Run app
    debug = config_name == 'development'
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=debug
    )

if __name__ == '__main__':
    main()
