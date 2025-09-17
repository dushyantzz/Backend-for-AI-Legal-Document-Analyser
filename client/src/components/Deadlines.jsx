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
  Select,
  Option,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Textarea,
  Chip,
} from '@material-tailwind/react';
import {
  ClockIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const Deadlines = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDeadline, setNewDeadline] = useState({
    title: '',
    description: '',
    due_date: '',
    deadline_type: '',
    is_recurring: false,
    recurrence_pattern: '',
    reminder_days: [7, 3, 1],
  });

  const deadlineTypes = [
    'gst_filing',
    'renewal',
    'compliance',
    'custom',
  ];

  const recurrencePatterns = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'annually',
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchDeadlines();
  }, [isAuthenticated, navigate, currentPage, filterType, showUpcomingOnly]);

  const fetchDeadlines = async () => {
    try {
      setLoading(true);
      const response = await api.getDeadlines(
        currentPage,
        10,
        filterType || null,
        showUpcomingOnly
      );
      setDeadlines(response.deadlines || []);
      setTotalPages(response.pages || 1);
    } catch (error) {
      console.error('Error fetching deadlines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeadline = async () => {
    try {
      await api.createDeadline(newDeadline);
      setShowCreateDialog(false);
      setNewDeadline({
        title: '',
        description: '',
        due_date: '',
        deadline_type: '',
        is_recurring: false,
        recurrence_pattern: '',
        reminder_days: [7, 3, 1],
      });
      fetchDeadlines();
    } catch (error) {
      console.error('Error creating deadline:', error);
    }
  };

  const handleDeleteDeadline = async (id) => {
    if (window.confirm('Are you sure you want to delete this deadline?')) {
      try {
        await api.deleteDeadline(id);
        fetchDeadlines();
      } catch (error) {
        console.error('Error deleting deadline:', error);
      }
    }
  };

  const getStatusColor = (deadline) => {
    const now = new Date();
    const dueDate = new Date(deadline.due_date);
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (deadline.is_completed) return 'green';
    if (daysUntilDue < 0) return 'red';
    if (daysUntilDue <= 3) return 'orange';
    return 'blue';
  };

  const getStatusText = (deadline) => {
    const now = new Date();
    const dueDate = new Date(deadline.due_date);
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (deadline.is_completed) return 'Completed';
    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue <= 3) return 'Due Soon';
    return 'Upcoming';
  };

  const filteredDeadlines = deadlines.filter(deadline =>
    deadline.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deadline.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <Typography variant="h6">Loading deadlines...</Typography>
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
              My Deadlines
            </Typography>
            <Typography variant="lead" className="text-gray-600">
              Track and manage your legal deadlines and compliance requirements.
            </Typography>
          </div>
          <Button
            color="blue"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Deadline
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              label="Search deadlines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<ClockIcon className="h-5 w-5" />}
            />
          </div>
          <div className="md:w-64">
            <Select
              label="Filter by type"
              value={filterType}
              onChange={(value) => setFilterType(value)}
            >
              <Option value="">All Types</Option>
              {deadlineTypes.map((type) => (
                <Option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                </Option>
              ))}
            </Select>
          </div>
          <Button
            variant={showUpcomingOnly ? "filled" : "outlined"}
            color="orange"
            onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
          >
            Upcoming Only
          </Button>
        </div>

        {/* Deadlines List */}
        {filteredDeadlines.length > 0 ? (
          <div className="space-y-4">
            {filteredDeadlines.map((deadline) => (
              <Card key={deadline.id} className="bg-white shadow-lg">
                <CardBody className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <ClockIcon className="h-6 w-6 text-blue-500" />
                        <Typography variant="h6" className="text-gray-800">
                          {deadline.title}
                        </Typography>
                        <Chip
                          color={getStatusColor(deadline)}
                          size="sm"
                          value={getStatusText(deadline)}
                        />
                      </div>
                      
                      {deadline.description && (
                        <Typography variant="small" className="text-gray-600 mb-3">
                          {deadline.description}
                        </Typography>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          Due: {new Date(deadline.due_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Type: {deadline.deadline_type.replace('_', ' ')}</span>
                        </div>
                        {deadline.is_recurring && (
                          <div className="flex items-center gap-1">
                            <span>Recurring: {deadline.recurrence_pattern}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="text"
                        size="sm"
                        color="green"
                        onClick={() => {
                          // Handle mark as completed
                        }}
                        disabled={deadline.is_completed}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        color="red"
                        onClick={() => handleDeleteDeadline(deadline.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardBody className="p-12 text-center">
              <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <Typography variant="h5" className="text-gray-600 mb-2">
                No deadlines found
              </Typography>
              <Typography variant="small" className="text-gray-500 mb-6">
                {searchTerm || filterType
                  ? 'Try adjusting your search or filters.'
                  : 'Add your first deadline to get started.'}
              </Typography>
              <Button
                color="blue"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="h-5 w-5" />
                Add Deadline
              </Button>
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

        {/* Create Deadline Dialog */}
        <Dialog open={showCreateDialog} handler={() => setShowCreateDialog(false)} size="lg">
          <DialogHeader>Add New Deadline</DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <Input
                label="Deadline Title"
                value={newDeadline.title}
                onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
              />
              <Textarea
                label="Description (Optional)"
                value={newDeadline.description}
                onChange={(e) => setNewDeadline({ ...newDeadline, description: e.target.value })}
                rows={3}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Due Date"
                  type="datetime-local"
                  value={newDeadline.due_date}
                  onChange={(e) => setNewDeadline({ ...newDeadline, due_date: e.target.value })}
                />
                <Select
                  label="Deadline Type"
                  value={newDeadline.deadline_type}
                  onChange={(value) => setNewDeadline({ ...newDeadline, deadline_type: value })}
                >
                  {deadlineTypes.map((type) => (
                    <Option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={newDeadline.is_recurring}
                  onChange={(e) => setNewDeadline({ ...newDeadline, is_recurring: e.target.checked })}
                />
                <label htmlFor="recurring" className="text-sm text-gray-700">
                  Recurring deadline
                </label>
              </div>
              {newDeadline.is_recurring && (
                <Select
                  label="Recurrence Pattern"
                  value={newDeadline.recurrence_pattern}
                  onChange={(value) => setNewDeadline({ ...newDeadline, recurrence_pattern: value })}
                >
                  {recurrencePatterns.map((pattern) => (
                    <Option key={pattern} value={pattern}>
                      {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                    </Option>
                  ))}
                </Select>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="text"
              color="red"
              onClick={() => setShowCreateDialog(false)}
              className="mr-1"
            >
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={handleCreateDeadline}
              disabled={!newDeadline.title || !newDeadline.due_date || !newDeadline.deadline_type}
            >
              Add Deadline
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </div>
  );
};

export default Deadlines;
