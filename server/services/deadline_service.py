from models import Deadline, db, DeadlineType
from datetime import datetime, timedelta
from services.notification_service import NotificationService
import pytz
from croniter import croniter

class DeadlineService:
    def __init__(self):
        self.notification_service = NotificationService()
    
    def create_deadline(self, user_id, deadline_data):
        """Create a new deadline"""
        try:
            # Parse due date
            if isinstance(deadline_data['due_date'], str):
                due_date = datetime.fromisoformat(deadline_data['due_date'].replace('Z', '+00:00'))
            else:
                due_date = deadline_data['due_date']
            
            deadline = Deadline(
                user_id=user_id,
                document_id=deadline_data.get('document_id'),
                title=deadline_data['title'],
                description=deadline_data.get('description'),
                deadline_type=DeadlineType(deadline_data['deadline_type']),
                due_date=due_date,
                is_recurring=deadline_data.get('is_recurring', False),
                recurrence_pattern=deadline_data.get('recurrence_pattern'),
                reminder_days=deadline_data.get('reminder_days', [7, 3, 1]),
                metadata=deadline_data.get('metadata', {})
            )
            
            db.session.add(deadline)
            db.session.commit()
            
            # Schedule notifications
            self.notification_service.schedule_deadline_notifications(deadline)
            
            return deadline
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def get_user_deadlines(self, user_id, page=1, per_page=10, deadline_type=None, upcoming_only=False):
        """Get deadlines for a user with pagination"""
        try:
            query = Deadline.query.filter_by(user_id=user_id)
            
            if deadline_type:
                query = query.filter_by(deadline_type=DeadlineType(deadline_type))
            
            if upcoming_only:
                query = query.filter(Deadline.due_date > datetime.utcnow())
            
            deadlines = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return deadlines
            
        except Exception as e:
            raise e
    
    def get_deadline(self, deadline_id, user_id):
        """Get a specific deadline"""
        try:
            deadline = Deadline.query.filter_by(
                id=deadline_id, user_id=user_id
            ).first()
            
            if not deadline:
                raise ValueError('Deadline not found')
            
            return deadline
            
        except Exception as e:
            raise e
    
    def update_deadline(self, deadline_id, user_id, update_data):
        """Update deadline"""
        try:
            deadline = Deadline.query.filter_by(
                id=deadline_id, user_id=user_id
            ).first()
            
            if not deadline:
                raise ValueError('Deadline not found')
            
            # Update allowed fields
            if 'title' in update_data:
                deadline.title = update_data['title']
            if 'description' in update_data:
                deadline.description = update_data['description']
            if 'due_date' in update_data:
                if isinstance(update_data['due_date'], str):
                    deadline.due_date = datetime.fromisoformat(update_data['due_date'].replace('Z', '+00:00'))
                else:
                    deadline.due_date = update_data['due_date']
            if 'is_recurring' in update_data:
                deadline.is_recurring = update_data['is_recurring']
            if 'recurrence_pattern' in update_data:
                deadline.recurrence_pattern = update_data['recurrence_pattern']
            if 'reminder_days' in update_data:
                deadline.reminder_days = update_data['reminder_days']
            if 'metadata' in update_data:
                deadline.metadata = update_data['metadata']
            
            deadline.updated_at = datetime.utcnow()
            db.session.commit()
            
            # Reschedule notifications if due date changed
            if 'due_date' in update_data:
                self.notification_service.schedule_deadline_notifications(deadline)
            
            return deadline
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def mark_deadline_completed(self, deadline_id, user_id):
        """Mark deadline as completed"""
        try:
            deadline = Deadline.query.filter_by(
                id=deadline_id, user_id=user_id
            ).first()
            
            if not deadline:
                raise ValueError('Deadline not found')
            
            deadline.is_completed = True
            deadline.completed_at = datetime.utcnow()
            deadline.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            # If recurring, create next occurrence
            if deadline.is_recurring and deadline.recurrence_pattern:
                self._create_next_recurring_deadline(deadline)
            
            return deadline
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def delete_deadline(self, deadline_id, user_id):
        """Delete deadline"""
        try:
            deadline = Deadline.query.filter_by(
                id=deadline_id, user_id=user_id
            ).first()
            
            if not deadline:
                raise ValueError('Deadline not found')
            
            db.session.delete(deadline)
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def get_upcoming_deadlines(self, user_id, days_ahead=30):
        """Get upcoming deadlines within specified days"""
        try:
            end_date = datetime.utcnow() + timedelta(days=days_ahead)
            
            deadlines = Deadline.query.filter(
                Deadline.user_id == user_id,
                Deadline.due_date > datetime.utcnow(),
                Deadline.due_date <= end_date,
                Deadline.is_completed == False
            ).order_by(Deadline.due_date).all()
            
            return deadlines
            
        except Exception as e:
            raise e
    
    def get_overdue_deadlines(self, user_id):
        """Get overdue deadlines"""
        try:
            deadlines = Deadline.query.filter(
                Deadline.user_id == user_id,
                Deadline.due_date < datetime.utcnow(),
                Deadline.is_completed == False
            ).order_by(Deadline.due_date).all()
            
            return deadlines
            
        except Exception as e:
            raise e
    
    def _create_next_recurring_deadline(self, completed_deadline):
        """Create next occurrence of recurring deadline"""
        try:
            if not completed_deadline.recurrence_pattern:
                return
            
            # Calculate next due date based on recurrence pattern
            next_due_date = self._calculate_next_due_date(
                completed_deadline.due_date,
                completed_deadline.recurrence_pattern
            )
            
            # Create new deadline
            new_deadline = Deadline(
                user_id=completed_deadline.user_id,
                document_id=completed_deadline.document_id,
                title=completed_deadline.title,
                description=completed_deadline.description,
                deadline_type=completed_deadline.deadline_type,
                due_date=next_due_date,
                is_recurring=completed_deadline.is_recurring,
                recurrence_pattern=completed_deadline.recurrence_pattern,
                reminder_days=completed_deadline.reminder_days,
                metadata=completed_deadline.metadata
            )
            
            db.session.add(new_deadline)
            db.session.commit()
            
            # Schedule notifications for new deadline
            self.notification_service.schedule_deadline_notifications(new_deadline)
            
            return new_deadline
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def _calculate_next_due_date(self, current_due_date, recurrence_pattern):
        """Calculate next due date based on recurrence pattern"""
        try:
            if recurrence_pattern == 'daily':
                return current_due_date + timedelta(days=1)
            elif recurrence_pattern == 'weekly':
                return current_due_date + timedelta(weeks=1)
            elif recurrence_pattern == 'monthly':
                # Add one month, handling month-end edge cases
                if current_due_date.month == 12:
                    return current_due_date.replace(year=current_due_date.year + 1, month=1)
                else:
                    return current_due_date.replace(month=current_due_date.month + 1)
            elif recurrence_pattern == 'quarterly':
                # Add 3 months
                new_month = current_due_date.month + 3
                new_year = current_due_date.year
                if new_month > 12:
                    new_month -= 12
                    new_year += 1
                return current_due_date.replace(year=new_year, month=new_month)
            elif recurrence_pattern == 'annually':
                return current_due_date.replace(year=current_due_date.year + 1)
            else:
                # Default to monthly if pattern not recognized
                return current_due_date.replace(month=current_due_date.month + 1)
                
        except Exception as e:
            raise e
    
    def get_deadline_statistics(self, user_id):
        """Get deadline statistics for user"""
        try:
            total_deadlines = Deadline.query.filter_by(user_id=user_id).count()
            completed_deadlines = Deadline.query.filter_by(
                user_id=user_id, is_completed=True
            ).count()
            upcoming_deadlines = Deadline.query.filter(
                Deadline.user_id == user_id,
                Deadline.due_date > datetime.utcnow(),
                Deadline.is_completed == False
            ).count()
            overdue_deadlines = Deadline.query.filter(
                Deadline.user_id == user_id,
                Deadline.due_date < datetime.utcnow(),
                Deadline.is_completed == False
            ).count()
            
            return {
                'total': total_deadlines,
                'completed': completed_deadlines,
                'upcoming': upcoming_deadlines,
                'overdue': overdue_deadlines,
                'completion_rate': (completed_deadlines / total_deadlines * 100) if total_deadlines > 0 else 0
            }
            
        except Exception as e:
            raise e
