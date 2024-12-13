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
```shell
cd Back

# Create conda environment from freeze.yml
conda env create -f freeze.yml

# Activate the environment
conda activate HCIX

# Start the backend server
uvicorn main:app --reload --port 8000

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


## Future Work
- [ ] Advanced intent extraction algorithms
- [ ] Enhanced visualization techniques

## License
This project is licensed under the MIT License