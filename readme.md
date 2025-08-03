# IRIS

## Overview
IRIS(Intent Revelation and Interaction System) is a browser-based research system that explores intelligent workflow automation through the Belief-Desire-Intention (BDI) model. It aims to facilitate seamless collaboration between users and AI systems by understanding and processing implicit user intentions through a novel approach to intent revelation and interaction.

## Core Features

### Content Collection
- Smart text selection and preservation
- Webpage screenshot functionality
- Contextual information capture
- User annotation support

### Intent Processing
- Implicit intent extraction
- Hierarchical intent clustering
- Tree-based intent visualization
- Real-time intent updates

### Smart Interaction
- Side panel quick access
- Floating tool window
- Content highlighting
- Cross-page content association

## Technical Architecture

### Frontend (Chrome Extension)
- Content Scripts
- Background Service
- Popup Interface
- Side Panel
- Network Visualization

### Backend (FastAPI)
- Vector Embedding Service
- Intent Clustering Analysis
- RAG (Retrieval-Augmented Generation)
- API Services

## System Requirements

### Frontend Dependencies
- Chrome Browser
- Node.js environment

### Backend Dependencies
- Python 3.8+
- FastAPI
- OpenAI API key
- Required Python packages (see `requirements.txt`)

## Quick Start

### 1. Clone the repository

```shell
git clone https://github.com/jiaqi-xiao/MagicPocket.git
```


### 2. Setup Backend Environment

#### Local Development Setup
```shell
cd Back

# Create conda environment from freeze.yml
conda env create -f freeze.yml

# Activate the environment
conda activate HCIX

# Start the backend server
uvicorn main:app --reload --port 8000
```

#### Linux Server Deployment

1. **Install Dependencies**
```shell
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install conda (if not already installed)
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
source $HOME/miniconda3/bin/activate
```

2. **Setup Project Environment**
```shell
cd Back

# Create conda environment from freeze.yml
conda env create -f freeze.yml

# Activate the environment
conda activate HCIX

# Install additional dependencies if needed
pip install -r requirements.txt
```

3. **Configure Environment Variables**
```shell
# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
EOF
```

4. **Create Startup Script**
```shell
# Create startup script
cat > start_backend.sh << 'EOF'
#!/bin/bash
cd $(dirname $0)
source $HOME/miniconda3/bin/activate
conda activate HCIX
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
echo $! > backend.pid
echo "Backend started with PID: $(cat backend.pid)"
EOF

# Make script executable
chmod +x start_backend.sh
```

5. **Create Stop Script**
```shell
# Create stop script
cat > stop_backend.sh << 'EOF'
#!/bin/bash
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if ps -p $PID > /dev/null; then
        echo "Stopping backend with PID: $PID"
        kill $PID
        rm backend.pid
        echo "Backend stopped"
    else
        echo "Backend process not running"
        rm backend.pid
    fi
else
    echo "No PID file found"
fi
EOF

# Make script executable
chmod +x stop_backend.sh
```

6. **Start the Backend**
```shell
# Start the backend
./start_backend.sh

# Check if it's running
ps aux | grep uvicorn

# View logs
tail -f backend.log
```

7. **Useful Commands**
```shell
# Stop the backend
./stop_backend.sh

# Restart the backend
./stop_backend.sh && sleep 2 && ./start_backend.sh

# Check if backend is running
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if ps -p $PID > /dev/null; then
        echo "Backend is running with PID: $PID"
    else
        echo "Backend is not running"
    fi
else
    echo "Backend is not running"
fi

# View real-time logs
tail -f backend.log

# View recent logs
tail -n 100 backend.log
```

8. **Firewall Configuration (if needed)**
```shell
# Allow port 8000 through firewall
sudo ufw allow 8000

# Check firewall status
sudo ufw status
```
### 3. Setup Frontend (Chrome Extension)
1. Open Chrome extensions page
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   
2. Load the extension
   - Click "Load unpacked"
   - Select the `Front` directory from the project

### 4. Configure the Extension
1. Open extension options
2. Set up required API keys
3. Configure any additional settings

## Development Setup

### Backend Requirements
- Anaconda or Miniconda
- Python 3.10
- FastAPI
- OpenAI API key
- Other dependencies as specified in `freeze.yml`

### Frontend Requirements
- Chrome Browser
- Node.js (for development)


## Production Deployment

### Linux Server Deployment Guide

This section provides detailed instructions for deploying the IRIS backend on a Linux server with proper logging and background process management.

#### Prerequisites
- Ubuntu 18.04+ or similar Linux distribution
- Root/sudo access
- Internet connection for package installation

#### Step-by-Step Deployment

1. **Server Preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y python3 python3-pip python3-venv curl wget git

