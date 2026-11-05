# 🔐 Role-Based App

**A role-based access control (RBAC) web app with an Express backend and a plain HTML/CSS/JS frontend.**

Users log in with JWT authentication. What they can see and do depends on their role: admins can manage accounts, departments and employees, while regular users can view their profile and submit requests.

## ✨ Features

- Register and log in with **JWT** tokens
- Passwords hashed with **bcrypt**
- Role-based access (admin vs. user)
- Admin dashboard
- CRUD for **accounts**, **departments** and **employees**
- Users can submit and view **requests**

## 🛠️ Tech Stack

Node.js · Express 5 · JSON Web Token · bcryptjs · HTML · CSS · JavaScript

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register` | Create an account |
| POST | `/api/login` | Log in, returns a JWT |
| GET | `/api/profile` | Current user's profile |
| GET | `/api/admin/dashboard` | Admin dashboard data |
| GET/POST/PUT/DELETE | `/api/accounts` | Manage accounts |
| GET/POST/PUT/DELETE | `/api/departments` | Manage departments |
| GET/POST/PUT/DELETE | `/api/employees` | Manage employees |
| GET/POST | `/api/requests` | View and submit requests |

## 🚀 Getting Started

```bash
git clone https://github.com/alonsolemuel/role-based-app.git
cd role-based-app/role-based-app-backend
npm install
npm run dev
```

Then open http://localhost:3000
