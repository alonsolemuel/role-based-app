const API_BASE = 'http://localhost:3000/api';

let currentUser = null;
let accountsCache = [];
let departmentsCache = [];
let employeesCache = [];
let requestsCache = [];

// HELPERS
function navigateTo(hash) {
    window.location.hash = hash;
}

function getAuthHeaders() {
    const token = sessionStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function normalizeRole(role) {
    return String(role || '').toLowerCase();
}

function isAdminUser(user) {
    return normalizeRole(user?.role) === 'admin';
}

function showToast(message, type = 'success') {
    const toastEl = document.getElementById('app-toast');
    const toastBody = document.getElementById('toast-body');
    toastEl.className = `toast text-white border-0 bg-${type}`;
    toastBody.textContent = message;
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    let data = null;

    try {
        data = await res.json();
    } catch {
        data = null;
    }

    if (!res.ok) {
        throw new Error(data?.error || 'Request failed');
    }

    return data;
}

// ROUTING
async function handleRouting() {
    const path = window.location.hash.replace(/^#\/?/, '');

    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    const protectedRoutes = ['profile', 'requests'];
    const adminRoutes = ['employees', 'accounts', 'departments'];

    if (protectedRoutes.includes(path) && !currentUser) {
        navigateTo('#/login');
        return;
    }

    if (adminRoutes.includes(path) && (!currentUser || !isAdminUser(currentUser))) {
        showToast('Admin access required', 'danger');
        navigateTo('#/');
        return;
    }

    const pageMap = {
        '': 'home-page',
        'home': 'home-page',
        'register': 'register-page',
        'verify-email': 'verify-email-page',
        'login': 'login-page',
        'profile': 'profile-page',
        'employees': 'employees-page',
        'departments': 'departments-page',
        'accounts': 'accounts-page',
        'requests': 'requests-page'
    };

    const pageId = pageMap[path] || 'home-page';
    const page = document.getElementById(pageId);

    if (page) {
        page.classList.add('active');
    }

    if (path === 'verify-email') {
        const email = sessionStorage.getItem('pendingEmail') || '';
        document.getElementById('verify-email-display').textContent = email;
    }

    if (path === 'profile') await renderProfile();
    if (path === 'accounts') await renderAccountsTable();
    if (path === 'departments') await renderDepartmentsTable();
    if (path === 'employees') await renderEmployeesTable();
    if (path === 'requests') await renderRequestsTable();
}

window.addEventListener('hashchange', handleRouting);

// AUTH
function setAuthState(isAuth, user = null) {
    currentUser = isAuth ? user : null;
    const body = document.body;

    if (isAuth && user) {
        body.classList.remove('not-authenticated');
        body.classList.add('authenticated');
        body.classList.toggle('is-admin', isAdminUser(user));
        document.getElementById('nav-username').textContent =
            user.firstName || user.email || 'User';
    } else {
        body.classList.remove('authenticated', 'is-admin');
        body.classList.add('not-authenticated');
        document.getElementById('nav-username').textContent = 'User';
    }
}

async function checkAuth() {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        setAuthState(false);
        return;
    }

    try {
        const data = await apiFetch(`${API_BASE}/profile`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        setAuthState(true, data.user);
    } catch {
        sessionStorage.removeItem('authToken');
        setAuthState(false);
    }
}

// REGISTER
document.getElementById('register-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
        await apiFetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password })
        });

        sessionStorage.setItem('pendingEmail', email);
        this.reset();
        showToast('Registration successful', 'success');
        navigateTo('#/verify-email');
    } catch (err) {
        showToast(err.message, 'danger');
    }
});


// VERIFY PAGE (TRANSITION ONLY)
document.getElementById('simulate-verify-btn').addEventListener('click', function () {
    sessionStorage.removeItem('pendingEmail');
    showToast('Account ready. You may now log in.', 'success');
    navigateTo('#/login');
});

// LOGIN
document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const data = await apiFetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        sessionStorage.setItem('authToken', data.token);
        setAuthState(true, data.user);

        this.reset();
        showToast('Login successful', 'success');
        navigateTo('#/profile');
    } catch (err) {
        showToast(err.message, 'danger');
    }
});

// LOGOUT
document.getElementById('logout-btn').addEventListener('click', function (e) {
    e.preventDefault();
    sessionStorage.removeItem('authToken');
    setAuthState(false);
    navigateTo('#/');
});

