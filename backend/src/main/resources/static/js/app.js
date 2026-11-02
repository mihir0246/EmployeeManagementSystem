/**
 * Employee Database - Employee Management System (EMS Pro)
 * Frontend Application Logic (Vanilla JS + Bootstrap 5 + Chart.js)
 * Modernized with Light/Dark theme, Analytics Charts, PDF Salary Slips & CSV Bulk Import
 */

// Base API URL configuration:
const API_BASE_URL = (window.location.port === '8081' || window.location.port === '8080')
    ? `${window.location.origin}/api/employees`
    : 'http://localhost:8081/api/employees';

// Global state
let currentEmployees = [];
let currentRole = localStorage.getItem('ems_role') || 'ADMIN'; // 'ADMIN' or 'HR'
let activeDeleteId = null;
let activeModalEmployeeId = null;
let currentTheme = localStorage.getItem('ems_theme') || 'light';
let deptPieChartInstance = null;
let payrollBarChartInstance = null;
let pendingImportRows = [];

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initRole();
    initEventListeners();

    // Check if on dashboard / list page or add-edit page
    if (document.getElementById('employeeTableBody')) {
        loadEmployees();
        loadStats();
    }

    if (document.getElementById('employeeForm')) {
        initFormPage();
    }
});

/**
 * Initializes and toggles Dark / Light Theme
 */
function initTheme() {
    applyTheme(currentTheme);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
            localStorage.setItem('ems_theme', currentTheme);
            applyTheme(currentTheme);

            if (deptPieChartInstance || payrollBarChartInstance) {
                renderCharts(currentEmployees);
            }
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.className = 'bi bi-sun-fill text-warning';
        } else {
            themeIcon.className = 'bi bi-moon-stars text-light';
        }
    }
}

/**
 * Initializes and syncs current user role
 */
function initRole() {
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
        roleSelect.value = currentRole;
        roleSelect.addEventListener('change', (e) => {
            currentRole = e.target.value;
            localStorage.setItem('ems_role', currentRole);
            updateRoleUI();
            if (document.getElementById('employeeTableBody')) {
                renderEmployeeTable(currentEmployees);
            }
            showToast(`Role switched to ${currentRole}`, 'info');
        });
    }
    updateRoleUI();
}

function updateRoleUI() {
    const roleBadge = document.getElementById('currentRoleDisplay');
    if (roleBadge) {
        roleBadge.textContent = currentRole;
    }

    const addBtns = document.querySelectorAll('.admin-hr-only');
    addBtns.forEach(btn => {
        btn.style.display = (currentRole === 'ADMIN' || currentRole === 'HR') ? 'inline-flex' : 'none';
    });
}

/**
 * Event Listeners for Search, Filter & Modals
 */
function initEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const deptFilter = document.getElementById('departmentFilter');
    const statusFilter = document.getElementById('statusFilter');
    const resetBtn = document.getElementById('resetFiltersBtn');

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                applyFilters();
            }, 250);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            applyFilters();
        });
    }

    if (deptFilter) {
        deptFilter.addEventListener('change', applyFilters);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (deptFilter) deptFilter.value = 'ALL';
            if (statusFilter) statusFilter.value = 'ALL';
            loadEmployees();
        });
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }

    const viewModalSlipBtn = document.getElementById('viewModalSlipBtn');
    if (viewModalSlipBtn) {
        viewModalSlipBtn.addEventListener('click', () => {
            if (activeModalEmployeeId) {
                downloadSalarySlip(activeModalEmployeeId);
            }
        });
    }

    // CSV File Import Handling
    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCsvFileSelect);
    }

    const startImportBtn = document.getElementById('startImportBtn');
    if (startImportBtn) {
        startImportBtn.addEventListener('click', handleBatchImportSubmit);
    }
}

