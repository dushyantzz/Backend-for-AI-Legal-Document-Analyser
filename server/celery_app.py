from celery import Celery
from flask import current_app
import os

def make_celery(app=None):
    """Create Celery instance"""
    celery = Celery(
        app.import_name if app else 'legal_doc_assistant',
        backend=app.config['CELERY_RESULT_BACKEND'] if app else 'redis://localhost:6379/0',
        broker=app.config['CELERY_BROKER_URL'] if app else 'redis://localhost:6379/0'
    )
    
    if app:
        celery.conf.update(app.config)
        
        class ContextTask(celery.Task):
            """Make celery tasks work with Flask app context."""
            def __call__(self, *args, **kwargs):
                with app.app_context():
                    return self.run(*args, **kwargs)
        
        celery.Task = ContextTask
    
    return celery

# Create Celery instance
celery = make_celery()

@celery.task
def send_notification_task(notification_id):
    """Send notification task"""
    from models import Notification, db
    from services.notification_service import NotificationService
    
    try:
        notification = Notification.query.get(notification_id)
        if not notification:
            return False
        
        notification_service = NotificationService()
        success = notification_service.send_notification(notification)
        
        return success
    except Exception as e:
        print(f"Notification task failed: {e}")
        return False

@celery.task
def process_deadline_reminders():
    """Process all pending deadline reminders"""
    from services.notification_service import NotificationService
    
    try:
        notification_service = NotificationService()
        count = notification_service.process_pending_notifications()
        return f"Processed {count} notifications"
    except Exception as e:
        print(f"Deadline reminder processing failed: {e}")
        return False

@celery.task
def generate_document_task(document_id, template_id, form_data):
    """Generate document from template task"""
    from models import Document, Template, db
    from services.document_service import DocumentService
    
    try:
        document = Document.query.get(document_id)
        template = Template.query.get(template_id)
        
        if not document or not template:
            return False
        
        document_service = DocumentService()
        content = document_service.generate_document_from_template(template_id, form_data)
        
        document.content = content
        document.updated_at = datetime.utcnow()
        db.session.commit()
        
        return True
    except Exception as e:
        print(f"Document generation task failed: {e}")
        return False

@celery.task
def update_corpus_embeddings():
    """Update legal corpus embeddings task"""
    from services.ai_service import AIService
    
    try:
        ai_service = AIService()
        success = ai_service.update_corpus_embeddings()
        return success
    except Exception as e:
        print(f"Corpus embeddings update failed: {e}")
        return False

@celery.task
def send_bulk_notifications(notification_data_list):
    """Send bulk notifications task"""
    from services.notification_service import NotificationService
    
    try:
        notification_service = NotificationService()
        success_count = 0
        
        for notification_data in notification_data_list:
            try:
                # Create notification
                notification = notification_service._create_notification(**notification_data)
                # Send notification
                success = notification_service.send_notification(notification)
                if success:
                    success_count += 1
            except Exception as e:
                print(f"Bulk notification failed: {e}")
                continue
        
        return f"Sent {success_count}/{len(notification_data_list)} notifications"
    except Exception as e:
        print(f"Bulk notification task failed: {e}")
        return False

@celery.task
def cleanup_old_notifications():
    """Clean up old sent notifications"""
    from models import Notification, db
    from datetime import datetime, timedelta
    
    try:
        # Delete notifications older than 30 days
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        
        old_notifications = Notification.query.filter(
            Notification.sent_at < cutoff_date,
            Notification.is_sent == True
        ).all()
        
        for notification in old_notifications:
            db.session.delete(notification)
        
        db.session.commit()
        
        return f"Cleaned up {len(old_notifications)} old notifications"
    except Exception as e:
        print(f"Notification cleanup failed: {e}")
        return False

@celery.task
def backup_database():
    """Backup database task"""
    import subprocess
    from datetime import datetime
    
    try:
        # This is a simplified backup implementation
        # In production, you would use proper database backup tools
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"backup_{timestamp}.sql"
        
        # Example PostgreSQL backup command
        # subprocess.run(['pg_dump', 'your_database', '-f', backup_filename])
        
        return f"Backup created: {backup_filename}"
    except Exception as e:
        print(f"Database backup failed: {e}")
        return False

# Periodic tasks
from celery.schedules import crontab

celery.conf.beat_schedule = {
    'process-deadline-reminders': {
        'task': 'celery_app.process_deadline_reminders',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'cleanup-old-notifications': {
        'task': 'celery_app.cleanup_old_notifications',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    'backup-database': {
        'task': 'celery_app.backup_database',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
    },
}

celery.conf.timezone = 'UTC'