# Install conda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

2. **Project Setup**
```bash
# Clone repository (if not already done)
git clone https://github.com/jiaqi-xiao/MagicPocket.git
cd MagicPocket/Back

# Create and activate conda environment
conda env create -f freeze.yml
conda activate HCIX

# Install additional dependencies
pip install -r requirements.txt
```

3. **Environment Configuration**
```bash
# Create environment file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
EOF

# Set proper permissions
chmod 600 .env
```

4. **Create Management Scripts**
```bash
# Create startup script
cat > start_backend.sh << 'EOF'
#!/bin/bash
cd $(dirname $0)
source $HOME/miniconda3/bin/activate
conda activate HCIX
nohup uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 > backend.log 2>&1 &
echo $! > backend.pid
echo "Backend started with PID: $(cat backend.pid)"
EOF

# Create stop script
cat > stop_backend.sh << 'EOF'
#!/bin/bash
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if ps -p $PID > /dev/null; then
        echo "Stopping backend with PID: $PID"
        kill $PID
        rm backend.pid
        echo "Backend stopped"
    else
        echo "Backend process not running"
        rm backend.pid
    fi
else
    echo "No PID file found"
fi
EOF

# Create status script
cat > status_backend.sh << 'EOF'
#!/bin/bash
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if ps -p $PID > /dev/null; then
        echo "Backend is running with PID: $PID"
        echo "Process details:"
        ps -p $PID -o pid,ppid,cmd,etime
    else
        echo "Backend is not running (stale PID file)"
        rm backend.pid
    fi
else
    echo "Backend is not running"
fi
EOF

# Make scripts executable
chmod +x start_backend.sh stop_backend.sh status_backend.sh
```

5. **Setup Logging**
```bash
# Create log rotation configuration
sudo tee /etc/logrotate.d/iris-backend << EOF
$(pwd)/backend.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        # Restart backend after log rotation
        if [ -f backend.pid ]; then
            PID=\$(cat backend.pid)
            if ps -p \$PID > /dev/null; then
                kill -HUP \$PID
            fi
        fi
    endscript
}
EOF
```

6. **Start the Backend**
```bash
# Start the backend
./start_backend.sh

# Check status
./status_backend.sh

# View logs
tail -f backend.log
```

7. **Firewall and Security**
```bash
# Configure firewall
sudo ufw allow 8000/tcp
sudo ufw enable

# Verify firewall status
sudo ufw status
```

#### Monitoring and Maintenance

**View Logs:**
```bash
# Real-time logs
tail -f backend.log

# Recent logs
tail -n 100 backend.log

# Search for errors
grep -i error backend.log

# Search for specific patterns
grep "API call" backend.log
```

**Service Management:**
```bash
# Start the backend
./start_backend.sh

# Stop the backend
./stop_backend.sh

# Restart the backend
./stop_backend.sh && sleep 2 && ./start_backend.sh

# Check service status
./status_backend.sh

# Check if port is listening
netstat -tlnp | grep 8000
```

**Troubleshooting:**
```bash
# Check if backend is running
./status_backend.sh

# Check process details
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    ps -p $PID -o pid,ppid,cmd,etime,pcpu,pmem
fi

# Check for port conflicts
lsof -i :8000

# Test API endpoint
curl http://localhost:8000/

# Check recent errors
tail -n 50 backend.log | grep -i error
```

#### Performance Optimization

For production environments, consider:

1. **Using Gunicorn with Uvicorn workers:**
```bash
# Install gunicorn
pip install gunicorn

# Update start_backend.sh script
cat > start_backend.sh << 'EOF'
#!/bin/bash
cd $(dirname $0)
source $HOME/miniconda3/bin/activate
conda activate HCIX
nohup gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 > backend.log 2>&1 &
echo $! > backend.pid
echo "Backend started with PID: $(cat backend.pid)"
EOF
```

2. **Setting up Nginx as reverse proxy:**
```bash
sudo apt install nginx
sudo tee /etc/nginx/sites-available/iris-backend << EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/iris-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

3. **Auto-restart script for reliability:**
```bash
# Create auto-restart script
cat > auto_restart.sh << 'EOF'
#!/bin/bash
while true; do
    if [ ! -f backend.pid ] || ! ps -p $(cat backend.pid) > /dev/null; then
        echo "$(date): Backend not running, restarting..."
        ./start_backend.sh
    fi
    sleep 30
done
EOF

chmod +x auto_restart.sh

# Run auto-restart in background
nohup ./auto_restart.sh > auto_restart.log 2>&1 &
```

## Future Work
- [ ] Advanced intent extraction algorithms
- [ ] Enhanced visualization techniques

## License
This project is licensed under the MIT License