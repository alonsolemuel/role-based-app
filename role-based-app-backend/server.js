const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret';

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// IN-MEMORY DATA STORE
let nextUserId = 3;
let nextDepartmentId = 3;
let nextEmployeeId = 2;
let nextRequestId = 1;

let users = [
    {
        id: 1,
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin',
        verified: true
    },
    {
        id: 2,
        firstName: 'Alice',
        lastName: 'User',
        email: 'alice@example.com',
        password: bcrypt.hashSync('user123', 10),
        role: 'user',
        verified: true
    }
];

let departments = [
    { id: 1, name: 'Engineering', description: 'Software team' },
    { id: 2, name: 'HR', description: 'Human Resources' }
];

let employees = [
    {
        id: 1,
        empId: 'EMP-001',
        email: 'admin@example.com',
        position: 'System Administrator',
        deptId: 1,
        hireDate: '2025-01-15'
    }
];

let requests = [];

// HELPERS
function sanitizeUser(user) {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        verified: user.verified
    };
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        const dbUser = users.find(u => u.id === decoded.id);

        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!dbUser.verified) {
            return res.status(403).json({ error: 'Account is not verified' });
        }

        req.user = {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role
        };

        next();
    });
}

function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    };
}

// AUTH ROUTES
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }

    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        id: nextUserId++,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: 'user',
        verified: true
    };

    users.push(newUser);

    res.status(201).json({
        message: 'User registered successfully',
        user: sanitizeUser(newUser)
    });
});

app.post('/api/login', async (req, res) => {
    const email = req.body.email || req.body.username;
    const { password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.verified) {
        return res.status(403).json({ error: 'Account is not verified' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        SECRET_KEY,
        { expiresIn: '1h' }
    );

    res.json({
        token,
        user: sanitizeUser(user)
    });
});

app.get('/api/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
});

app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({
        message: 'Welcome to admin dashboard',
        data: 'Secret admin info'
    });
});

// ACCOUNTS ROUTES (ADMIN)
app.get('/api/accounts', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json(users.map(sanitizeUser));
});

app.post('/api/accounts', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { firstName, lastName, email, password, role, verified } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
        return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        id: nextUserId++,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role.toLowerCase(),
        verified: Boolean(verified)
    };

    users.push(newUser);

    res.status(201).json({
        message: 'Account created',
        user: sanitizeUser(newUser)
    });
});

app.put('/api/accounts/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const id = Number(req.params.id);
    const user = users.find(u => u.id === id);

    if (!user) {
        return res.status(404).json({ error: 'Account not found' });
    }

    const { firstName, lastName, email, role, verified, password } = req.body;

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
        const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== id);
        if (existing) {
            return res.status(409).json({ error: 'Email already exists' });
        }
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = String(role).toLowerCase();
    if (verified !== undefined) user.verified = Boolean(verified);

    if (password && password.trim() !== '') {
        user.password = await bcrypt.hash(password, 10);
    }

    res.json({
        message: 'Account updated',
        user: sanitizeUser(user)
    });
});

app.delete('/api/accounts/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = Number(req.params.id);

    if (req.user.id === id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Account not found' });
    }

    const deletedEmail = users[index].email;
    users.splice(index, 1);

    employees = employees.filter(e => e.email !== deletedEmail);
    requests = requests.filter(r => r.employeeEmail !== deletedEmail);

    res.json({ message: 'Account deleted' });
});

// DEPARTMENTS ROUTES
app.get('/api/departments', authenticateToken, (req, res) => {
    res.json(departments);
});

app.post('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { name, description } = req.body;

    if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
    }

    const newDepartment = {
        id: nextDepartmentId++,
        name,
        description
    };

    departments.push(newDepartment);

    res.status(201).json({
        message: 'Department created',
        department: newDepartment
    });
});

app.put('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = Number(req.params.id);
    const dept = departments.find(d => d.id === id);

    if (!dept) {
        return res.status(404).json({ error: 'Department not found' });
    }

    const { name, description } = req.body;

    if (name !== undefined) dept.name = name;
    if (description !== undefined) dept.description = description;

    res.json({
        message: 'Department updated',
        department: dept
    });
});

app.delete('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = Number(req.params.id);

    const inUse = employees.some(e => e.deptId === id);
    if (inUse) {
        return res.status(400).json({ error: 'Cannot delete a department assigned to employees' });
    }

    const index = departments.findIndex(d => d.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Department not found' });
    }

    departments.splice(index, 1);

    res.json({ message: 'Department deleted' });
});

// EMPLOYEES ROUTES
app.get('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json(employees);
});

app.post('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { empId, email, position, deptId, hireDate } = req.body;

    if (!empId || !email || !position || !deptId || !hireDate) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (!userExists) {
        return res.status(400).json({ error: 'Email must match an existing account' });
    }

    const newEmployee = {
        id: nextEmployeeId++,
        empId,
        email,
        position,
        deptId: Number(deptId),
        hireDate
    };

    employees.push(newEmployee);

    res.status(201).json({
        message: 'Employee created',
        employee: newEmployee
    });
});

app.put('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = Number(req.params.id);
    const employee = employees.find(e => e.id === id);

    if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
    }

    const { empId, email, position, deptId, hireDate } = req.body;

    if (email !== undefined) {
        const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (!userExists) {
            return res.status(400).json({ error: 'Email must match an existing account' });
        }
    }

    if (empId !== undefined) employee.empId = empId;
    if (email !== undefined) employee.email = email;
    if (position !== undefined) employee.position = position;
    if (deptId !== undefined) employee.deptId = Number(deptId);
    if (hireDate !== undefined) employee.hireDate = hireDate;

    res.json({
        message: 'Employee updated',
        employee
    });
});

app.delete('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = Number(req.params.id);
    const index = employees.findIndex(e => e.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Employee not found' });
    }

    employees.splice(index, 1);

    res.json({ message: 'Employee deleted' });
});

// REQUESTS ROUTES
app.get('/api/requests', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        return res.json(requests);
    }

    const ownRequests = requests.filter(r => r.employeeEmail.toLowerCase() === req.user.email.toLowerCase());
    res.json(ownRequests);
});

app.post('/api/requests', authenticateToken, (req, res) => {
    const { type, items } = req.body;

    if (!type || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Type and at least one item are required' });
    }

    const newRequest = {
        id: nextRequestId++,
        type,
        items,
        status: 'Pending',
        date: new Date().toISOString(),
        employeeEmail: req.user.email
    };

    requests.push(newRequest);

    res.status(201).json({
        message: 'Request submitted',
        request: newRequest
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`   Backend running on http://localhost:${PORT}`);
    console.log('   Try logging in with:');
    console.log('   Admin: email=admin@example.com, password=admin123');
    console.log('   User:  email=alice@example.com, password=user123');
});