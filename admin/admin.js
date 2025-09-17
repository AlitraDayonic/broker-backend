// Enhanced Admin Dashboard JavaScript
// Connected to SwiftXchangepro Server

// Add this to your existing admin.js file at the very beginning
async function checkAdminAccess() {
    try {
      console.log('🍪 All cookies before request:', document.cookie);
        const response = await fetch('/api/verify-admin-access', {
            credentials: 'include'
        });
        const result = await response.json();
        
        console.log('Admin access check result:', result); // Debug log
        
        if (!result.success) {
            alert('Admin access required. Redirecting to login...');
            window.location.href = '/admin-login.html';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Admin verification failed:', error);
        window.location.href = '/admin-login.html';
        return false;
    }
}

class AdminDashboard {
  constructor() {
    this.currentSection = 'dashboard';
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.searchQuery = '';
    this.filters = {};
    this.selectedItems = new Set();
    this.notifications = [];
    
    this.init();
  }

  // Initialize the dashboard
  async init() {
    await this.showLoading(true);
    this.setupEventListeners();
    this.setupNavigation();
    this.setupModals();
    this.setupNotifications();
    await this.loadDashboard();
    await this.showLoading(false);
  }

  // API Helper Functions - FIXED
  async apiCall(endpoint, method = 'GET', data = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Important for session cookies
      }; // FIXED: Removed stray 'a' character
      
      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }
      
      const baseURL = '';
      const fullURL = endpoint.startsWith('http') ? endpoint : baseURL + endpoint;
      const response = await fetch(fullURL, options);
      const result = await response.json();
      
      if (!result.success && result.message) {
        this.showToast('error', 'Error', result.message);
      }
      
      return result;
    } catch (error) {
      console.error('API call error:', error);
      this.showToast('error', 'Network Error', 'Failed to connect to server');
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Loading Screen
  async showLoading(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (show) {
      loadingScreen.classList.remove('hidden');
    } else {
      loadingScreen.classList.add('hidden');
    }
  }

  // Navigation Setup
  setupNavigation() {
    // Sidebar navigation
    const navItems = document.querySelectorAll('.admin-nav-item[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.switchSection(section);
      });
    });

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('adminSidebar');
    
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }
  }

  // Switch between sections
  async switchSection(section) {
    // Update navigation
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.classList.remove('admin-active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('admin-active');

    // Update content
    document.querySelectorAll('.admin-section').forEach(sec => {
      sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');

    // Update page title
    const pageTitle = document.getElementById('adminPageTitle');
    pageTitle.textContent = this.getSectionTitle(section);

    // Load section data
    this.currentSection = section;
    await this.loadSectionData(section);
  }

  getSectionTitle(section) {
    const titles = {
      dashboard: 'Platform Admin Overview',
      users: 'User Management',
      trades: 'Trade Management',
      deposits: 'Deposit Management',
      withdrawals: 'Withdrawal Management',
      portfolio: 'Portfolio Viewer',
      analytics: 'Platform Analytics',
      settings: 'System Settings'
    };
    return titles[section] || 'Admin Panel';
  }

  // Load section-specific data
  async loadSectionData(section) {
    switch (section) {
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'users':
        await this.loadUsers();
        break;
      case 'trades':
        await this.loadTrades();
        break;
      case 'deposits':
        await this.loadDeposits();
        break;
      case 'withdrawals':
        await this.loadWithdrawals();
        break;
      case 'portfolio':
        await this.loadPortfolioViewer();
        break;
    }
  }

  // Dashboard Data Loading
  async loadDashboard() {
    try {
      // Load summary stats
      await this.loadSummaryStats();
      
      // Load recent activity
      await this.loadRecentActivity();
      
      // Update navigation badges
      await this.updateNavigationBadges();
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showToast('error', 'Error', 'Failed to load dashboard data');
    }
  }

 async loadSummaryStats() {
    try {
        const result = await this.apiCall('/api/admin/dashboard-stats');
        
        if (result.success) {
            const stats = result.stats;
            
            // Update dashboard cards with real data
            document.getElementById('admin-total-users').textContent = stats.totalUsers;
            document.getElementById('admin-total-balance').textContent = `$${stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            document.getElementById('admin-total-trades').textContent = stats.totalTrades;
            document.getElementById('admin-pending-actions').textContent = stats.pendingActions;
        }
    } catch (error) {
        console.error('Error loading summary stats:', error);
        this.showToast('error', 'Error', 'Failed to load dashboard statistics');
    }
}

    
  async loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    
    // Sample activity data - replace with real API data
    const activities = [
      {
        type: 'user',
        icon: 'fas fa-user-plus',
        title: 'New User Registration',
        description: 'John Doe registered a new account',
        time: '2 minutes ago'
      },
      {
        type: 'trade',
        icon: 'fas fa-chart-line',
        title: 'Large Trade Executed',
        description: 'BTC trade worth $50,000 completed',
        time: '5 minutes ago'
      },
      {
        type: 'deposit',
        icon: 'fas fa-arrow-down',
        title: 'Deposit Approved',
        description: '$10,000 deposit approved for Alice Smith',
        time: '10 minutes ago'
      }
    ];

    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon ${activity.type}">
          <i class="${activity.icon}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `).join('');
  }

  async updateNavigationBadges() {
    // Update navigation badges with counts
    const emails = this.getAllUserEmails();
    document.getElementById('usersBadge').textContent = emails.length;
    
    // These would come from your server API
    document.getElementById('tradesBadge').textContent = '0';
    document.getElementById('depositsBadge').textContent = '0';
    document.getElementById('withdrawalsBadge').textContent = '0';
  }

    
// Replace the loadUsers function in admin-dashboard.js
async loadUsers() {
    const usersTbody = document.getElementById('admin-users-tbody');
    const usersTotal = document.getElementById('usersTotal');
    const usersShowing = document.getElementById('usersShowing');

    if (!usersTbody) return;

    try {
        console.log('Fetching users from backend...');
        
        // Fetch users from your backend API (not localStorage!)
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();
        console.log('Backend response:', data);

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch users');
        }

        const users = data.users || [];
        
        // Update totals
        if (usersTotal) usersTotal.textContent = users.length;
        if (usersShowing) usersShowing.textContent = users.length;

        // Clear table
        usersTbody.innerHTML = '';

        // Populate table with real backend data
        users.forEach((user, index) => {
            // Safely convert balance to number and format
            const balance = parseFloat(user.balance || 0);
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><input type="checkbox" data-user="${user.email}" class="user-checkbox"></td>
                <td>#${user.id}</td>
                <td>
                    <div class="user-info">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name + ' ' + user.last_name)}&background=00c9a7&color=fff" alt="${user.email}" class="user-avatar">
                        <div>
                            <div class="user-name">${user.first_name || ''} ${user.last_name || ''}</div>
                            <div class="user-email">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td><span class="status-badge ${user.status || 'active'}">${user.status || 'Active'}</span></td>
                <td class="data-value currency">$${balance.toFixed(2)}</td>
                <td class="data-value currency">$0.00</td>
                <td>${user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</td>
                <td>
                    <div class="action-buttons-group">
                        <button class="action-btn-sm view" onclick="adminDashboard.viewUser('${user.email}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn-sm edit" onclick="adminDashboard.editUser('${user.email}')" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn-sm approve" onclick="adminDashboard.creditUser('${user.email}')" title="Credit">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="action-btn-sm reject" onclick="adminDashboard.debitUser('${user.email}')" title="Debit">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button class="action-btn-sm delete" onclick="adminDashboard.deleteUser('${user.email}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            usersTbody.appendChild(row);
        });

        console.log(`Loaded ${users.length} users successfully`);

    } catch (error) {
        console.error('Error loading users:', error);
        
        // Show error in the table
        usersTbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <br>
                    Error loading users: ${error.message}
                    <br>
                    <small>Check console for details</small>
                </td>
            </tr>
        `;
    }
}    
    // Update the filterUsers function to work with user objects
// filterUsers(users) {
//     let filtered = [...users];
    
    // Apply search filter
    // if (this.searchQuery) {
    //     filtered = filtered.filter(user => 
    //         user.email.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
    //         (user.first_name && user.first_name.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
    //         (user.last_name && user.last_name.toLowerCase().includes(this.searchQuery.toLowerCase()))
    //     );
    // }

    // Apply status filter
//     const statusFilter = document.getElementById('userStatusFilter')?.value;
//     if (statusFilter && statusFilter !== 'all') {
//         filtered = filtered.filter(user => user.status === statusFilter);
//     }

//     return filtered;
// }

//   paginateData(data) {
//     const startIndex = (this.currentPage - 1) * this.itemsPerPage;
//     const endIndex = startIndex + this.itemsPerPage;
//     return data.slice(startIndex, endIndex);
//   }

  updatePagination(type, totalItems) {
    const paginationContainer = document.getElementById(`${type}Pagination`);
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    let paginationHTML = '';

    // Previous button
    if (this.currentPage > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="adminDashboard.changePage(${this.currentPage - 1})">‹</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const active = i === this.currentPage ? 'active' : '';
      paginationHTML += `<button class="pagination-btn ${active}" onclick="adminDashboard.changePage(${i})">${i}</button>`;
    }

    // Next button
    if (this.currentPage < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="adminDashboard.changePage(${this.currentPage + 1})">›</button>`;
    }

    paginationContainer.innerHTML = paginationHTML;
  }

  changePage(page) {
    this.currentPage = page;
    this.loadSectionData(this.currentSection);
  }

  // User Actions
  async viewUser(email) {
    const balance = parseFloat(localStorage.getItem(`balance_${email}`)) || 0;
    const portfolio = JSON.parse(localStorage.getItem("portfolio")) || [];
    const userPortfolio = portfolio.filter(p => p.owner === email);
    
    let portfolioValue = 0;
    userPortfolio.forEach(asset => {
      portfolioValue += (asset.quantity || 0) * (asset.price || 0);
    });

    const modalBody = document.getElementById('userModalBody');
    modalBody.innerHTML = `
      <div class="user-details">
        <div class="user-avatar-large">
          <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=00c9a7&color=fff&size=80" alt="${email}">
        </div>
        <h4>${email}</h4>
        
        <div class="detail-grid">
          <div class="detail-item">
            <label>Account Balance</label>
            <span class="data-value currency">${balance.toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <label>Portfolio Value</label>
            <span class="data-value currency">${portfolioValue.toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <label>Total Assets</label>
            <span>${userPortfolio.length}</span>
          </div>
          <div class="detail-item">
            <label>Account Status</label>
            <span class="status-badge active">Active</span>
          </div>
        </div>

        <div class="portfolio-summary">
          <h5>Portfolio Assets</h5>
          <div class="assets-list">
            ${userPortfolio.map(asset => `
              <div class="asset-item">
                <span class="asset-name">${asset.name || asset.symbol}</span>
                <span class="asset-quantity">${(asset.quantity || 0).toFixed(4)}</span>
                <span class="asset-value">$${((asset.quantity || 0) * (asset.price || 0)).toFixed(2)}</span>
              </div>
            `).join('') || '<p>No assets found</p>'}
          </div>
        </div>
      </div>
    `;

    this.showModal('userModal');
  }

  async editUser(email) {
    const balance = parseFloat(localStorage.getItem(`balance_${email}`)) || 0;
    
    const modalBody = document.getElementById('userModalBody');
    modalBody.innerHTML = `
      <div class="edit-user-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="editEmail" value="${email}" readonly>
        </div>
        <div class="form-group">
          <label>Account Balance</label>
          <input type="number" id="editBalance" value="${balance}" step="0.01">
        </div>
        <div class="form-group">
          <label>Account Status</label>
          <select id="editStatus">
            <option value="active" selected>Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>
    `;

    this.showModal('userModal');
  }

 // Add credit/debit functions
async creditUser(userId) {
    const amount = prompt('Enter amount to credit:');
    if (!amount || isNaN(amount)) return;
    
    try {
        const result = await this.apiCall('/api/admin/update-balance', 'POST', {
            userId: userId,
            amount: parseFloat(amount),
            action: 'credit'
        });
        
        if (result.success) {
            this.showToast('success', 'Success', result.message);
            this.loadUsers(); // Reload users to show updated balance
        }
    } catch (error) {
        console.error('Error crediting user:', error);
    }
}

async debitUser(userId) {
    const amount = prompt('Enter amount to debit:');
    if (!amount || isNaN(amount)) return;
    
    try {
        const result = await this.apiCall('/api/admin/update-balance', 'POST', {
            userId: userId,
            amount: parseFloat(amount),
            action: 'debit'
        });
        
        if (result.success) {
            this.showToast('success', 'Success', result.message);
            this.loadUsers(); // Reload users to show updated balance
        }
    } catch (error) {
        console.error('Error debiting user:', error);
    }
}
  async deleteUser(email) {
    if (!confirm(`Delete all data for ${email}?`)) return;
    
    localStorage.removeItem(`balance_${email}`);
    this.showToast('success', 'Success', `Deleted user ${email}`);
    await this.loadSectionData(this.currentSection);
  }

  // Trades Management
  async loadTrades() {
    const tradesTbody = document.getElementById('admin-trades-tbody');
    if (!tradesTbody) return;

    // Sample trade data - replace with API call to your server
    const sampleTrades = [
      {
        id: 'TRD001',
        user: 'john@example.com',
        asset: 'BTC',
        type: 'buy',
        quantity: 0.5,
        price: 45000,
        total: 22500,
        date: new Date().toISOString(),
        status: 'completed'
      }
    ];

    tradesTbody.innerHTML = sampleTrades.map(trade => `
      <tr>
        <td>${trade.id}</td>
        <td>
          <div class="user-info">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(trade.user)}&background=00c9a7&color=fff" alt="${trade.user}" class="user-avatar">
            <div>
              <div class="user-name">${trade.user.split('@')[0]}</div>
              <div class="user-email">${trade.user}</div>
            </div>
          </div>
        </td>
        <td>${trade.asset}</td>
        <td>
          <span class="trade-type ${trade.type}">
            <i class="fas fa-arrow-${trade.type === 'buy' ? 'up' : 'down'}"></i>
            ${trade.type.toUpperCase()}
          </span>
        </td>
        <td>${trade.quantity}</td>
        <td class="data-value currency">${trade.price.toFixed(2)}</td>
        <td class="data-value currency">${trade.total.toFixed(2)}</td>
        <td>${new Date(trade.date).toLocaleDateString()}</td>
        <td><span class="status-badge ${trade.status}">${trade.status}</span></td>
        <td>
          <div class="action-buttons-group">
            <button class="action-btn-sm view" onclick="adminDashboard.viewTrade('${trade.id}')" title="View Details">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="10" class="empty-state">No trades found</td></tr>';
  }

  // Deposits Management
  async loadDeposits() {
    const depositsTbody = document.getElementById('admin-deposits-tbody');
    if (!depositsTbody) return;

    // Sample deposit data - replace with API call
    const sampleDeposits = [];

    depositsTbody.innerHTML = sampleDeposits.map(deposit => `
      <tr>
        <td><input type="checkbox" data-deposit="${deposit.id}" class="deposit-checkbox"></td>
        <td>${deposit.reference}</td>
        <td>${deposit.user}</td>
        <td class="data-value currency">${deposit.amount.toFixed(2)}</td>
        <td>${deposit.method}</td>
        <td><span class="status-badge ${deposit.status}">${deposit.status}</span></td>
        <td>${new Date(deposit.date).toLocaleDateString()}</td>
        <td>
          <div class="action-buttons-group">
            <button class="action-btn-sm approve" onclick="adminDashboard.approveDeposit('${deposit.id}')" title="Approve">
              <i class="fas fa-check"></i>
            </button>
            <button class="action-btn-sm reject" onclick="adminDashboard.rejectDeposit('${deposit.id}')" title="Reject">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No deposits found</td></tr>';
  }

  // Withdrawals Management
  async loadWithdrawals() {
    const withdrawalsTbody = document.getElementById('admin-withdrawals-tbody');
    if (!withdrawalsTbody) return;

    // Sample withdrawal data - replace with API call
    const sampleWithdrawals = [];

    withdrawalsTbody.innerHTML = sampleWithdrawals.map(withdrawal => `
      <tr>
        <td><input type="checkbox" data-withdrawal="${withdrawal.id}" class="withdrawal-checkbox"></td>
        <td>${withdrawal.reference}</td>
        <td>${withdrawal.user}</td>
        <td class="data-value currency">${withdrawal.amount.toFixed(2)}</td>
        <td>${withdrawal.method}</td>
        <td><span class="status-badge ${withdrawal.status}">${withdrawal.status}</span></td>
        <td>${new Date(withdrawal.date).toLocaleDateString()}</td>
        <td>
          <div class="action-buttons-group">
            <button class="action-btn-sm approve" onclick="adminDashboard.approveWithdrawal('${withdrawal.id}')" title="Approve">
              <i class="fas fa-check"></i>
            </button>
            <button class="action-btn-sm reject" onclick="adminDashboard.rejectWithdrawal('${withdrawal.id}')" title="Reject">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No withdrawals found</td></tr>';
  }

  // Portfolio Viewer
  async loadPortfolioViewer() {
    const userSelect = document.getElementById('admin-user-select');
    const portfolioContainer = document.getElementById('userPortfolioContainer');
    const portfolioSummary = document.getElementById('portfolioSummary');

    if (!userSelect) return;

    // Populate user dropdown
    const emails = this.getAllUserEmails();
    userSelect.innerHTML = '<option value="">Choose a user...</option>';
    
    emails.forEach(email => {
      const option = document.createElement('option');
      option.value = email;
      option.textContent = email;
      userSelect.appendChild(option);
    });

    // Handle user selection
    userSelect.addEventListener('change', () => {
      if (userSelect.value) {
        this.loadUserPortfolio(userSelect.value);
        portfolioContainer.style.display = 'block';
        portfolioSummary.style.display = 'flex';
      } else {
        portfolioContainer.style.display = 'none';
        portfolioSummary.style.display = 'none';
      }
    });
  }

  async loadUserPortfolio(email) {
    const portfolioTbody = document.getElementById('admin-portfolio-tbody');
    const totalValueEl = document.getElementById('admin-portfolio-total');
    const userBalanceEl = document.getElementById('admin-user-balance');
    const totalAssetsEl = document.getElementById('admin-total-assets');

    const portfolio = JSON.parse(localStorage.getItem('portfolio')) || [];
    const userHoldings = portfolio.filter(p => p.owner === email);
    const balance = parseFloat(localStorage.getItem(`balance_${email}`)) || 0;

    portfolioTbody.innerHTML = '';
    let totalValue = 0;

    if (userHoldings.length === 0) {
      portfolioTbody.innerHTML = '<tr><td colspan="8" class="empty-state">No portfolio assets found</td></tr>';
    } else {
      userHoldings.forEach(asset => {
        const purchasePrice = asset.purchasePrice || asset.price || 0;
        const currentPrice = asset.price || 0;
        const quantity = asset.quantity || 0;
        const value = quantity * currentPrice;
        const pnl = (currentPrice - purchasePrice) * quantity;
        const pnlPercent = purchasePrice > 0 ? ((currentPrice - purchasePrice) / purchasePrice * 100) : 0;
        
        totalValue += value;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${asset.name || asset.symbol}</td>
          <td>${asset.type || 'Cryptocurrency'}</td>
          <td>${quantity.toFixed(4)}</td>
          <td class="data-value currency">${purchasePrice.toFixed(2)}</td>
          <td class="data-value currency">${currentPrice.toFixed(2)}</td>
          <td class="data-value currency">${value.toFixed(2)}</td>
          <td>
            <span class="performance-indicator ${pnl >= 0 ? 'positive' : 'negative'}">
              <i class="fas fa-arrow-${pnl >= 0 ? 'up' : 'down'}"></i>
              $${Math.abs(pnl).toFixed(2)}
            </span>
          </td>
          <td>
            <span class="performance-indicator ${pnlPercent >= 0 ? 'positive' : 'negative'}">
              <i class="fas fa-arrow-${pnlPercent >= 0 ? 'up' : 'down'}"></i>
              ${Math.abs(pnlPercent).toFixed(2)}%
            </span>
          </td>
        `;
        portfolioTbody.appendChild(row);
      });
    }

    // Update summary
    totalValueEl.textContent = `$${totalValue.toFixed(2)}`;
    userBalanceEl.textContent = `$${balance.toFixed(2)}`;
    totalAssetsEl.textContent = userHoldings.length.toString();
  }

  // Helper Functions
  // getAllUserEmails() {
    // return Object.keys(localStorage)
      // .filter(key => key.startsWith("balance_"))
      // .map(key => key.replace("balance_", ""));
  }

  // Event Listeners Setup
  setupEventListeners() {
    // Global search
    const globalSearch = document.getElementById('adminGlobalSearch');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.currentPage = 1; // Reset to first page
        this.loadSectionData(this.currentSection);
      });
    }

    // Filter listeners for each section
    this.setupUserFilters();
    this.setupTradeFilters();
    this.setupDepositFilters();
    this.setupWithdrawalFilters();

    // Quick actions
    this.setupQuickActions();

    // Refresh button
    const refreshBtn = document.getElementById('refreshActivity');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadRecentActivity();
      });
    }

    // Admin logout
    const logoutBtn = document.getElementById('adminLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }
  }

  setupUserFilters() {
    const statusFilter = document.getElementById('userStatusFilter');
    const typeFilter = document.getElementById('accountTypeFilter');
    const searchInput = document.getElementById('userSearchInput');

    [statusFilter, typeFilter, searchInput].forEach(element => {
      if (element) {
        element.addEventListener('change', () => {
          this.currentPage = 1;
          this.loadUsers();
        });
        
        if (element === searchInput) {
          element.addEventListener('input', () => {
            this.currentPage = 1;
            this.loadUsers();
          });
        }
      }
    });
  }

  setupTradeFilters() {
    const assetFilter = document.getElementById('tradeAssetFilter');
    const typeFilter = document.getElementById('tradeTypeFilter');
    const dateFrom = document.getElementById('tradeDateFrom');
    const dateTo = document.getElementById('tradeDateTo');

    [assetFilter, typeFilter, dateFrom, dateTo].forEach(element => {
      if (element) {
        element.addEventListener('change', () => {
          this.currentPage = 1;
          this.loadTrades();
        });
      }
    });
  }

  setupDepositFilters() {
    const statusFilter = document.getElementById('depositStatusFilter');
    const methodFilter = document.getElementById('depositMethodFilter');

    [statusFilter, methodFilter].forEach(element => {
      if (element) {
        element.addEventListener('change', () => {
          this.currentPage = 1;
          this.loadDeposits();
        });
      }
    });
  }

  setupWithdrawalFilters() {
    const statusFilter = document.getElementById('withdrawalStatusFilter');

    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadWithdrawals();
      });
    }
  }

  setupQuickActions() {
    // Quick approve deposits
    const quickApproveDeposits = document.getElementById('quickApproveDeposits');
    if (quickApproveDeposits) {
      quickApproveDeposits.addEventListener('click', () => {
        this.switchSection('deposits');
      });
    }

    // Quick review withdrawals
    const quickReviewWithdrawals = document.getElementById('quickReviewWithdrawals');
    if (quickReviewWithdrawals) {
      quickReviewWithdrawals.addEventListener('click', () => {
        this.switchSection('withdrawals');
      });
    }

    // Quick export data
    const quickExportData = document.getElementById('quickExportData');
    if (quickExportData) {
      quickExportData.addEventListener('click', () => {
        this.exportAllData();
      });
    }

    // Export buttons
    const exportButtons = ['exportUsersBtn', 'exportTradesBtn', 'exportPortfolioBtn'];
    exportButtons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          const type = btnId.replace('export', '').replace('Btn', '').toLowerCase();
          this.exportData(type);
        });
      }
    });

    // Bulk action buttons
    this.setupBulkActions();
  }

  setupBulkActions() {
    // Select all checkboxes
    const selectAllUsers = document.getElementById('selectAllUsers');
    const selectAllDeposits = document.getElementById('selectAllDeposits');
    const selectAllWithdrawals = document.getElementById('selectAllWithdrawals');

    if (selectAllUsers) {
      selectAllUsers.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        this.updateBulkActionBar('users');
      });
    }

    if (selectAllDeposits) {
      selectAllDeposits.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.deposit-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        this.updateBulkActionBar('deposits');
      });
    }

    if (selectAllWithdrawals) {
      selectAllWithdrawals.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.withdrawal-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        this.updateBulkActionBar('withdrawals');
      });
    }

    // Bulk approve/reject buttons
    const approveSelectedDeposits = document.getElementById('approveSelectedDeposits');
    const rejectSelectedDeposits = document.getElementById('rejectSelectedDeposits');
    const approveSelectedWithdrawals = document.getElementById('approveSelectedWithdrawals');
    const rejectSelectedWithdrawals = document.getElementById('rejectSelectedWithdrawals');

    if (approveSelectedDeposits) {
      approveSelectedDeposits.addEventListener('click', () => this.bulkApproveDeposits());
    }
    if (rejectSelectedDeposits) {
      rejectSelectedDeposits.addEventListener('click', () => this.bulkRejectDeposits());
    }
    if (approveSelectedWithdrawals) {
      approveSelectedWithdrawals.addEventListener('click', () => this.bulkApproveWithdrawals());
    }
    if (rejectSelectedWithdrawals) {
      rejectSelectedWithdrawals.addEventListener('click', () => this.bulkRejectWithdrawals());
    }
  }

  updateBulkActionBar(type) {
    const bulkBar = document.querySelector('.bulk-action-bar');
    const checkboxes = document.querySelectorAll(`.${type.slice(0, -1)}-checkbox:checked`);
    
    if (checkboxes.length > 0) {
      if (bulkBar) {
        bulkBar.classList.add('show');
        const bulkInfo = bulkBar.querySelector('.bulk-info');
        if (bulkInfo) {
          bulkInfo.innerHTML = `<strong>${checkboxes.length}</strong> ${type} selected`;
        }
      }
    } else {
      if (bulkBar) bulkBar.classList.remove('show');
    }
  }

  // Bulk Actions
  async bulkApproveDeposits() {
    const selected = document.querySelectorAll('.deposit-checkbox:checked');
    if (selected.length === 0) {
      this.showToast('warning', 'No Selection', 'Please select deposits to approve');
      return;
    }

    if (!confirm(`Approve ${selected.length} selected deposits?`)) return;

    // Implement bulk approval logic here
    this.showToast('success', 'Success', `${selected.length} deposits approved`);
    this.loadDeposits();
  }

  async bulkRejectDeposits() {
    const selected = document.querySelectorAll('.deposit-checkbox:checked');
    if (selected.length === 0) {
      this.showToast('warning', 'No Selection', 'Please select deposits to reject');
      return;
    }

    if (!confirm(`Reject ${selected.length} selected deposits?`)) return;

    // Implement bulk rejection logic here
    this.showToast('success', 'Success', `${selected.length} deposits rejected`);
    this.loadDeposits();
  }

  async bulkApproveWithdrawals() {
    const selected = document.querySelectorAll('.withdrawal-checkbox:checked');
    if (selected.length === 0) {
      this.showToast('warning', 'No Selection', 'Please select withdrawals to approve');
      return;
    }

    if (!confirm(`Approve ${selected.length} selected withdrawals?`)) return;

    // Implement bulk approval logic here
    this.showToast('success', 'Success', `${selected.length} withdrawals approved`);
    this.loadWithdrawals();
  }

  async bulkRejectWithdrawals() {
    const selected = document.querySelectorAll('.withdrawal-checkbox:checked');
    if (selected.length === 0) {
      this.showToast('warning', 'No Selection', 'Please select withdrawals to reject');
      return;
    }

    if (!confirm(`Reject ${selected.length} selected withdrawals?`)) return;

    // Implement bulk rejection logic here
    this.showToast('success', 'Success', `${selected.length} withdrawals rejected`);
    this.loadWithdrawals();
  }

  // Individual Actions
  async approveDeposit(depositId) {
    if (!confirm('Approve this deposit?')) return;
    
    // Call your server API
    const result = await this.apiCall(`/api/admin/deposits/${depositId}/approve`, 'POST');
    if (result.success) {
      this.showToast('success', 'Success', 'Deposit approved');
      this.loadDeposits();
    }
  }

  async rejectDeposit(depositId) {
    if (!confirm('Reject this deposit?')) return;
    
    // Call your server API
    const result = await this.apiCall(`/api/admin/deposits/${depositId}/reject`, 'POST');
    if (result.success) {
      this.showToast('success', 'Success', 'Deposit rejected');
      this.loadDeposits();
    }
  }

  async approveWithdrawal(withdrawalId) {
    if (!confirm('Approve this withdrawal?')) return;
    
    // Call your server API
    const result = await this.apiCall(`/api/admin/withdrawals/${withdrawalId}/approve`, 'POST');
    if (result.success) {
      this.showToast('success', 'Success', 'Withdrawal approved');
      this.loadWithdrawals();
    }
  }

  async rejectWithdrawal(withdrawalId) {
    if (!confirm('Reject this withdrawal?')) return;
    
    // Call your server API
    const result = await this.apiCall(`/api/admin/withdrawals/${withdrawalId}/reject`, 'POST');
    if (result.success) {
      this.showToast('success', 'Success', 'Withdrawal rejected');
      this.loadWithdrawals();
    }
  }

  async viewTrade(tradeId) {
    // Implement trade details view
    this.showToast('info', 'Info', `Viewing trade ${tradeId}`);
  }

  // Modal Management
  setupModals() {
    // Close modal buttons
    const closeButtons = document.querySelectorAll('.modal-close, #closeUserModal, #closeConfirmModal');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideModal(btn.closest('.modal-overlay')?.id);
      });
    });

    // Click outside to close
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal(modal.id);
        }
      });
    });

    // Save user changes
    const saveUserChanges = document.getElementById('saveUserChanges');
    if (saveUserChanges) {
      saveUserChanges.addEventListener('click', () => {
        this.saveUserChanges();
      });
    }

    // Cancel buttons
    const cancelButtons = document.querySelectorAll('#cancelUserEdit, #cancelConfirm');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideModal(btn.closest('.modal-overlay')?.id);
      });
    });
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async saveUserChanges() {
    const email = document.getElementById('editEmail')?.value;
    const balance = document.getElementById('editBalance')?.value;
    const status = document.getElementById('editStatus')?.value;

    if (!email || balance === null) {
      this.showToast('error', 'Error', 'Please fill all required fields');
      return;
    }

    // Save to localStorage for now - replace with server API call
    localStorage.setItem(`balance_${email}`, parseFloat(balance).toFixed(2));
    
    this.showToast('success', 'Success', 'User updated successfully');
    this.hideModal('userModal');
    this.loadSectionData(this.currentSection);
  }

  // Notification System
  setupNotifications() {
    // Sample notifications
    this.notifications = [
      {
        id: 1,
        type: 'deposit',
        title: 'New Deposit Request',
        message: 'John Doe submitted a $5,000 deposit',
        time: '2 minutes ago',
        read: false
      },
      {
        id: 2,
        type: 'withdrawal',
        title: 'Withdrawal Pending',
        message: 'Alice Smith requested $2,500 withdrawal',
        time: '5 minutes ago',
        read: false
      },
      {
        id: 3,
        type: 'user',
        title: 'New User Registration',
        message: 'Bob Johnson created an account',
        time: '10 minutes ago',
        read: true
      }
    ];

    this.updateNotificationBadge();
    this.renderNotifications();

    // Mark all as read
    const markAllRead = document.getElementById('markAllRead');
    if (markAllRead) {
      markAllRead.addEventListener('click', () => {
        this.markAllNotificationsRead();
      });
    }
  }

  updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = this.notifications.filter(n => !n.read).length;
    
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
  }

  renderNotifications() {
    const notificationList = document.getElementById('notificationList');
    if (!notificationList) return;

    notificationList.innerHTML = this.notifications.map(notification => `
      <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
        <div class="notification-icon ${notification.type}">
          <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${notification.time}</div>
        </div>
        ${!notification.read ? '<div class="notification-dot"></div>' : ''}
      </div>
    `).join('');
  }

  getNotificationIcon(type) {
    const icons = {
      deposit: 'arrow-down',
      withdrawal: 'arrow-up',
      user: 'user-plus',
      trade: 'chart-line',
      system: 'cog'
    };
    return icons[type] || 'bell';
  }

  markAllNotificationsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.updateNotificationBadge();
    this.renderNotifications();
    this.showToast('success', 'Success', 'All notifications marked as read');
  }

  // Toast Notification System
  showToast(type, title, message, duration = 5000) {
    const toastContainer = this.getOrCreateToastContainer();
    
    const toastId = 'toast_' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = toastId;
    
    toast.innerHTML = `
      <div class="toast-icon">
        <i class="fas fa-${this.getToastIcon(type)}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="adminDashboard.closeToast('${toastId}')">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove
    setTimeout(() => this.closeToast(toastId), duration);
  }

  getOrCreateToastContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  getToastIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-triangle',
      warning: 'exclamation-circle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }

  // Data Export Functions
  async exportData(type) {
    let data = [];
    let filename = '';

    switch (type) {
      case 'users':
        data = this.getAllUserEmails().map(email => ({
          email,
          balance: parseFloat(localStorage.getItem(`balance_${email}`)) || 0,
          status: 'Active',
          joinDate: new Date().toISOString()
        }));
        filename = 'users_export';
        break;
      
      case 'trades':
        data = []; // Replace with actual trade data from server
        filename = 'trades_export';
        break;
      
      case 'portfolio':
        const selectedUser = document.getElementById('admin-user-select')?.value;
        if (!selectedUser) {
          this.showToast('warning', 'No User Selected', 'Please select a user first');
          return;
        }
        
        const portfolio = JSON.parse(localStorage.getItem('portfolio')) || [];
        data = portfolio.filter(p => p.owner === selectedUser);
        filename = `portfolio_${selectedUser.replace('@', '_')}`;
        break;
    }

    this.downloadCSV(data, filename);
    this.showToast('success', 'Export Complete', `${type} data exported successfully`);
  }

  async exportAllData() {
    const allData = {
      users: this.getAllUserEmails().map(email => ({
        email,
        balance: parseFloat(localStorage.getItem(`balance_${email}`)) || 0
      })),
      portfolio: JSON.parse(localStorage.getItem('portfolio')) || [],
      exportDate: new Date().toISOString()
    };

    this.downloadJSON(allData, 'platform_export');
    this.showToast('success', 'Export Complete', 'All platform data exported');
  }
 
  downloadCSV(data, filename) {
    if (data.length === 0) {
      this.showToast('warning', 'No Data', 'No data available to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    this.downloadFile(csvContent, `${filename}_${this.getDateString()}.csv`, 'text/csv');
  }

  downloadJSON(data, filename) {
    const jsonContent = JSON.stringify(data, null, 2);
    this.downloadFile(jsonContent, `${filename}_${this.getDateString()}.json`, 'application/json');
  }

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  // Logout Handler
  async handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    try {
      // Call server logout endpoint
      await this.apiCall('/api/logout', 'POST');
      
      // Redirect to login page
      window.location.href = '/login_signup.html';
    } catch (error) {
      this.showToast('error', 'Logout Failed', 'Please try again');
    }
  }

  // Utility Functions
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(date) {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize the admin dashboard when DOM is loaded
let adminDashboard;

document.addEventListener('DOMContentLoaded', async () => {
    const hasAccess = await checkAdminAccess();
    if (hasAccess) {
        initializeAdminPanel();
    }
});


function initializeAdminPanel() {
    // Initialize the AdminDashboard class
    adminDashboard = new AdminDashboard();
}

// Global functions for onclick handlers (needed for compatibility)
window.adminDashboard = {
  viewUser: (email) => adminDashboard.viewUser(email),
  editUser: (email) => adminDashboard.editUser(email),
  creditUser: (email) => adminDashboard.creditUser(email),
  debitUser: (email) => adminDashboard.debitUser(email),
  deleteUser: (email) => adminDashboard.deleteUser(email),
  viewTrade: (id) => adminDassshboard.viewTrade(id),
  approveDeposit: (id) => adminDashboard.approveDeposit(id),
  rejectDeposit: (id) => adminDashboard.rejectDeposit(id),
  approveWithdrawal: (id) => adminDashboard.approveWithdrawal(id),
  rejectWithdrawal: (id) => adminDashboard.rejectWithdrawal(id),
  changePage: (page) => adminDashboard.changePage(page),
  closeToast: (id) => adminDashboard.closeToast(id)
};
