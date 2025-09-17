#!/usr/bin/env python3
"""
Celery beat scheduler runner
"""
import os
import sys
from celery_app import celery

def main():
    """Main function to run Celery beat scheduler"""
    # Set environment
    os.environ.setdefault('FLASK_ENV', 'development')
    
    # Start Celery beat scheduler
    celery.start(['celery', 'beat'])

if __name__ == '__main__':
    main()
