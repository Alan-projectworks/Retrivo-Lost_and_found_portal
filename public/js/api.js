// RETRIVO Unified API Client & UI Helpers

const API = {
  async get(url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`GET ${url} failed:`, err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  async post(url, body, isFormData = false) {
    try {
      const options = {
        method: 'POST'
      };
      if (isFormData) {
        options.body = body;
      } else {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }
      const res = await fetch(url, options);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`POST ${url} failed:`, err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  async put(url, body) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`PUT ${url} failed:`, err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  async delete(url) {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`DELETE ${url} failed:`, err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }
};

// UI Helper: Toast Notifications
const showToast = (message, type = 'info') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '✕';

  toast.innerHTML = `<span><strong>${icon}</strong></span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Format Date Helper
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Format Relative Time
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateStr);
};

// Status label and color helper
const getStatusBadge = (status) => {
  const map = {
    active: { label: 'Active', class: 'badge-active' },
    matched: { label: 'Matched', class: 'badge-active' },
    under_review: { label: 'Under Review', class: 'badge-under_review' },
    ready_for_collection: { label: 'Ready for Collection', class: 'badge-ready_for_collection' },
    returned: { label: 'Returned', class: 'badge-returned' },
    cancelled: { label: 'Cancelled', class: 'badge-cancelled' },
    pending: { label: 'Pending Review', class: 'badge-under_review' },
    approved: { label: 'Approved', class: 'badge-ready_for_collection' },
    rejected: { label: 'Rejected', class: 'badge-cancelled' },
    handed_over: { label: 'Handover Complete', class: 'badge-returned' }
  };

  const item = map[status] || { label: status, class: 'badge-active' };
  return `<span class="badge ${item.class}">${item.label}</span>`;
};
