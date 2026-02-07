# Automated Deployment Setup

This project uses GitHub Actions to automatically deploy to your VPS (45.135.233.197) on every push to the `main` or `master` branch.

## Prerequisites

1. A VPS running Debian 11 with SSH access configured
2. Web server (Nginx/Apache) installed and configured to serve files from `/var/www/html`
3. Proper permissions set for the web directory (user should have write access)

## GitHub Secrets Configuration

Go to your GitHub repository settings → Secrets and variables → Actions → New repository secret.

Add the following secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `SSH_HOST` | IP address or hostname of your VPS | `45.135.233.197` |
| `SSH_USER` | SSH username (e.g., `root`, `deploy`) | `root` |
| `SSH_PRIVATE_KEY` | Private SSH key for authentication | Contents of your private key file |
| `SSH_PORT` | (Optional) SSH port, default is 22 | `22` |

### How to get SSH_PRIVATE_KEY:

On your local machine, if you have an SSH key pair already:
```bash
cat ~/.ssh/id_rsa
```
Copy the entire output including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`.

If you don't have a key pair, generate one:
```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Then add the public key to your VPS:
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub user@45.135.233.197
```

## Server Setup (if not already done)

### 1. Create web directory:
```bash
sudo mkdir -p /var/www/html
sudo chown -R $USER:$USER /var/www/html
sudo chmod -R 755 /var/www/html
```

### 1.5 Install rsync (required for deployment):
```bash
sudo apt update
sudo apt install rsync -y
```

### 2. Install and configure Nginx:
```bash
sudo apt update
sudo apt install nginx -y
```

Create a configuration file at `/etc/nginx/sites-available/your-site`:
```nginx
server {
    listen 80;
    server_name 45.135.233.197;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/your-site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Logging Server Setup

The application includes a Node.js logging server that captures browser console logs and makes them available at `/logs`.

**Install Node.js dependencies on the server:**
```bash
ssh user@45.135.233.197 "cd /var/www/html && npm install --production"
```

**Set up systemd service:**
```bash
# Copy systemd service file
sudo cp /var/www/html/server/log-server.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start the service
sudo systemctl enable log-server
sudo systemctl start log-server

# Check status
sudo systemctl status log-server
```

**Update Nginx configuration** to proxy requests to the logging server. Modify your Nginx site configuration (`/etc/nginx/sites-available/your-site`) to include:

```nginx
location /api/log {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /logs {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /health {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Then restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Verify the logging server is working:**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/logs
```

## How It Works

1. When you push to `main` or `master` branch, GitHub Actions triggers the workflow
2. The workflow checks out the code, installs dependencies, and builds the project
3. The built files (from `dist/` directory) are deployed to `/var/www/html` on your VPS using rsync over SSH
4. The deployment preserves only the latest files (removes old files)

## Manual Deployment

If you need to deploy manually:
```bash
npm run build
rsync -avz --delete dist/ user@45.135.233.197:/var/www/html/
```

## Troubleshooting

### Permission denied errors
Ensure your SSH user has write permissions to `/var/www/html`:
```bash
ssh user@45.135.233.197 "sudo chown -R user:user /var/www/html"
```

### SSH connection issues
Test SSH connection from your local machine:
```bash
ssh -i ~/.ssh/id_rsa user@45.135.233.197
```

### Nginx configuration
Check Nginx error logs:
```bash
ssh user@45.135.233.197 "sudo tail -f /var/log/nginx/error.log"
```

### Rsync errors
If you see "rsync: command not found" errors:
1. Ensure rsync is installed on the server:
```bash
ssh user@45.135.233.197 "sudo apt update && sudo apt install rsync -y"
```
2. The GitHub Actions workflow will attempt to install rsync automatically if missing, but manual installation ensures reliability.

### GitHub Actions logs
Check the workflow run logs in GitHub repository → Actions tab.