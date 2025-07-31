class HighlightStatsWindow {
    constructor() {
        this.element = null;
        this.init();
    }

    init() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = 'highlight-stats-window';
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'highlight-stats-close';
        closeBtn.onclick = () => this.hide();
        
        // Create stats container
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'highlight-stats-content';
        
        // Add elements to main container
        this.element.appendChild(closeBtn);
        this.element.appendChild(this.statsContainer);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .highlight-stats-window {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(5px);
                border-radius: 6px;
                padding: 8px 12px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                z-index: 10000;
                font-family: Arial, sans-serif;
                min-width: 80px;
                display: none;
                border: 1px solid rgba(0, 0, 0, 0.1);
                transition: opacity 0.2s ease;
            }
            
            .highlight-stats-close {
                position: absolute;
                top: 2px;
                right: 2px;
                border: none;
                background: none;
                font-size: 14px;
                cursor: pointer;
                color: rgba(0, 0, 0, 0.5);
                padding: 2px 4px;
                line-height: 1;
                border-radius: 4px;
            }
            
            .highlight-stats-close:hover {
                background: rgba(0, 0, 0, 0.05);
                color: rgba(0, 0, 0, 0.8);
            }
            
            .highlight-stats-content {
                margin: 0;
                font-size: 12px;
            }
            
            .highlight-stats-content h4 {
                margin: 0 0 4px 0;
                font-size: 11px;
                color: rgba(0, 0, 0, 0.6);
                font-weight: normal;
            }
            
            .highlight-stat-item {
                display: flex;
                align-items: center;
                margin: 3px 0;
                gap: 6px;
            }
            
            .highlight-stat-color {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            
            .highlight-stat-item span {
                color: rgba(0, 0, 0, 0.8);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(this.element);
        
        // Listen for stats updates
        window.addEventListener('highlightStatsUpdated', (event) => {
            this.updateStats(event.detail);
        });
        
        // Listen for hide event
        window.addEventListener('hideHighlightStats', () => {
            this.hide();
        });
    }
    
    updateStats(stats) {
        if (!stats) return;
        
        this.statsContainer.innerHTML = `
            <h4>Highlights</h4>
            <div class="highlight-stat-item">
                <div class="highlight-stat-color" style="background: #FFEB3B50"></div>
                <span>${stats.topK}</span>
            </div>
            <div class="highlight-stat-item">
                <div class="highlight-stat-color" style="background: #F4433650"></div>
                <span>${stats.bottomK}</span>
            </div>
        `;
        
        this.show();
    }
    
    show() {
        this.element.style.display = 'block';
    }
    
    hide() {
        this.element.style.display = 'none';
    }
}

// Initialize the stats window
const highlightStatsWindow = new HighlightStatsWindow();