/**
 * Load dashboard statistics and update chart visuals
 */
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        const stats = await response.json();

        const totalEl = document.getElementById('statTotal');
        const activeEl = document.getElementById('statActive');
        const inactiveEl = document.getElementById('statInactive');
        const payrollEl = document.getElementById('statPayroll');
        const activeRatioEl = document.getElementById('statActiveRatio');
        const avgSalaryEl = document.getElementById('statAvgSalary');

        if (totalEl) totalEl.textContent = stats.total || 0;
        if (activeEl) activeEl.textContent = stats.active || 0;
        if (inactiveEl) inactiveEl.textContent = stats.inactive || 0;

        if (payrollEl && stats.totalPayroll !== undefined) {
            payrollEl.textContent = `₹${formatNumberINR(stats.totalPayroll)}`;
        }

        if (activeRatioEl && stats.total > 0) {
            const pct = Math.round((stats.active / stats.total) * 100);
            activeRatioEl.innerHTML = `<i class="bi bi-check-circle text-success me-1"></i>${pct}% workforce active`;
        }

        if (avgSalaryEl && stats.averageSalary !== undefined) {
            avgSalaryEl.textContent = `Avg: ₹${formatNumberINR(stats.averageSalary)} / mo`;
        }
    } catch (err) {
        console.warn('Could not load server stats, will calculate locally:', err);
    }
}

/**
 * Fetch all employees from backend API
 */
