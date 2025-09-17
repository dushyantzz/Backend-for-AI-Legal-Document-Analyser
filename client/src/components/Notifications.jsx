import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Card,
  CardBody,
  Typography,
  Button,
  Input,
  Chip,
  Badge,
} from '@material-tailwind/react';
import {
  BellIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const Notifications = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [isAuthenticated, navigate, currentPage, showUnreadOnly]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.getNotifications(currentPage, 10, showUnreadOnly);
      setNotifications(response.notifications || []);
      setTotalPages(response.pages || 1);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'email':
        return <EnvelopeIcon className="h-5 w-5" />;
      case 'sms':
        return <DevicePhoneMobileIcon className="h-5 w-5" />;
      case 'whatsapp':
        return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
      case 'push':
        return <BellIcon className="h-5 w-5" />;
      default:
        return <BellIcon className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'email':
        return 'blue';
      case 'sms':
        return 'green';
      case 'whatsapp':
        return 'green';
      case 'push':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const filteredNotifications = notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <Typography variant="h6">Loading notifications...</Typography>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Typography variant="h3" className="text-gray-800 mb-2">
              Notifications
            </Typography>
            <Typography variant="lead" className="text-gray-600">
              Stay updated with your legal deadlines and important updates.
            </Typography>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showUnreadOnly ? "filled" : "outlined"}
              color="blue"
              size="sm"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            >
              Unread Only
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            label="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<BellIcon className="h-5 w-5" />}
          />
        </div>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`bg-white shadow-lg ${
                  !notification.is_sent ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full bg-${getNotificationColor(notification.notification_type)}-100`}>
                      <div className={`text-${getNotificationColor(notification.notification_type)}-600`}>
                        {getNotificationIcon(notification.notification_type)}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <Typography variant="h6" className="text-gray-800">
                          {notification.title}
                        </Typography>
                        <div className="flex items-center gap-2">
                          <Chip
                            color={getNotificationColor(notification.notification_type)}
                            size="sm"
                            value={notification.notification_type.toUpperCase()}
                          />
                          {!notification.is_sent && (
                            <Badge color="red" content="">
                              <ClockIcon className="h-5 w-5 text-gray-400" />
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Typography variant="small" className="text-gray-600 mb-3">
                        {notification.message}
                      </Typography>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-4">
                          <span>
                            Scheduled: {new Date(notification.scheduled_for).toLocaleString()}
                          </span>
                          {notification.sent_at && (
                            <span>
                              Sent: {new Date(notification.sent_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {notification.is_sent ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircleIcon className="h-4 w-4" />
                              <span>Sent</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-orange-600">
                              <ClockIcon className="h-4 w-4" />
                              <span>Pending</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardBody className="p-12 text-center">
              <BellIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <Typography variant="h5" className="text-gray-600 mb-2">
                No notifications found
              </Typography>
              <Typography variant="small" className="text-gray-500 mb-6">
                {searchTerm || showUnreadOnly
                  ? 'Try adjusting your search or filters.'
                  : 'You\'re all caught up! No notifications at the moment.'}
              </Typography>
            </CardBody>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex gap-2">
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "filled" : "outlined"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Notification Settings Info */}
        <Card className="bg-blue-50 border border-blue-200 mt-8">
          <CardBody className="p-6">
            <div className="flex items-start gap-3">
              <BellIcon className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <Typography variant="h6" className="text-blue-800 mb-2">
                  Notification Settings
                </Typography>
                <Typography variant="small" className="text-blue-700 mb-3">
                  Manage your notification preferences in your profile settings to control how and when you receive reminders.
                </Typography>
                <Button
                  color="blue"
                  variant="outlined"
                  size="sm"
                  onClick={() => navigate('/profile')}
                >
                  Go to Profile Settings
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
