from models import ComplianceRule, Deadline, db, DeadlineType
from datetime import datetime, timedelta
from flask import current_app
import pytz

class ComplianceService:
    def __init__(self):
        self.gst_filing_deadlines = {
            'monthly': 20,
            'quarterly': 20,
            'annual': 31
        }
        self._initialized = False
    
    def _initialize_config(self):
        """Initialize config when app context is available"""
        if self._initialized:
            return
            
        from flask import current_app
        self.gst_filing_deadlines = current_app.config.get('GST_FILING_DEADLINES', self.gst_filing_deadlines)
        self._initialized = True
    
    def check_compliance(self, document_type, user_data, user_id):
        """Check compliance requirements for a document type"""
        try:
            self._initialize_config()
            compliance_result = {
                'is_compliant': True,
                'requirements': [],
                'deadlines': [],
                'warnings': [],
                'recommendations': []
            }
            
            # Check GST compliance
            if document_type in ['gst', 'business', 'tax']:
                gst_compliance = self._check_gst_compliance(user_data, user_id)
                compliance_result.update(gst_compliance)
            
            # Check general legal compliance
            legal_compliance = self._check_legal_compliance(document_type, user_data)
            compliance_result['requirements'].extend(legal_compliance.get('requirements', []))
            compliance_result['warnings'].extend(legal_compliance.get('warnings', []))
            compliance_result['recommendations'].extend(legal_compliance.get('recommendations', []))
            
            # Check custom compliance rules
            custom_rules = self._check_custom_rules(document_type, user_data, user_id)
            compliance_result['requirements'].extend(custom_rules.get('requirements', []))
            compliance_result['warnings'].extend(custom_rules.get('warnings', []))
            
            # Determine overall compliance
            if compliance_result['warnings'] or any(req.get('critical', False) for req in compliance_result['requirements']):
                compliance_result['is_compliant'] = False
            
            return compliance_result
            
        except Exception as e:
            return {
                'is_compliant': False,
                'error': str(e),
                'requirements': [],
                'deadlines': [],
                'warnings': ['Unable to check compliance due to system error'],
                'recommendations': []
            }
    
    def _check_gst_compliance(self, user_data, user_id):
        """Check GST compliance requirements"""
        try:
            compliance = {
                'requirements': [],
                'deadlines': [],
                'warnings': [],
                'recommendations': []
            }
            
            # Check GST registration
            if not user_data.get('gst_number'):
                compliance['requirements'].append({
                    'type': 'gst_registration',
                    'description': 'GST registration is required for businesses with turnover above threshold',
                    'critical': True,
                    'action': 'Register for GST'
                })
            
            # Check GST filing deadlines
            business_type = user_data.get('business_type', 'monthly')
            if business_type in self.gst_filing_deadlines:
                deadline_day = self.gst_filing_deadlines[business_type]
                
                # Calculate next filing deadline
                next_deadline = self._calculate_next_gst_deadline(business_type, deadline_day)
                
                compliance['deadlines'].append({
                    'type': 'gst_filing',
                    'description': f'GST {business_type} return filing',
                    'due_date': next_deadline.isoformat(),
                    'days_remaining': (next_deadline - datetime.utcnow()).days,
                    'critical': True
                })
                
                # Create deadline record
                self._create_gst_deadline(user_id, business_type, next_deadline)
            
            # Check HSN/SAC codes
            if user_data.get('business_activities'):
                compliance['requirements'].append({
                    'type': 'hsn_sac_codes',
                    'description': 'Ensure proper HSN/SAC codes are used for goods/services',
                    'critical': False,
                    'action': 'Verify HSN/SAC codes'
                })
            
            # Check input tax credit
            if user_data.get('has_purchases'):
                compliance['requirements'].append({
                    'type': 'input_tax_credit',
                    'description': 'Maintain proper records for input tax credit claims',
                    'critical': False,
                    'action': 'Maintain purchase records'
                })
            
            return compliance
            
        except Exception as e:
            return {
                'requirements': [],
                'deadlines': [],
                'warnings': [f'GST compliance check failed: {str(e)}'],
                'recommendations': []
            }
    
    def _check_legal_compliance(self, document_type, user_data):
        """Check general legal compliance requirements"""
        try:
            compliance = {
                'requirements': [],
                'warnings': [],
                'recommendations': []
            }
            
            # Document-specific compliance checks
            if document_type == 'contract':
                compliance['requirements'].append({
                    'type': 'contract_terms',
                    'description': 'Ensure all essential terms are clearly defined',
                    'critical': True,
                    'action': 'Review contract terms'
                })
                
                if not user_data.get('parties_defined'):
                    compliance['warnings'].append('Parties to the contract should be clearly identified')
                
                if not user_data.get('consideration_defined'):
                    compliance['warnings'].append('Consideration/compensation should be clearly specified')
            
            elif document_type == 'property':
                compliance['requirements'].append({
                    'type': 'property_verification',
                    'description': 'Verify property title and ownership',
                    'critical': True,
                    'action': 'Conduct title verification'
                })
                
                if not user_data.get('encumbrance_check'):
                    compliance['warnings'].append('Check for any encumbrances on the property')
            
            elif document_type == 'trademark':
                compliance['requirements'].append({
                    'type': 'trademark_search',
                    'description': 'Conduct trademark search before filing',
                    'critical': True,
                    'action': 'Perform trademark search'
                })
            
            elif document_type == 'divorce':
                compliance['requirements'].append({
                    'type': 'marriage_certificate',
                    'description': 'Marriage certificate is required for divorce proceedings',
                    'critical': True,
                    'action': 'Obtain marriage certificate'
                })
            
            # General recommendations
            compliance['recommendations'].extend([
                'Consult with a qualified legal professional for complex matters',
                'Keep copies of all legal documents',
                'Maintain proper documentation for all transactions'
            ])
            
            return compliance
            
        except Exception as e:
            return {
                'requirements': [],
                'warnings': [f'Legal compliance check failed: {str(e)}'],
                'recommendations': []
            }
    
    def _check_custom_rules(self, document_type, user_data, user_id):
        """Check custom compliance rules"""
        try:
            compliance = {
                'requirements': [],
                'warnings': []
            }
            
            # Get active compliance rules for the document type
            rules = ComplianceRule.query.filter_by(
                rule_type=document_type,
                is_active=True
            ).all()
            
            for rule in rules:
                # Check rule conditions
                if self._evaluate_rule_conditions(rule.conditions, user_data):
                    # Apply rule actions
                    for action in rule.actions:
                        if action['type'] == 'requirement':
                            compliance['requirements'].append({
                                'type': action.get('id', 'custom_requirement'),
                                'description': action.get('description', 'Custom compliance requirement'),
                                'critical': action.get('critical', False),
                                'action': action.get('action', 'Take required action')
                            })
                        elif action['type'] == 'warning':
                            compliance['warnings'].append(action.get('message', 'Custom compliance warning'))
            
            return compliance
            
        except Exception as e:
            return {
                'requirements': [],
                'warnings': [f'Custom rules check failed: {str(e)}']
            }
    
    def _evaluate_rule_conditions(self, conditions, user_data):
        """Evaluate rule conditions against user data"""
        try:
            for condition in conditions:
                field = condition.get('field')
                operator = condition.get('operator')
                value = condition.get('value')
                
                user_value = user_data.get(field)
                
                if operator == 'equals':
                    if user_value != value:
                        return False
                elif operator == 'not_equals':
                    if user_value == value:
                        return False
                elif operator == 'contains':
                    if value not in str(user_value):
                        return False
                elif operator == 'greater_than':
                    if not (user_value and float(user_value) > float(value)):
                        return False
                elif operator == 'less_than':
                    if not (user_value and float(user_value) < float(value)):
                        return False
            
            return True
            
        except Exception as e:
            return False
    
    def _calculate_next_gst_deadline(self, business_type, deadline_day):
        """Calculate next GST filing deadline"""
        try:
            now = datetime.utcnow()
            
            if business_type == 'monthly':
                # 20th of next month
                if now.day <= deadline_day:
                    next_deadline = now.replace(day=deadline_day)
                else:
                    # Next month
                    if now.month == 12:
                        next_deadline = now.replace(year=now.year + 1, month=1, day=deadline_day)
                    else:
                        next_deadline = now.replace(month=now.month + 1, day=deadline_day)
            
            elif business_type == 'quarterly':
                # 20th of next quarter
                current_quarter = (now.month - 1) // 3 + 1
                next_quarter = current_quarter + 1 if current_quarter < 4 else 1
                next_quarter_month = (next_quarter - 1) * 3 + 1
                
                if next_quarter == 1:
                    next_deadline = now.replace(year=now.year + 1, month=next_quarter_month, day=deadline_day)
                else:
                    next_deadline = now.replace(month=next_quarter_month, day=deadline_day)
            
            elif business_type == 'annual':
                # 31st December
                next_deadline = now.replace(month=12, day=31)
                if now.month == 12 and now.day > 31:
                    next_deadline = next_deadline.replace(year=now.year + 1)
            
            else:
                # Default to monthly
                next_deadline = now.replace(day=deadline_day)
                if now.day > deadline_day:
                    if now.month == 12:
                        next_deadline = now.replace(year=now.year + 1, month=1, day=deadline_day)
                    else:
                        next_deadline = now.replace(month=now.month + 1, day=deadline_day)
            
            return next_deadline
            
        except Exception as e:
            # Fallback to 30 days from now
            return datetime.utcnow() + timedelta(days=30)
    
    def _create_gst_deadline(self, user_id, business_type, due_date):
        """Create GST filing deadline"""
        try:
            # Check if deadline already exists
            existing_deadline = Deadline.query.filter_by(
                user_id=user_id,
                deadline_type=DeadlineType.GST_FILING,
                due_date=due_date
            ).first()
            
            if existing_deadline:
                return existing_deadline
            
            deadline = Deadline(
                user_id=user_id,
                title=f'GST {business_type.title()} Return Filing',
                description=f'File GST {business_type} return by {due_date.strftime("%Y-%m-%d")}',
                deadline_type=DeadlineType.GST_FILING,
                due_date=due_date,
                is_recurring=True,
                recurrence_pattern=business_type,
                reminder_days=[7, 3, 1],
                metadata={'business_type': business_type, 'auto_generated': True}
            )
            
            db.session.add(deadline)
            db.session.commit()
            
            return deadline
            
        except Exception as e:
            db.session.rollback()
            raise e
    
    def get_compliance_summary(self, user_id):
        """Get compliance summary for a user"""
        try:
            # Get all deadlines
            deadlines = Deadline.query.filter_by(user_id=user_id).all()
            
            # Categorize deadlines
            gst_deadlines = [d for d in deadlines if d.deadline_type == DeadlineType.GST_FILING]
            compliance_deadlines = [d for d in deadlines if d.deadline_type == DeadlineType.COMPLIANCE]
            custom_deadlines = [d for d in deadlines if d.deadline_type == DeadlineType.CUSTOM]
            
            # Calculate statistics
            total_deadlines = len(deadlines)
            completed_deadlines = len([d for d in deadlines if d.is_completed])
            upcoming_deadlines = len([d for d in deadlines if d.due_date > datetime.utcnow() and not d.is_completed])
            overdue_deadlines = len([d for d in deadlines if d.due_date < datetime.utcnow() and not d.is_completed])
            
            return {
                'total_deadlines': total_deadlines,
                'completed_deadlines': completed_deadlines,
                'upcoming_deadlines': upcoming_deadlines,
                'overdue_deadlines': overdue_deadlines,
                'completion_rate': (completed_deadlines / total_deadlines * 100) if total_deadlines > 0 else 0,
                'gst_deadlines': len(gst_deadlines),
                'compliance_deadlines': len(compliance_deadlines),
                'custom_deadlines': len(custom_deadlines)
            }
            
        except Exception as e:
            raise e
    
    def create_compliance_rule(self, rule_data, created_by):
        """Create a new compliance rule"""
        try:
            rule = ComplianceRule(
                name=rule_data['name'],
                description=rule_data.get('description'),
                rule_type=rule_data['rule_type'],
                conditions=rule_data['conditions'],
                actions=rule_data['actions'],
                created_by=created_by
            )
            
            db.session.add(rule)
            db.session.commit()
            
            return rule
            
        except Exception as e:
            db.session.rollback()
            raise e
