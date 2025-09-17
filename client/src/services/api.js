const API_BASE_URL = 'http://127.0.0.1:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          // Retry the request with new token
          config.headers = this.getAuthHeaders();
          const retryResponse = await fetch(url, config);
          return await retryResponse.json();
        } else {
          // Refresh failed, redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return;
        }
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Document APIs
  async getDocuments(page = 1, perPage = 10, type = null) {
    const params = new URLSearchParams({ page, per_page: perPage });
    if (type) params.append('type', type);
    return this.request(`/documents?${params}`);
  }

  async createDocument(documentData) {
    return this.request('/documents', {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  }

  async getDocument(id) {
    return this.request(`/documents/${id}`);
  }

  async updateDocument(id, documentData) {
    return this.request(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(documentData),
    });
  }

  async deleteDocument(id) {
    return this.request(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // Template APIs
  async getTemplates(type = null) {
    const params = type ? `?type=${type}` : '';
    return this.request(`/templates${params}`);
  }

  // Deadline APIs
  async getDeadlines(page = 1, perPage = 10, type = null, upcomingOnly = false) {
    const params = new URLSearchParams({ page, per_page: perPage });
    if (type) params.append('type', type);
    if (upcomingOnly) params.append('upcoming_only', 'true');
    return this.request(`/deadlines?${params}`);
  }

  async createDeadline(deadlineData) {
    return this.request('/deadlines', {
      method: 'POST',
      body: JSON.stringify(deadlineData),
    });
  }

  async updateDeadline(id, deadlineData) {
    return this.request(`/deadlines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deadlineData),
    });
  }

  async deleteDeadline(id) {
    return this.request(`/deadlines/${id}`, {
      method: 'DELETE',
    });
  }

  // Chat API
  async sendChatMessage(message) {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Compliance API
  async checkCompliance(documentType, userData) {
    return this.request('/compliance/check', {
      method: 'POST',
      body: JSON.stringify({ document_type: documentType, user_data: userData }),
    });
  }

  // Notification APIs
  async getNotifications(page = 1, perPage = 10, unreadOnly = false) {
    const params = new URLSearchParams({ page, per_page: perPage });
    if (unreadOnly) params.append('unread_only', 'true');
    return this.request(`/notifications?${params}`);
  }

  // Legacy APIs (for existing functionality)
  async getServices() {
    return this.request('/services');
  }

  async getForms(serviceId) {
    return this.request(`/forms?service_id=${serviceId}`);
  }

  async getFormDetails(formId) {
    return this.request(`/form-details?form_id=${formId}`);
  }

  async getFinalContent(formDetails) {
    return this.request('/final-content', {
      method: 'POST',
      body: JSON.stringify(formDetails),
    });
  }

  async getFinalForm(contents) {
    return this.request('/final-form', {
      method: 'POST',
      body: JSON.stringify(contents),
    });
  }
}

export default new ApiService();
