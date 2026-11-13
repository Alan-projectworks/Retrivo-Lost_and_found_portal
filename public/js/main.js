// RETRIVO Shared Page Setup & Common Components

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Auth state across all pages
  if (typeof initAuth === 'function') {
    await initAuth();
  }

  // Set active link in navbar
  highlightCurrentNavLink();

  // Mobile menu toggle
  setupMobileNav();
});

const highlightCurrentNavLink = () => {
  const currentPath = window.location.pathname;
  const links = document.querySelectorAll('.nav-link, .mobile-nav-link');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && (currentPath === href || (href !== '/' && currentPath.includes(href)))) {
      link.classList.add('active');
    }
  });
};

const setupMobileNav = () => {
  const toggleBtn = document.getElementById('mobile-toggle-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      drawer.classList.toggle('active');
    });
  }
};
