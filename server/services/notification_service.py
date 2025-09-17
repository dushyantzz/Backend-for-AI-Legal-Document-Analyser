from models import Notification, User, Deadline, db, NotificationType
from datetime import datetime, timedelta
from flask import current_app
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from twilio.rest import Client
import requests
import pytz

class NotificationService:
    def __init__(self):
        self.twilio_client = None
        self._initialized = False
    
    def _initialize_clients(self):
        """Initialize clients when app context is available"""
        if self._initialized:
            return
            
        from flask import current_app
        
        if current_app.config.get('TWILIO_ACCOUNT_SID') and current_app.config.get('TWILIO_AUTH_TOKEN'):
            self.twilio_client = Client(
                current_app.config['TWILIO_ACCOUNT_SID'],
                current_app.config['TWILIO_AUTH_TOKEN']
            )
        
        self._initialized = True
    
    def schedule_deadline_notifications(self, deadline):
        """Schedule notifications for a deadline"""
        try:
            user = User.query.get(deadline.user_id)
            if not user:
                return
            
            # Get user's notification preferences
            prefs = user.notification_preferences or {}
            
            # Schedule notifications for each reminder day
            for days_before in deadline.reminder_days:
                notification_date = deadline.due_date - timedelta(days=days_before)
                
                # Skip if notification date is in the past
                if notification_date <= datetime.utcnow():
                    continue
                
                # Create notification for each enabled channel
                if prefs.get('email', True):
                    self._create_notification(
                        user_id=deadline.user_id,
                        deadline_id=deadline.id,
                        title=f"Reminder: {deadline.title}",
                        message=f"Your deadline '{deadline.title}' is due in {days_before} days on {deadline.due_date.strftime('%Y-%m-%d')}.",
                        notification_type=NotificationType.EMAIL,
                        scheduled_for=notification_date
                    )
                
                if prefs.get('sms', False) and user.phone:
                    self._create_notification(
                        user_id=deadline.user_id,
                        deadline_id=deadline.id,
                        title=f"Reminder: {deadline.title}",
                        message=f"Deadline '{deadline.title}' due in {days_before} days on {deadline.due_date.strftime('%Y-%m-%d')}.",
                        notification_type=NotificationType.SMS,
                        scheduled_for=notification_date
                    )
                
                if prefs.get('whatsapp', False) and user.phone:
                    self._create_notification(
                        user_id=deadline.user_id,
                        deadline_id=deadline.id,
                        title=f"Reminder: {deadline.title}",
                        message=f"Deadline '{deadline.title}' due in {days_before} days on {deadline.due_date.strftime('%Y-%m-%d')}.",
                        notification_type=NotificationType.WHATSAPP,
                        scheduled_for=notification_date
                    )
                
                if prefs.get('push', True):
                    self._create_notification(
                        user_id=deadline.user_id,
                        deadline_id=deadline.id,
                        title=f"Reminder: {deadline.title}",
                        message=f"Deadline '{deadline.title}' due in {days_before} days on {deadline.due_date.strftime('%Y-%m-%d')}.",
                        notification_type=NotificationType.PUSH,
                        scheduled_for=notification_date
                    )
            
        except Exception as e:
            raise e
    
    def _create_notification(self, user_id, deadline_id, title, message, notification_type, scheduled_for):
        """Create a notification record"""
        try:
            notification = Notification(
                user_id=user_id,
                deadline_id=deadline_id,
                title=title,
                message=message,
                notification_type=notification_type,
                scheduled_for=scheduled_for
            )
            
            db.session.add(notification)
            db.session.commit()
            
            return notification
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def send_notification(self, notification):
        """Send a notification through the specified channel"""
        try:
            user = User.query.get(notification.user_id)
            if not user:
                return False
            
            # Check if notification is within user's quiet hours
            if self._is_quiet_hours(user, notification.scheduled_for):
                # Reschedule for next available time
                next_time = self._get_next_available_time(user, notification.scheduled_for)
                notification.scheduled_for = next_time
                db.session.commit()
                return True
            
            success = False
            
            if notification.notification_type == NotificationType.EMAIL:
                success = self._send_email(user, notification)
            elif notification.notification_type == NotificationType.SMS:
                success = self._send_sms(user, notification)
            elif notification.notification_type == NotificationType.WHATSAPP:
                success = self._send_whatsapp(user, notification)
            elif notification.notification_type == NotificationType.PUSH:
                success = self._send_push(user, notification)
            
            # Update notification status
            notification.is_sent = success
            notification.sent_at = datetime.utcnow() if success else None
            db.session.commit()
            
            return success
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def _send_email(self, user, notification):
        """Send email notification"""
        try:
            if not current_app.config.get('MAIL_USERNAME'):
                return False
            
            msg = MIMEMultipart()
            msg['From'] = current_app.config['MAIL_DEFAULT_SENDER']
            msg['To'] = user.email
            msg['Subject'] = notification.title
            
            msg.attach(MIMEText(notification.message, 'plain'))
            
            server = smtplib.SMTP(current_app.config['MAIL_SERVER'], current_app.config['MAIL_PORT'])
            server.starttls()
            server.login(current_app.config['MAIL_USERNAME'], current_app.config['MAIL_PASSWORD'])
            text = msg.as_string()
            server.sendmail(current_app.config['MAIL_DEFAULT_SENDER'], user.email, text)
            server.quit()
            
            return True
            
        except Exception as e:
            print(f"Email sending failed: {str(e)}")
            return False
    
    def _send_sms(self, user, notification):
        """Send SMS notification via Twilio"""
        try:
            self._initialize_clients()
            if not self.twilio_client or not user.phone:
                return False
            
            message = self.twilio_client.messages.create(
                body=notification.message,
                from_=current_app.config['TWILIO_PHONE_NUMBER'],
                to=user.phone
            )
            
            return message.sid is not None
            
        except Exception as e:
            print(f"SMS sending failed: {str(e)}")
            return False
    
    def _send_whatsapp(self, user, notification):
        """Send WhatsApp notification via Twilio"""
        try:
            self._initialize_clients()
            if not self.twilio_client or not user.phone:
                return False
            
            # Format phone number for WhatsApp
            whatsapp_to = f"whatsapp:{user.phone}"
            whatsapp_from = f"whatsapp:{current_app.config['TWILIO_PHONE_NUMBER']}"
            
            message = self.twilio_client.messages.create(
                body=notification.message,
                from_=whatsapp_from,
                to=whatsapp_to
            )
            
            return message.sid is not None
            
        except Exception as e:
            print(f"WhatsApp sending failed: {str(e)}")
            return False
    
    def _send_push(self, user, notification):
        """Send push notification"""
        try:
            # This would integrate with a push notification service like FCM
            # For now, we'll just log it
            print(f"Push notification for user {user.id}: {notification.title}")
            return True
            
        except Exception as e:
            print(f"Push notification failed: {str(e)}")
            return False
    
    def _is_quiet_hours(self, user, notification_time):
        """Check if notification time falls within user's quiet hours"""
        try:
            prefs = user.notification_preferences or {}
            quiet_start = prefs.get('quiet_hours_start', '22:00')
            quiet_end = prefs.get('quiet_hours_end', '08:00')
            
            # Convert to user's timezone
            user_tz = pytz.timezone(user.timezone)
            local_time = notification_time.replace(tzinfo=pytz.UTC).astimezone(user_tz)
            time_str = local_time.strftime('%H:%M')
            
            # Simple time comparison (doesn't handle overnight quiet hours)
            if quiet_start <= quiet_end:
                return quiet_start <= time_str <= quiet_end
            else:
                # Overnight quiet hours (e.g., 22:00 to 08:00)
                return time_str >= quiet_start or time_str <= quiet_end
                
        except Exception as e:
            return False
    
    def _get_next_available_time(self, user, notification_time):
        """Get next available time outside quiet hours"""
        try:
            prefs = user.notification_preferences or {}
            quiet_end = prefs.get('quiet_hours_end', '08:00')
            
            # Convert to user's timezone
            user_tz = pytz.timezone(user.timezone)
            local_time = notification_time.replace(tzinfo=pytz.UTC).astimezone(user_tz)
            
            # Set to end of quiet hours
            hour, minute = map(int, quiet_end.split(':'))
            next_time = local_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # If next time is before current time, add a day
            if next_time <= local_time:
                next_time += timedelta(days=1)
            
            # Convert back to UTC
            return next_time.astimezone(pytz.UTC).replace(tzinfo=None)
            
        except Exception as e:
            # Default to 1 hour later
            return notification_time + timedelta(hours=1)
    
    def get_pending_notifications(self):
        """Get notifications that are due to be sent"""
        try:
            now = datetime.utcnow()
            notifications = Notification.query.filter(
                Notification.scheduled_for <= now,
                Notification.is_sent == False
            ).all()
            
            return notifications
            
        except Exception as e:
            raise e
    
    def process_pending_notifications(self):
        """Process all pending notifications"""
        try:
            pending_notifications = self.get_pending_notifications()
            
            for notification in pending_notifications:
                self.send_notification(notification)
            
            return len(pending_notifications)
            
        except Exception as e:
            raise e
    
    def get_user_notifications(self, user_id, page=1, per_page=10, unread_only=False):
        """Get notifications for a user"""
        try:
            query = Notification.query.filter_by(user_id=user_id)
            
            if unread_only:
                query = query.filter_by(is_sent=False)
            
            notifications = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return notifications
            
        except Exception as e:
            raise e
    
    def mark_notification_sent(self, notification_id, user_id):
        """Mark notification as sent"""
        try:
            notification = Notification.query.filter_by(
                id=notification_id, user_id=user_id
            ).first()
            
            if not notification:
                raise ValueError('Notification not found')
            
            notification.is_sent = True
            notification.sent_at = datetime.utcnow()
            db.session.commit()
            
            return notification
            
        except Exception as e:
            db.session.rollback()
            raise e
