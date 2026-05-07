# VPS Deployment Guide

This guide outlines the steps required to manually prepare your VPS for automated deployments of the Archon Marketplace.

## 1. Prerequisites on VPS

### Install Docker & Docker Compose
Follow the official [Docker installation guide](https://docs.docker.com/engine/install/) for your Linux distribution.

### Setup SSH Access
1. Generate an SSH key pair on your local machine (if you haven't already).
2. Add your public key to `~/.ssh/authorized_keys` on the VPS.
3. Ensure the private key is added to your GitHub repository secrets as `VPS_SSH_KEY`.

### Initial Repository Setup
On the VPS, clone the repository into your home directory:
```bash
cd ~
git clone https://github.com/your-username/archon-marketplace.git
cd archon-marketplace
```

## 2. GitHub Secrets

Add the following secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret Name | Description |
| :--- | :--- |
| `VPS_IP` | The public IP address of your VPS. |
| `VPS_USER` | The SSH username (e.g., `ubuntu` or `root`). |
| `VPS_SSH_KEY` | Your private SSH key. |
| `DOMAIN` | Your domain name (e.g., `marketplace.archon.com`). |
| `DATABASE_URL` | Managed PostgreSQL connection string. |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret. |
| `SESSION_SECRET` | A random string for session encryption. |
| `GITHUB_TOKEN` | A personal access token for the sync worker. |

## 3. DNS Configuration

Point your domain's `A` record to your VPS IP address. Caddy will automatically handle SSL certificate provisioning once the domain points to the server.

## 4. Troubleshooting

- **Logs:** View logs on the VPS using `docker compose -f docker-compose.prod.yml logs -f`.
- **Caddy:** If SSL fails, ensure ports 80 and 443 are open in your VPS firewall (e.g., `ufw allow 80/tcp`, `ufw allow 443/tcp`).