// PROFILE
async function renderProfile() {
    const container = document.getElementById('profile-content');

    if (!currentUser) {
        container.innerHTML = `<div class="alert alert-warning">Please log in first.</div>`;
        return;
    }

    try {
        const data = await apiFetch(`${API_BASE}/profile`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const user = data.user;

        container.innerHTML = `
            <div class="card" style="max-width:400px">
                <div class="card-body">
                    <h5>${user.firstName} ${user.lastName}</h5>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Role:</strong> ${user.role}</p>
                    <button class="btn btn-secondary btn-sm" onclick="alert('Edit Profile - coming soon')">Edit Profile</button>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
}

// ACCOUNTS
async function renderAccountsTable() {
    const container = document.getElementById('accounts-table');

    try {
        accountsCache = await apiFetch(`${API_BASE}/accounts`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (accountsCache.length === 0) {
            container.innerHTML = '<p>No accounts.</p>';
            return;
        }

        container.innerHTML = `
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Verified</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${accountsCache.map(acc => `
                        <tr>
                            <td>${acc.firstName} ${acc.lastName}</td>
                            <td>${acc.email}</td>
                            <td>${acc.role}</td>
                            <td>${acc.verified ? '✅' : '—'}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="editAccount(${acc.id})">Edit</button>
                                <button class="btn btn-sm btn-warning" onclick="resetPassword(${acc.id})">Reset PW</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteAccount(${acc.id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
}

document.getElementById('add-account-btn').addEventListener('click', function () {
    document.getElementById('acc-hidden-id').value = '';
    document.getElementById('account-form-title').textContent = 'Add Account';
    document.getElementById('acc-firstname').value = '';
    document.getElementById('acc-lastname').value = '';
    document.getElementById('acc-email').value = '';
    document.getElementById('acc-password').value = '';
    document.getElementById('acc-role').value = 'user';
    document.getElementById('acc-verified').checked = true;
    document.getElementById('acc-password-wrap').style.display = 'block';
    document.getElementById('account-form-container').style.display = 'block';
});

function editAccount(id) {
    const acc = accountsCache.find(a => a.id === id);
    if (!acc) return;

    document.getElementById('acc-hidden-id').value = acc.id;
    document.getElementById('account-form-title').textContent = 'Edit Account';
    document.getElementById('acc-firstname').value = acc.firstName;
    document.getElementById('acc-lastname').value = acc.lastName;
    document.getElementById('acc-email').value = acc.email;
    document.getElementById('acc-password').value = '';
    document.getElementById('acc-role').value = acc.role;
    document.getElementById('acc-verified').checked = acc.verified;
    document.getElementById('acc-password-wrap').style.display = 'none';
    document.getElementById('account-form-container').style.display = 'block';
}

async function resetPassword(id) {
    const newPw = prompt('Enter new password (min 6 chars):');
    if (!newPw || newPw.length < 6) {
        showToast('Password must be at least 6 characters', 'danger');
        return;
    }

    try {
        await apiFetch(`${API_BASE}/accounts/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ password: newPw })
        });

        showToast('Password reset successfully', 'success');
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function deleteAccount(id) {
    if (!confirm('Delete this account?')) return;

    try {
        await apiFetch(`${API_BASE}/accounts/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        showToast('Account deleted', 'success');
        await renderAccountsTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

document.getElementById('save-account-btn').addEventListener('click', async function () {
    const id = document.getElementById('acc-hidden-id').value;
    const firstName = document.getElementById('acc-firstname').value.trim();
    const lastName = document.getElementById('acc-lastname').value.trim();
    const email = document.getElementById('acc-email').value.trim();
    const role = document.getElementById('acc-role').value;
    const verified = document.getElementById('acc-verified').checked;
    const password = document.getElementById('acc-password').value;

    if (!firstName || !lastName || !email) {
        showToast('Please fill all fields', 'danger');
        return;
    }

    try {
        if (id) {
            await apiFetch(`${API_BASE}/accounts/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ firstName, lastName, email, role, verified })
            });
        } else {
            if (!password || password.length < 6) {
                showToast('Password must be at least 6 characters', 'danger');
                return;
            }

            await apiFetch(`${API_BASE}/accounts`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ firstName, lastName, email, password, role, verified })
            });
        }

        document.getElementById('account-form-container').style.display = 'none';
        showToast('Account saved', 'success');
        await renderAccountsTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
});

