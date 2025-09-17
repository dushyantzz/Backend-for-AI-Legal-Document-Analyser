import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Card,
  CardBody,
  Typography,
  Button,
  Progress,
  Alert,
} from '@material-tailwind/react';
import {
  DocumentTextIcon,
  ClockIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalDeadlines: 0,
    upcomingDeadlines: 0,
    overdueDeadlines: 0,
    notifications: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch documents
      const documentsResponse = await api.getDocuments(1, 5);
      setRecentDocuments(documentsResponse.documents || []);

      // Fetch deadlines
      const deadlinesResponse = await api.getDeadlines(1, 10, null, true);
      setUpcomingDeadlines(deadlinesResponse.deadlines || []);

      // Calculate stats
      setStats({
        totalDocuments: documentsResponse.total || 0,
        totalDeadlines: deadlinesResponse.total || 0,
        upcomingDeadlines: deadlinesResponse.deadlines?.length || 0,
        overdueDeadlines: 0, // You can implement this based on your needs
        notifications: 0, // You can implement this based on your needs
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <Typography variant="h6">Loading dashboard...</Typography>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <Typography variant="h3" className="text-gray-800 mb-2">
            Welcome back, {user?.first_name}!
          </Typography>
          <Typography variant="lead" className="text-gray-600">
            Here's an overview of your legal documents and deadlines.
          </Typography>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Typography variant="h6" className="text-gray-600 mb-1">
                    Total Documents
                  </Typography>
                  <Typography variant="h3" className="text-blue-600">
                    {stats.totalDocuments}
                  </Typography>
                </div>
                <DocumentTextIcon className="h-12 w-12 text-blue-500" />
              </div>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Typography variant="h6" className="text-gray-600 mb-1">
                    Upcoming Deadlines
                  </Typography>
                  <Typography variant="h3" className="text-orange-600">
                    {stats.upcomingDeadlines}
                  </Typography>
                </div>
                <ClockIcon className="h-12 w-12 text-orange-500" />
              </div>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Typography variant="h6" className="text-gray-600 mb-1">
                    Overdue
                  </Typography>
                  <Typography variant="h3" className="text-red-600">
                    {stats.overdueDeadlines}
                  </Typography>
                </div>
                <ExclamationTriangleIcon className="h-12 w-12 text-red-500" />
              </div>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Typography variant="h6" className="text-gray-600 mb-1">
                    Notifications
                  </Typography>
                  <Typography variant="h3" className="text-green-600">
                    {stats.notifications}
                  </Typography>
                </div>
                <BellIcon className="h-12 w-12 text-green-500" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <Typography variant="h5" className="text-gray-800 mb-4">
            Quick Actions
          </Typography>
          <div className="flex flex-wrap gap-4">
            <Button
              color="blue"
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2"
            >
              <DocumentTextIcon className="h-5 w-5" />
              View All Documents
            </Button>
            <Button
              color="orange"
              onClick={() => navigate('/deadlines')}
              className="flex items-center gap-2"
            >
              <ClockIcon className="h-5 w-5" />
              Manage Deadlines
            </Button>
            <Button
              color="green"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <DocumentTextIcon className="h-5 w-5" />
              Create New Document
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Documents */}
          <Card className="bg-white shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-gray-800">
                  Recent Documents
                </Typography>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => navigate('/documents')}
                >
                  View All
                </Button>
              </div>
              {recentDocuments.length > 0 ? (
                <div className="space-y-3">
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <Typography variant="small" className="font-semibold">
                          {doc.title}
                        </Typography>
                        <Typography variant="small" className="text-gray-600">
                          {doc.document_type}
                        </Typography>
                      </div>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <Typography variant="small" className="text-gray-600">
                    No documents yet. Create your first document!
                  </Typography>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="bg-white shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="text-gray-800">
                  Upcoming Deadlines
                </Typography>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => navigate('/deadlines')}
                >
                  View All
                </Button>
              </div>
              {upcomingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {upcomingDeadlines.slice(0, 5).map((deadline) => (
                    <div
                      key={deadline.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <Typography variant="small" className="font-semibold">
                          {deadline.title}
                        </Typography>
                        <Typography variant="small" className="text-gray-600">
                          Due: {new Date(deadline.due_date).toLocaleDateString()}
                        </Typography>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <Typography variant="small" className="text-gray-600">
                    No upcoming deadlines. You're all caught up!
                  </Typography>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Alerts */}
        {stats.overdueDeadlines > 0 && (
          <Alert
            color="red"
            className="mt-8"
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          >
            You have {stats.overdueDeadlines} overdue deadline(s). Please review them immediately.
          </Alert>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
