#!/usr/bin/env python3
"""
Celery worker runner
"""
import os
import sys
from celery_app import celery

def main():
    """Main function to run Celery worker"""
    # Set environment
    os.environ.setdefault('FLASK_ENV', 'development')
    
    # Start Celery worker
    celery.start()

if __name__ == '__main__':
    main()
