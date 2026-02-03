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

### GitHub Actions logs
Check the workflow run logs in GitHub repository → Actions tab.