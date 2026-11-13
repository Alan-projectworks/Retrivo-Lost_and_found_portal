// RETRIVO Authentication & Session Manager

let CURRENT_USER = null;

const initAuth = async () => {
  const res = await API.get('/api/auth/me');
  if (res.success && res.user) {
    CURRENT_USER = res.user;
  } else {
    CURRENT_USER = null;
  }
  renderHeaderAuthState();
  return CURRENT_USER;
};

const getCurrentUser = () => CURRENT_USER;

// Render Navigation Header State
const renderHeaderAuthState = () => {
  const container = document.getElementById('nav-auth-container');
  if (!container) return;

  if (CURRENT_USER) {
    const roleClass = `user-role-${CURRENT_USER.role}`;
    let roleDashboardLink = '/dashboard.html';
    if (CURRENT_USER.role === 'staff') roleDashboardLink = '/staff.html';
    if (CURRENT_USER.role === 'admin') roleDashboardLink = '/admin.html';

    container.innerHTML = `
      <a href="/notifications.html" class="notification-bell-btn" title="Notifications" id="nav-notif-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notification-count" id="nav-notif-badge" style="display: none;">0</span>
      </a>

      <div class="user-menu-trigger" onclick="toggleUserDropdown(event)">
        <div class="user-avatar">${CURRENT_USER.full_name.charAt(0).toUpperCase()}</div>
        <div class="user-info-text" style="display: flex; flex-direction: column; text-align: left;">
          <span class="user-name-tag">${CURRENT_USER.full_name.split(' ')[0]}</span>
          <span class="user-role-badge ${roleClass}">${CURRENT_USER.role}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <div class="user-dropdown-menu" id="user-dropdown-menu" style="display: none; position: absolute; top: calc(var(--header-height) - 10px); right: 24px; background: white; border: 1px solid var(--color-forest); border-radius: var(--radius-xs); box-shadow: var(--shadow-lg); min-width: 200px; z-index: 1001;">
        <div style="padding: 14px 16px; border-bottom: 1px solid rgba(20,45,38,0.1); background-color: var(--color-ivory);">
          <div style="font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; color: var(--color-forest);">${CURRENT_USER.full_name}</div>
          <div style="font-size: 0.75rem; color: var(--color-charcoal-muted);">${CURRENT_USER.reg_number} • ${CURRENT_USER.role.toUpperCase()}</div>
        </div>
        <div style="padding: 8px 0;">
          <a href="${roleDashboardLink}" style="display: block; padding: 8px 16px; font-size: 0.88rem; font-weight: 600; color: var(--color-forest); text-decoration: none;">Dashboard</a>
          <a href="/my-reports.html" style="display: block; padding: 8px 16px; font-size: 0.88rem; color: var(--color-charcoal); text-decoration: none;">My Reports</a>
          <a href="/my-claims.html" style="display: block; padding: 8px 16px; font-size: 0.88rem; color: var(--color-charcoal); text-decoration: none;">My Claims</a>
          <a href="/profile.html" style="display: block; padding: 8px 16px; font-size: 0.88rem; color: var(--color-charcoal); text-decoration: none;">Profile & Account</a>
          ${CURRENT_USER.role === 'admin' ? '<a href="/admin.html" style="display: block; padding: 8px 16px; font-size: 0.88rem; color: var(--color-orange); font-weight: 700; text-decoration: none;">Admin Panel</a>' : ''}
          ${CURRENT_USER.role === 'staff' ? '<a href="/staff.html" style="display: block; padding: 8px 16px; font-size: 0.88rem; color: #0D47A1; font-weight: 700; text-decoration: none;">Staff Desk</a>' : ''}
        </div>
        <div style="border-top: 1px solid rgba(20,45,38,0.1); padding: 8px 0;">
          <button onclick="handleLogout()" style="width: 100%; text-align: left; padding: 8px 16px; background: none; border: none; font-size: 0.88rem; font-weight: 600; color: #DC2626; cursor: pointer;">Sign Out</button>
        </div>
      </div>
    `;

    // Fetch unread notifications count
    updateNotificationBadge();
  } else {
    container.innerHTML = `
      <a href="/login.html" class="btn btn-ghost btn-sm" style="color: var(--color-ivory);">Sign In</a>
      <a href="/register.html" class="btn btn-orange btn-sm">Register</a>
    `;
  }
};

const toggleUserDropdown = (event) => {
  event.stopPropagation();
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
};

// Close dropdown on click outside
window.addEventListener('click', () => {
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) dropdown.style.display = 'none';
});

// Update notification badge
const updateNotificationBadge = async () => {
  if (!CURRENT_USER) return;
  const res = await API.get('/api/notifications/unread-count');
  if (res.success && res.count > 0) {
    const badge = document.getElementById('nav-notif-badge');
    if (badge) {
      badge.textContent = res.count > 9 ? '9+' : res.count;
      badge.style.display = 'inline-block';
    }
  }
};

// Logout Handler
const handleLogout = async () => {
  const res = await API.post('/api/auth/logout');
  if (res.success) {
    showToast('Signed out successfully.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 400);
  }
};

// Route protection guard
const guardRoute = async (allowedRoles = []) => {
  const user = await initAuth();
  if (!user) {
    showToast('Please sign in to access this page.', 'error');
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    showToast(`Access restricted to ${allowedRoles.join('/')} personnel.`, 'error');
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
};