async function loadEmployees() {
    showLoading(true);
    try {
        const response = await fetch(API_BASE_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const employees = await response.json();
        currentEmployees = employees;
        renderEmployeeTable(employees);
        updateLocalStats(employees);
        renderCharts(employees);
    } catch (error) {
        console.error('Error loading employees:', error);
        showToast('Unable to connect to Spring Boot backend API. Ensure server is running on port 8081.', 'danger');
        renderEmptyState('Failed to load employee records from server.');
    } finally {
        showLoading(false);
    }
}

/**
 * Filter and Search logic
 */
async function applyFilters() {
    const searchVal = document.getElementById('searchInput')?.value.trim() || '';
    const deptVal = document.getElementById('departmentFilter')?.value || 'ALL';
    const statusVal = document.getElementById('statusFilter')?.value || 'ALL';

    showLoading(true);
    try {
        let url = API_BASE_URL;

        if (searchVal && (deptVal === 'ALL' || !deptVal) && (statusVal === 'ALL' || !statusVal)) {
            url = `${API_BASE_URL}/search?name=${encodeURIComponent(searchVal)}`;
        } else {
            const params = new URLSearchParams();
            if (deptVal && deptVal !== 'ALL') params.append('department', deptVal);
            if (statusVal && statusVal !== 'ALL') params.append('status', statusVal);
            url = `${API_BASE_URL}?${params.toString()}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to filter employees');
        let data = await res.json();

        if (searchVal && (deptVal !== 'ALL' || statusVal !== 'ALL')) {
            const query = searchVal.toLowerCase();
            data = data.filter(e =>
                (e.firstName && e.firstName.toLowerCase().includes(query)) ||
                (e.lastName && e.lastName.toLowerCase().includes(query)) ||
                (e.email && e.email.toLowerCase().includes(query)) ||
                (e.designation && e.designation.toLowerCase().includes(query))
            );
        }

        currentEmployees = data;
        renderEmployeeTable(data);
    } catch (err) {
        console.error('Filter error:', err);
        showToast('Error applying search/filters', 'danger');
    } finally {
        showLoading(false);
    }
}

/**
 * Render Employee Table
 */
function renderEmployeeTable(employees) {
    const tbody = document.getElementById('employeeTableBody');
    const countDisplay = document.getElementById('tableCountDisplay');
    if (!tbody) return;

    if (countDisplay) {
        countDisplay.textContent = `Showing ${employees.length} employee${employees.length === 1 ? '' : 's'}`;
    }

    if (!employees || employees.length === 0) {
        renderEmptyState('No employee records found matching your criteria.');
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        const initials = `${emp.firstName ? emp.firstName[0] : ''}${emp.lastName ? emp.lastName[0] : ''}`.toUpperCase();
        const statusClass = emp.status?.toLowerCase() === 'active' ? 'badge-status-active' : 'badge-status-inactive';
        const formattedSalary = emp.salary ? `₹${parseFloat(emp.salary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
        const formattedDate = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

        const deleteButtonHtml = (currentRole === 'ADMIN')
            ? `<button class="btn btn-sm btn-outline-danger btn-action" onclick="openDeleteModal(${emp.id}, '${escapeQuotes(emp.fullName || emp.firstName)}')" title="Delete Employee">
                 <i class="bi bi-trash"></i>
               </button>`
            : `<button class="btn btn-sm btn-outline-secondary btn-action" disabled title="Delete restricted to ADMIN">
                 <i class="bi bi-lock-fill"></i>
               </button>`;

        return `
            <tr>
                <td class="text-muted fw-semibold">#${emp.id}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="employee-avatar">${initials}</div>
                        <div>
                            <div class="fw-bold">${escapeHtml(emp.fullName || `${emp.firstName} ${emp.lastName}`)}</div>
                            <div class="text-muted small">${escapeHtml(emp.email)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge-department">${escapeHtml(emp.department || 'N/A')}</span></td>
                <td>
                    <div class="fw-medium">${escapeHtml(emp.designation || 'N/A')}</div>
                    <div class="text-muted small">${formattedSalary}</div>
                </td>
                <td><span class="badge badge-status ${statusClass}">${escapeHtml(emp.status || 'Active')}</span></td>
                <td class="text-muted small">${formattedDate}</td>
                <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="viewEmployeeDetails(${emp.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success btn-action" onclick="downloadSalarySlip(${emp.id})" title="Download Salary Slip (PDF)">
                            <i class="bi bi-file-earmark-pdf"></i>
                        </button>
                        <a href="add-employee.html?id=${emp.id}" class="btn btn-sm btn-outline-secondary btn-action admin-hr-only" title="Edit Employee">
                            <i class="bi bi-pencil"></i>
                        </a>
                        ${deleteButtonHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Render Interactive Analytics Charts using Chart.js
 */
function renderCharts(employees) {
    if (!employees || employees.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    const deptMap = {};
    const payrollMap = {};
    employees.forEach(e => {
        const d = e.department || 'General';
        deptMap[d] = (deptMap[d] || 0) + 1;
        const s = parseFloat(e.salary || 0);
        payrollMap[d] = (payrollMap[d] || 0) + s;
    });

    const labels = Object.keys(deptMap);
    const counts = labels.map(l => deptMap[l]);
    const salaries = labels.map(l => payrollMap[l]);

    const palette = [
        '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'
    ];

    // 1. Department Distribution Donut / Pie Chart
    const pieCtx = document.getElementById('deptPieChart');
    if (pieCtx && typeof Chart !== 'undefined') {
        if (deptPieChartInstance) deptPieChartInstance.destroy();
        deptPieChartInstance = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: palette.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: isDark ? '#111827' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor, font: { family: 'Inter', size: 11 }, boxWidth: 12 }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // 2. Department Payroll Bar Chart
    const barCtx = document.getElementById('payrollBarChart');
    if (barCtx && typeof Chart !== 'undefined') {
        if (payrollBarChartInstance) payrollBarChartInstance.destroy();
        payrollBarChartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Payroll (₹)',
                    data: salaries,
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.75)' : '#6366f1',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Payroll: ₹${context.parsed.y.toLocaleString('en-IN')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { family: 'Inter', size: 11 },
                            callback: value => `₹${(value / 1000).toFixed(0)}k`
                        },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }
}

/**
 * Update local counters
 */
function updateLocalStats(employees) {
    const totalEl = document.getElementById('statTotal');
    const activeEl = document.getElementById('statActive');
    const inactiveEl = document.getElementById('statInactive');
    const payrollEl = document.getElementById('statPayroll');

    if (!employees) return;
    const total = employees.length;
    const active = employees.filter(e => e.status?.toLowerCase() === 'active').length;
    const inactive = total - active;
    const payroll = employees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (inactiveEl) inactiveEl.textContent = inactive;
    if (payrollEl) payrollEl.textContent = `₹${formatNumberINR(payroll)}`;
}

/**
 * Open detail profile modal
 */
async function viewEmployeeDetails(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/${id}`);
        if (!res.ok) throw new Error('Employee not found');
        const emp = await res.json();
        activeModalEmployeeId = emp.id;

        document.getElementById('viewModalName').textContent = emp.fullName || `${emp.firstName} ${emp.lastName}`;
        document.getElementById('viewModalDesignation').textContent = emp.designation || 'No Designation specified';
        document.getElementById('viewModalEmail').textContent = emp.email || 'N/A';
        document.getElementById('viewModalPhone').textContent = emp.phone || 'N/A';
        document.getElementById('viewModalDept').textContent = emp.department || 'N/A';
        document.getElementById('viewModalSalary').textContent = emp.salary ? `₹${parseFloat(emp.salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
        document.getElementById('viewModalJoinDate').textContent = emp.joiningDate || 'N/A';
        document.getElementById('viewModalDob').textContent = emp.dateOfBirth || 'N/A';
        document.getElementById('viewModalGender').textContent = emp.gender || 'N/A';
        document.getElementById('viewModalAddress').textContent = emp.address || 'N/A';

        const statusContainer = document.getElementById('viewModalStatus');
        const statusClass = emp.status?.toLowerCase() === 'active' ? 'badge-status-active' : 'badge-status-inactive';
        statusContainer.innerHTML = `<span class="badge badge-status ${statusClass}">${escapeHtml(emp.status || 'Active')}</span>`;

        const editBtn = document.getElementById('viewModalEditBtn');
        if (editBtn) {
            editBtn.href = `add-employee.html?id=${emp.id}`;
        }

        const modalEl = document.getElementById('viewEmployeeModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (err) {
        console.error(err);
        showToast('Failed to load employee profile', 'danger');
    }
}

/**
 * Download Salary Slip PDF
 */
function downloadSalarySlip(id) {
    showToast('Generating official PDF salary slip...', 'info');
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/${id}/salary-slip`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Delete Modal Flow
 */
function openDeleteModal(id, name) {
    activeDeleteId = id;
    const nameEl = document.getElementById('deleteEmployeeName');
    if (nameEl) nameEl.textContent = name;

    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

async function handleConfirmDelete() {
    if (!activeDeleteId) return;

    try {
        const res = await fetch(`${API_BASE_URL}/${activeDeleteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete employee');

        const modalEl = document.getElementById('deleteConfirmModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        showToast('Employee successfully deleted from database', 'success');
        activeDeleteId = null;
        loadEmployees();
        loadStats();
    } catch (err) {
        console.error(err);
        showToast('Could not delete employee record.', 'danger');
    }
}

/**
 * Bulk CSV Import Logic
 */
function openImportModal() {
    pendingImportRows = [];
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('importPreview');
    if (preview) {
        preview.style.display = 'none';
        preview.innerHTML = '';
    }
    const startBtn = document.getElementById('startImportBtn');
    if (startBtn) startBtn.disabled = true;

    const modal = new bootstrap.Modal(document.getElementById('importModal'));
    modal.show();
}

function handleCsvFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        parseCsvText(text);
    };
    reader.readAsText(file);
}

function parseCsvText(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        showToast('CSV file must have a header row and at least 1 employee row.', 'warning');
        return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < headers.length) continue;

        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] ? values[idx].trim().replace(/^"|"$/g, '') : '';
        });

        // Basic normalization
        if (obj.firstName && obj.lastName && obj.email) {
            rows.push({
                firstName: obj.firstName,
                lastName: obj.lastName,
                email: obj.email,
                phone: obj.phone || '',
                department: obj.department || 'IT',
                designation: obj.designation || 'Staff',
                salary: parseFloat(obj.salary) || 50000,
                joiningDate: obj.joiningDate || new Date().toISOString().slice(0, 10),
                status: obj.status || 'Active',
                address: obj.address || ''
            });
        }
    }

    pendingImportRows = rows;
    const preview = document.getElementById('importPreview');
    const startBtn = document.getElementById('startImportBtn');

    if (preview) {
        preview.style.display = 'block';
        preview.innerHTML = `<strong>Parsed ${rows.length} valid employee rows:</strong><ul class="mb-0 ps-3 mt-1">${rows.slice(0, 5).map(r => `<li>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)} (${escapeHtml(r.email)}) - ${escapeHtml(r.department)}</li>`).join('')}${rows.length > 5 ? `<li><em>...and ${rows.length - 5} more</em></li>` : ''}</ul>`;
    }

    if (startBtn) {
        startBtn.disabled = (rows.length === 0);
    }
}

function parseCsvLine(line) {
    const re = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    const res = [];
    line.replace(re, (m, p1, p2, p3) => {
        if (p1 !== undefined) res.push(p1);
        else if (p2 !== undefined) res.push(p2);
        else if (p3 !== undefined) res.push(p3);
        return '';
    });
    return res;
}

async function handleBatchImportSubmit() {
    if (!pendingImportRows || pendingImportRows.length === 0) return;

    const startBtn = document.getElementById('startImportBtn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Importing...';
    }

    let successCount = 0;
    let failedCount = 0;

    for (const emp of pendingImportRows) {
        try {
            const res = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emp)
            });
            if (res.ok) {
                successCount++;
            } else {
                failedCount++;
            }
        } catch (err) {
            failedCount++;
        }
    }

    const modalEl = document.getElementById('importModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (startBtn) {
        startBtn.innerHTML = '<i class="bi bi-upload me-1"></i> Start Batch Import';
    }

    showToast(`Bulk Import complete! ${successCount} added, ${failedCount} skipped.`, successCount > 0 ? 'success' : 'warning');
    loadEmployees();
    loadStats();
}

/**
 * Form Initialization & Submission
 */
async function initFormPage() {
    const params = new URLSearchParams(window.location.search);
    const empId = params.get('id');

    if (empId) {
        document.getElementById('formTitle').textContent = 'Edit Employee Profile';
        document.getElementById('saveEmployeeBtn').innerHTML = '<i class="bi bi-check2-circle me-1"></i> Update Employee Profile';
        document.getElementById('employeeId').value = empId;
        await loadEmployeeIntoForm(empId);
    }

    const form = document.getElementById('employeeForm');
    form.addEventListener('submit', handleFormSubmit);
}

async function loadEmployeeIntoForm(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/${id}`);
        if (!res.ok) throw new Error('Employee not found');
        const emp = await res.json();

        document.getElementById('firstName').value = emp.firstName || '';
        document.getElementById('lastName').value = emp.lastName || '';
        document.getElementById('email').value = emp.email || '';
        document.getElementById('phone').value = emp.phone || '';
        document.getElementById('dateOfBirth').value = emp.dateOfBirth || '';
        document.getElementById('gender').value = emp.gender || '';
        document.getElementById('department').value = emp.department || '';
        document.getElementById('designation').value = emp.designation || '';
        document.getElementById('salary').value = emp.salary || '';
        document.getElementById('joiningDate').value = emp.joiningDate || '';
        document.getElementById('status').value = emp.status || 'Active';
        document.getElementById('address').value = emp.address || '';
    } catch (err) {
        console.error(err);
        showToast('Failed to load employee for editing', 'danger');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    const empId = document.getElementById('employeeId').value;
    const isEdit = Boolean(empId);

    const payload = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        dateOfBirth: document.getElementById('dateOfBirth').value || null,
        gender: document.getElementById('gender').value || null,
        department: document.getElementById('department').value,
        designation: document.getElementById('designation').value.trim(),
        salary: parseFloat(document.getElementById('salary').value) || 0,
        joiningDate: document.getElementById('joiningDate').value,
        status: document.getElementById('status').value,
        address: document.getElementById('address').value.trim()
    };

    let hasError = false;
    if (!payload.firstName) { showFieldError('firstName', 'First name is required'); hasError = true; }
    if (!payload.lastName) { showFieldError('lastName', 'Last name is required'); hasError = true; }
    if (!payload.email) { showFieldError('email', 'Email is required'); hasError = true; }
    if (!payload.department) { showFieldError('department', 'Department is required'); hasError = true; }
    if (!payload.salary || payload.salary <= 0) { showFieldError('salary', 'Salary must be a positive number'); hasError = true; }
    if (!payload.joiningDate) { showFieldError('joiningDate', 'Joining date is required'); hasError = true; }

    if (hasError) return;

    const url = isEdit ? `${API_BASE_URL}/${empId}` : API_BASE_URL;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 409) {
            const err = await res.json();
            showFieldError('email', err.message || 'Email already exists in system.');
            showToast('Email address already exists in the database', 'warning');
            return;
        }

        if (res.status === 400) {
            const err = await res.json();
            if (err.fieldErrors) {
                Object.keys(err.fieldErrors).forEach(field => {
                    showFieldError(field, err.fieldErrors[field]);
                });
            }
            showToast('Please fix the form errors.', 'warning');
            return;
        }

        if (!res.ok) throw new Error('Submission failed');

        showToast(isEdit ? 'Employee updated successfully!' : 'Employee created successfully!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1200);

    } catch (err) {
        console.error(err);
        showToast('Error saving employee. Ensure backend is running.', 'danger');
    }
}

/**
 * CSV Export Utility
 */
function exportToCSV() {
    if (!currentEmployees || currentEmployees.length === 0) {
        showToast('No records to export!', 'warning');
        return;
    }

    const headers = ['firstName', 'lastName', 'email', 'phone', 'department', 'designation', 'salary', 'status', 'joiningDate', 'address'];
    const rows = currentEmployees.map(e => [
        `"${(e.firstName || '').replace(/"/g, '""')}"`,
        `"${(e.lastName || '').replace(/"/g, '""')}"`,
        `"${(e.email || '').replace(/"/g, '""')}"`,
        `"${(e.phone || '').replace(/"/g, '""')}"`,
        `"${(e.department || '').replace(/"/g, '""')}"`,
        `"${(e.designation || '').replace(/"/g, '""')}"`,
        e.salary || 0,
        e.status || '',
        e.joiningDate || '',
        `"${(e.address || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EMS_Employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Employee dataset downloaded as CSV', 'info');
}

/**
 * Toast notifications
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const iconMap = {
        success: 'bi-check-circle-fill text-success',
        danger: 'bi-exclamation-octagon-fill text-danger',
        warning: 'bi-exclamation-triangle-fill text-warning',
        info: 'bi-info-circle-fill text-primary'
    };

    const toast = document.createElement('div');
    toast.className = 'ems-toast';
    toast.innerHTML = `
        <i class="bi ${iconMap[type] || iconMap.info}" style="font-size: 1.25rem;"></i>
        <div class="flex-grow-1 small fw-medium">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-sm" style="font-size: 0.75rem;"></button>
    `;

    toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Helper UI functions
 */
function showLoading(show) {
    const spinner = document.getElementById('tableSpinner');
    if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
}

function renderEmptyState(message) {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-5">
                <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                <h6 class="mt-2 text-muted fw-semibold">${escapeHtml(message)}</h6>
            </td>
        </tr>
    `;
}

function showFieldError(fieldId, errorMsg) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.classList.add('is-invalid');
    const feedback = input.parentElement.querySelector('.invalid-feedback') || input.nextElementSibling;
    if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = errorMsg;
        feedback.style.display = 'block';
    }
}

function clearFormErrors() {
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.invalid-feedback').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
}

function formatNumberINR(num) {
    return parseFloat(num || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
