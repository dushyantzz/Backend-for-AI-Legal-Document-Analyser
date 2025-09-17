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
} from '@material-tailwind/react';
import {
  DocumentTextIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

const Documents = () => {
  const { user, isAuthenticated } = useNavigate();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    document_type: '',
    content: '',
  });

  const documentTypes = [
    'contract',
    'trademark',
    'copyright',
    'banking',
    'property',
    'bonds',
    'criminal',
    'divorce',
    'gst',
    'compliance',
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchDocuments();
  }, [isAuthenticated, navigate, currentPage, filterType]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.getDocuments(currentPage, 10, filterType || null);
      setDocuments(response.documents || []);
      setTotalPages(response.pages || 1);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    try {
      await api.createDocument(newDocument);
      setShowCreateDialog(false);
      setNewDocument({ title: '', document_type: '', content: '' });
      fetchDocuments();
    } catch (error) {
      console.error('Error creating document:', error);
    }
  };

  const handleDeleteDocument = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await api.deleteDocument(id);
        fetchDocuments();
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.document_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <Typography variant="h6">Loading documents...</Typography>
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
              My Documents
            </Typography>
            <Typography variant="lead" className="text-gray-600">
              Manage your legal documents and templates.
            </Typography>
          </div>
          <Button
            color="blue"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Create Document
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              label="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<DocumentTextIcon className="h-5 w-5" />}
            />
          </div>
          <div className="md:w-64">
            <Select
              label="Filter by type"
              value={filterType}
              onChange={(value) => setFilterType(value)}
            >
              <Option value="">All Types</Option>
              {documentTypes.map((type) => (
                <Option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* Documents Grid */}
        {filteredDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                <CardBody className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-8 w-8 text-blue-500" />
                      <div>
                        <Typography variant="h6" className="text-gray-800">
                          {doc.title}
                        </Typography>
                        <Typography variant="small" className="text-gray-600">
                          {doc.document_type}
                        </Typography>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        color="red"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Typography variant="small" className="text-gray-600">
                      Created: {new Date(doc.created_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="small" className="text-gray-600">
                      Version: {doc.version}
                    </Typography>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="blue"
                      variant="outlined"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="flex-1"
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      color="green"
                      variant="outlined"
                      onClick={() => navigate(`/documents/${doc.id}/edit`)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardBody className="p-12 text-center">
              <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <Typography variant="h5" className="text-gray-600 mb-2">
                No documents found
              </Typography>
              <Typography variant="small" className="text-gray-500 mb-6">
                {searchTerm || filterType
                  ? 'Try adjusting your search or filters.'
                  : 'Create your first document to get started.'}
              </Typography>
              <Button
                color="blue"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="h-5 w-5" />
                Create Document
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

        {/* Create Document Dialog */}
        <Dialog open={showCreateDialog} handler={() => setShowCreateDialog(false)} size="lg">
          <DialogHeader>Create New Document</DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <Input
                label="Document Title"
                value={newDocument.title}
                onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
              />
              <Select
                label="Document Type"
                value={newDocument.document_type}
                onChange={(value) => setNewDocument({ ...newDocument, document_type: value })}
              >
                {documentTypes.map((type) => (
                  <Option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Option>
                ))}
              </Select>
              <Textarea
                label="Content (Optional)"
                value={newDocument.content}
                onChange={(e) => setNewDocument({ ...newDocument, content: e.target.value })}
                rows={6}
              />
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
              onClick={handleCreateDocument}
              disabled={!newDocument.title || !newDocument.document_type}
            >
              Create Document
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    </div>
  );
};

export default Documents;
