# Archon Marketplace

An open, "Zero-Trust" ecosystem for **Archon Workflows** and **Node Types**. Discover, share, and install production-grade AI agent capabilities with a single command.

![Archon Marketplace Hero](https://raw.githubusercontent.com/archon-community/archon/main/assets/banner.png)

## 🚀 Overview

Archon Marketplace is a fullstack platform designed to solve the discovery and security challenges of agentic workflows. It provides a centralized hub where developers can publish their Archon YAML definitions and users can safely install them into their agents.

### Key Features
- **One-Command Install**: Install any workflow via `archon add <user/repo>`.
- **Zero-Trust Security Pipeline**: Every submitted workflow undergoes multi-stage Static Analysis (SAST) and Sandboxed Dynamic Analysis to prevent command injection and data exfiltration.
- **Unified Sync Architecture**: Automatically indexes workflows from GitHub repositories and local static files.
- **Modern Clean UI**: A high-performance, polished interface built with Vite, Tailwind CSS, and Framer Motion.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) (Monorepo)
- **Frontend**: React (Vite), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Node.js (Express), TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Security**: AST-based Bash/YAML parsing + Docker-based sandboxing

## 📦 Project Structure

```text
archon-marketplace/
├── apps/
│   ├── frontend/     # Vite + React (UI)
│   ├── backend/      # Express API (Authentication & Workflow Management)
│   └── sync-worker/  # Background service for indexing GitHub repos
├── docker-compose.yml # Local Postgres & pgAdmin setup
└── package.json       # Monorepo configuration
```

## 🚦 Getting Started

### Prerequisites
- [Bun](https://bun.sh) installed.
- [Docker](https://www.docker.com/) installed (for local database).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/archon-community/archon-marketplace.git
   cd archon-marketplace
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Start the local database**:
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database**:
   ```bash
   cd apps/backend
   bun x prisma generate
   bun x prisma db push
   ```

5. **Start development mode**:
   From the root directory:
   ```bash
   bun dev
   ```

## 🐳 Docker Deployment

This project is fully containerized and can be deployed using Docker Compose.

### Local Development (With Hot Reloading)
For local development where you want the database to run in Docker but keep the services running on your host machine:
```bash
docker-compose up -d
```
This starts PostgreSQL and pgAdmin.

### Full Stack Deployment (Production-like)
To run the entire stack (Frontend, Backend, Sync Worker, Caddy) in Docker:

1. **Prepare Environment Variables**:
   Create a `.env` file in the root directory (refer to `DEPLOYMENT.md` for required variables).

2. **Start the Production Stack**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

This will:
- Build the multi-stage Docker image for all services.
- Start **Caddy** as a reverse proxy with automatic HTTPS.
- Expose the application on ports 80 and 443.

### Container Security Note
The Backend container requires access to the host's Docker socket (`/var/run/docker.sock`) to perform **Dynamic Analysis** in isolated sandbox containers. This is handled automatically in the `docker-compose.prod.yml` configuration.

## 🔐 Security Scoring

Workflows are assigned a security score (0-100) based on evaluation:
- **Verified Safe (80+)**: Automatically published.
- **Quarantined (50-79)**: Held for manual administrator review.
- **Rejected (< 50)**: Automatically blocked due to critical vulnerabilities.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built for the future of agentic workflows.