document.getElementById('cancel-account-btn').addEventListener('click', function () {
    document.getElementById('account-form-container').style.display = 'none';
});

// DEPARTMENTS
async function renderDepartmentsTable() {
    const container = document.getElementById('departments-table');

    try {
        departmentsCache = await apiFetch(`${API_BASE}/departments`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (departmentsCache.length === 0) {
            container.innerHTML = '<p>No departments.</p>';
            return;
        }

        container.innerHTML = `
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${departmentsCache.map(dept => `
                        <tr>
                            <td>${dept.name}</td>
                            <td>${dept.description}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="editDepartment(${dept.id})">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${dept.id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
}

document.getElementById('add-department-btn').addEventListener('click', function () {
    document.getElementById('dept-hidden-id').value = '';
    document.getElementById('department-form-title').textContent = 'Add Department';
    document.getElementById('dept-name').value = '';
    document.getElementById('dept-desc').value = '';
    document.getElementById('department-form-container').style.display = 'block';
});

function editDepartment(id) {
    const dept = departmentsCache.find(d => d.id === id);
    if (!dept) return;

    document.getElementById('dept-hidden-id').value = dept.id;
    document.getElementById('department-form-title').textContent = 'Edit Department';
    document.getElementById('dept-name').value = dept.name;
    document.getElementById('dept-desc').value = dept.description;
    document.getElementById('department-form-container').style.display = 'block';
}

async function deleteDepartment(id) {
    if (!confirm('Delete this department?')) return;

    try {
        await apiFetch(`${API_BASE}/departments/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        showToast('Department deleted', 'success');
        await renderDepartmentsTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

document.getElementById('save-department-btn').addEventListener('click', async function () {
    const id = document.getElementById('dept-hidden-id').value;
    const name = document.getElementById('dept-name').value.trim();
    const description = document.getElementById('dept-desc').value.trim();

    if (!name || !description) {
        showToast('Please fill all fields', 'danger');
        return;
    }

    try {
        if (id) {
            await apiFetch(`${API_BASE}/departments/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, description })
            });
        } else {
            await apiFetch(`${API_BASE}/departments`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, description })
            });
        }

        document.getElementById('department-form-container').style.display = 'none';
        showToast('Department saved', 'success');
        await renderDepartmentsTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
});

document.getElementById('cancel-department-btn').addEventListener('click', function () {
    document.getElementById('department-form-container').style.display = 'none';
});


