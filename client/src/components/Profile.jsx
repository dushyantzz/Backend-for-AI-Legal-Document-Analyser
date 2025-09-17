import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Typography,
  Button,
  Input,
  Select,
  Option,
  Textarea,
  Switch,
} from '@material-tailwind/react';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    language_preference: 'en',
    timezone: 'Asia/Kolkata',
    notification_preferences: {
      email: true,
      sms: false,
      whatsapp: false,
      push: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    },
  });

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'bn', name: 'Bengali' },
    { code: 'te', name: 'Telugu' },
    { code: 'mr', name: 'Marathi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'ur', name: 'Urdu' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'or', name: 'Odia' },
  ];

  const timezones = [
    'Asia/Kolkata',
    'Asia/Dubai',
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        language_preference: user.language_preference || 'en',
        timezone: user.timezone || 'Asia/Kolkata',
        notification_preferences: user.notification_preferences || {
          email: true,
          sms: false,
          whatsapp: false,
          push: true,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
        },
      });
    }
  }, [isAuthenticated, navigate, user]);

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNotificationChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const result = await updateProfile(profileData);
      if (result.success) {
        // Profile updated successfully
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Typography variant="h3" className="text-gray-800 mb-2">
            Profile Settings
          </Typography>
          <Typography variant="lead" className="text-gray-600">
            Manage your account information and preferences.
          </Typography>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-lg">
              <CardBody className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <UserIcon className="h-6 w-6 text-blue-500" />
                  <Typography variant="h5" className="text-gray-800">
                    Personal Information
                  </Typography>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Input
                    label="First Name"
                    value={profileData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    icon={<UserIcon className="h-5 w-5" />}
                  />
                  <Input
                    label="Last Name"
                    value={profileData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    icon={<UserIcon className="h-5 w-5" />}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Input
                    label="Email"
                    type="email"
                    value={profileData.email}
                    disabled
                    icon={<EnvelopeIcon className="h-5 w-5" />}
                  />
                  <Input
                    label="Phone"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    icon={<PhoneIcon className="h-5 w-5" />}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Select
                    label="Language Preference"
                    value={profileData.language_preference}
                    onChange={(value) => handleInputChange('language_preference', value)}
                  >
                    {languages.map((lang) => (
                      <Option key={lang.code} value={lang.code}>
                        {lang.name}
                      </Option>
                    ))}
                  </Select>
                  <Select
                    label="Timezone"
                    value={profileData.timezone}
                    onChange={(value) => handleInputChange('timezone', value)}
                  >
                    {timezones.map((tz) => (
                      <Option key={tz} value={tz}>
                        {tz}
                      </Option>
                    ))}
                  </Select>
                </div>

                <Button
                  color="blue"
                  onClick={handleSave}
                  loading={loading}
                  className="w-full md:w-auto"
                >
                  Save Changes
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Notification Preferences */}
          <div>
            <Card className="bg-white shadow-lg">
              <CardBody className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <BellIcon className="h-6 w-6 text-green-500" />
                  <Typography variant="h5" className="text-gray-800">
                    Notifications
                  </Typography>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Typography variant="small" className="font-semibold">
                        Email Notifications
                      </Typography>
                      <Typography variant="small" className="text-gray-600">
                        Receive deadline reminders via email
                      </Typography>
                    </div>
                    <Switch
                      checked={profileData.notification_preferences.email}
                      onChange={(e) => handleNotificationChange('email', e.target.checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Typography variant="small" className="font-semibold">
                        SMS Notifications
                      </Typography>
                      <Typography variant="small" className="text-gray-600">
                        Receive deadline reminders via SMS
                      </Typography>
                    </div>
                    <Switch
                      checked={profileData.notification_preferences.sms}
                      onChange={(e) => handleNotificationChange('sms', e.target.checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Typography variant="small" className="font-semibold">
                        WhatsApp Notifications
                      </Typography>
                      <Typography variant="small" className="text-gray-600">
                        Receive deadline reminders via WhatsApp
                      </Typography>
                    </div>
                    <Switch
                      checked={profileData.notification_preferences.whatsapp}
                      onChange={(e) => handleNotificationChange('whatsapp', e.target.checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Typography variant="small" className="font-semibold">
                        Push Notifications
                      </Typography>
                      <Typography variant="small" className="text-gray-600">
                        Receive push notifications in browser
                      </Typography>
                    </div>
                    <Switch
                      checked={profileData.notification_preferences.push}
                      onChange={(e) => handleNotificationChange('push', e.target.checked)}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <Typography variant="small" className="font-semibold mb-3">
                    Quiet Hours
                  </Typography>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start Time"
                      type="time"
                      value={profileData.notification_preferences.quiet_hours_start}
                      onChange={(e) => handleNotificationChange('quiet_hours_start', e.target.value)}
                    />
                    <Input
                      label="End Time"
                      type="time"
                      value={profileData.notification_preferences.quiet_hours_end}
                      onChange={(e) => handleNotificationChange('quiet_hours_end', e.target.value)}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Account Information */}
            <Card className="bg-white shadow-lg mt-6">
              <CardBody className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <GlobeAltIcon className="h-6 w-6 text-purple-500" />
                  <Typography variant="h5" className="text-gray-800">
                    Account Info
                  </Typography>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Member since:</span>
                    <span className="font-semibold">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account status:</span>
                    <span className="font-semibold text-green-600">Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email verified:</span>
                    <span className={`font-semibold ${user?.is_verified ? 'text-green-600' : 'text-red-600'}`}>
                      {user?.is_verified ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