// EMPLOYEES
async function renderEmployeesTable() {
    const container = document.getElementById('employees-table');

    try {
        employeesCache = await apiFetch(`${API_BASE}/employees`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (employeesCache.length === 0) {
            container.innerHTML = '<p>No employees.</p>';
            return;
        }

        container.innerHTML = `
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Position</th>
                        <th>Department</th>
                        <th>Hire Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${employeesCache.map(emp => {
                        const dept = departmentsCache.find(d => d.id === emp.deptId);
                        return `
                            <tr>
                                <td>${emp.empId}</td>
                                <td>${emp.email}</td>
                                <td>${emp.position}</td>
                                <td>${dept ? dept.name : 'N/A'}</td>
                                <td>${emp.hireDate}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="editEmployee(${emp.id})">Edit</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${emp.id})">Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
}

async function populateDeptDropdown(selectedId = '') {
    if (departmentsCache.length === 0) {
        departmentsCache = await apiFetch(`${API_BASE}/departments`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
    }

    const select = document.getElementById('emp-dept');
    select.innerHTML = departmentsCache.map(dept => `
        <option value="${dept.id}" ${String(dept.id) === String(selectedId) ? 'selected' : ''}>
            ${dept.name}
        </option>
    `).join('');
}

document.getElementById('add-employee-btn').addEventListener('click', async function () {
    document.getElementById('emp-hidden-id').value = '';
    document.getElementById('employee-form-title').textContent = 'Add Employee';
    document.getElementById('emp-empid').value = '';
    document.getElementById('emp-email').value = '';
    document.getElementById('emp-position').value = '';
    document.getElementById('emp-hiredate').value = '';
    await populateDeptDropdown();
    document.getElementById('employee-form-container').style.display = 'block';
});

function editEmployee(id) {
    const emp = employeesCache.find(e => e.id === id);
    if (!emp) return;

    document.getElementById('emp-hidden-id').value = emp.id;
    document.getElementById('employee-form-title').textContent = 'Edit Employee';
    document.getElementById('emp-empid').value = emp.empId;
    document.getElementById('emp-email').value = emp.email;
    document.getElementById('emp-position').value = emp.position;
    document.getElementById('emp-hiredate').value = emp.hireDate;
    populateDeptDropdown(emp.deptId);
    document.getElementById('employee-form-container').style.display = 'block';
}

async function deleteEmployee(id) {
    if (!confirm('Delete this employee?')) return;

    try {
        await apiFetch(`${API_BASE}/employees/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        showToast('Employee deleted', 'success');
        await renderEmployeesTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

document.getElementById('save-employee-btn').addEventListener('click', async function () {
    const id = document.getElementById('emp-hidden-id').value;
    const empId = document.getElementById('emp-empid').value.trim();
    const email = document.getElementById('emp-email').value.trim();
    const position = document.getElementById('emp-position').value.trim();
    const deptId = document.getElementById('emp-dept').value;
    const hireDate = document.getElementById('emp-hiredate').value;

    if (!empId || !email || !position || !deptId || !hireDate) {
        showToast('Please fill all fields', 'danger');
        return;
    }

    try {
        if (id) {
            await apiFetch(`${API_BASE}/employees/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ empId, email, position, deptId, hireDate })
            });
        } else {
            await apiFetch(`${API_BASE}/employees`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ empId, email, position, deptId, hireDate })
            });
        }

        document.getElementById('employee-form-container').style.display = 'none';
        showToast('Employee saved', 'success');
        await renderEmployeesTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
});

document.getElementById('cancel-employee-btn').addEventListener('click', function () {
    document.getElementById('employee-form-container').style.display = 'none';
});

// REQUESTS
async function renderRequestsTable() {
    const container = document.getElementById('requests-table');

    try {
        requestsCache = await apiFetch(`${API_BASE}/requests`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (requestsCache.length === 0) {
            container.innerHTML = '<p>You have no requests yet.</p>';
            return;
        }

        const badgeMap = {
            Pending: 'warning',
            Approved: 'success',
            Rejected: 'danger'
        };

        container.innerHTML = `
            <table class="table table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${requestsCache.map(req => `
                        <tr>
                            <td>${req.type}</td>
                            <td>${req.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                            <td>${new Date(req.date).toLocaleDateString()}</td>
                            <td><span class="badge bg-${badgeMap[req.status] || 'secondary'}">${req.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
}

function addRequestItem() {
    const container = document.getElementById('req-items-container');
    const row = document.createElement('div');
    row.className = 'input-group mb-1';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Item name" required>
        <input type="number" class="form-control" style="max-width:80px" value="1" min="1" required>
        <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

document.getElementById('new-request-btn').addEventListener('click', function () {
    document.getElementById('req-items-container').innerHTML = '';
    addRequestItem();
    document.getElementById('request-form-container').style.display = 'block';
});

document.getElementById('add-req-item-btn').addEventListener('click', addRequestItem);

document.getElementById('cancel-request-btn').addEventListener('click', function () {
    document.getElementById('request-form-container').style.display = 'none';
});

document.getElementById('submit-request-btn').addEventListener('click', async function () {
    const items = [];

    document.querySelectorAll('#req-items-container .input-group').forEach(row => {
        const name = row.querySelector('input[type="text"]').value.trim();
        const qty = parseInt(row.querySelector('input[type="number"]').value, 10);

        if (name) {
            items.push({ name, qty });
        }
    });

    if (items.length === 0) {
        showToast('Add at least one item', 'danger');
        return;
    }

    try {
        await apiFetch(`${API_BASE}/requests`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                type: document.getElementById('req-type').value,
                items
            })
        });

        document.getElementById('request-form-container').style.display = 'none';
        showToast('Request submitted!', 'success');
        await renderRequestsTable();
    } catch (err) {
        showToast(err.message, 'danger');
    }
});

// INIT
window.addEventListener('load', async function () {
    await checkAuth();

    if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#/';
    }

    await handleRouting();
});