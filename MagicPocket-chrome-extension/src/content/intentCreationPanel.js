// IntentCreationPanel.js - 意图创建UI系统
// 拆分自 networkVisualizationV2.js，负责意图创建和暂存区域管理

class IntentCreationPanel {
    constructor(networkVisualization) {
        this.networkViz = networkVisualization;
        this.container = null;
        this.inputField = null;
        this.submitButton = null;
        this.stagingArea = null;
        this.stagedNodes = new Map(); // nodeId -> DOM element
        this.nodeIdCounter = 10000; // 新节点从高ID开始
        
        console.log('IntentCreationPanel initialized');
    }
    
    // 初始化UI组件
    initialize() {
        this.createPanel();
        this.createStagingArea();
        this.setupEventHandlers();
        this.injectStyles();
        console.log('IntentCreationPanel UI ready');
    }
    
    // 创建主面板
    createPanel() {
        this.container = document.createElement('div');
        this.container.className = 'intent-creation-panel';
        
        this.container.innerHTML = `
            <div class="panel-content">
                <input type="text" 
                       class="intent-input" 
                       placeholder="Enter intent description or leave empty for AI suggestions..." 
                       maxlength="400">
                <button class="intent-submit-btn">
                    <span class="btn-icon">✨</span>
                    <span class="btn-text">Create</span>
                </button>
            </div>
        `;
        
        // 获取输入和按钮元素
        this.inputField = this.container.querySelector('.intent-input');
        this.submitButton = this.container.querySelector('.intent-submit-btn');
        
        // 添加到网络容器
        const networkContainer = document.getElementById('v2NetworkContainer');
        if (networkContainer) {
            networkContainer.appendChild(this.container);
        }
    }
    
    // 创建暂存区域
    createStagingArea() {
        this.stagingArea = document.createElement('div');
        this.stagingArea.className = 'staging-area';
        this.stagingArea.innerHTML = `
            <div class="staging-header">
                <span class="staging-title">💫 Staged Intents</span>
                <span class="staging-subtitle">Drag to main network</span>
            </div>
            <div class="staged-nodes-container">
                <!-- 暂存的节点将在此显示 -->
            </div>
        `;
        
        // 添加到网络容器
        const networkContainer = document.getElementById('v2NetworkContainer');
        if (networkContainer) {
            networkContainer.appendChild(this.stagingArea);
        }
    }
    
    // 设置事件处理器
    setupEventHandlers() {
        // 提交按钮点击
        this.submitButton.addEventListener('click', () => {
            this.handleIntentCreation();
        });
        
        // 输入框回车
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleIntentCreation();
            }
        });
        
        // 输入框状态变化
        this.inputField.addEventListener('input', () => {
            this.updateButtonState();
        });
    }
    
    // 处理意图创建
    handleIntentCreation() {
        const inputText = this.inputField.value.trim();
        
        if (inputText) {
            // 手动模式：创建单个意图节点
            this.createManualIntent(inputText);
        } else {
            // 自动模式：生成多个意图建议
            this.generateAutoIntents();
        }
        
        // 清空输入框
        this.inputField.value = '';
        this.updateButtonState();
    }
    
    // 创建手动意图节点
    createManualIntent(intentText) {
        const nodeId = `staged_${this.nodeIdCounter++}`;
        const stagedNode = this.createStageNode(intentText, nodeId);
        
        this.stagedNodes.set(nodeId, {
            element: stagedNode,
            text: intentText,
            type: 'idle-intent'
        });
        
        // 添加到暂存区域
        const container = this.stagingArea.querySelector('.staged-nodes-container');
        container.appendChild(stagedNode);
        
        // 添加创建动画
        setTimeout(() => {
            stagedNode.classList.add('bubble-animation');
        }, 100);
        
        console.log('Manual intent created:', intentText);
    }
    
    // 生成自动意图建议
    async generateAutoIntents() {
        this.showLoadingAnimation();
        
        try {
            // 模拟异步LLM调用
            const autoIntents = await this.mockIntentGenerator();
            
            // 创建建议的意图节点
            autoIntents.forEach((intent, index) => {
                setTimeout(() => {
                    const nodeId = `staged_${this.nodeIdCounter++}`;
                    const stagedNode = this.createStageNode(intent.text, nodeId);
                    
                    this.stagedNodes.set(nodeId, {
                        element: stagedNode,
                        text: intent.text,
                        type: 'idle-intent',
                        confidence: intent.confidence
                    });
                    
                    const container = this.stagingArea.querySelector('.staged-nodes-container');
                    container.appendChild(stagedNode);
                    
                    // 添加气泡动画
                    setTimeout(() => {
                        stagedNode.classList.add('bubble-animation');
                    }, 100);
                }, index * 200); // 错开显示时间
            });
            
        } catch (error) {
            console.error('Failed to generate auto intents:', error);
        } finally {
            this.hideLoadingAnimation();
        }
    }
    
    // 创建暂存节点
    createStageNode(intentText, nodeId, isRestored = false) {
        // 如果是恢复操作且nodeId为true，生成新的nodeId
        if (isRestored && nodeId === true) {
            nodeId = `staged_${this.nodeIdCounter++}`;
        }
        
        const stagedNode = document.createElement('div');
        stagedNode.className = 'staged-node';
        stagedNode.dataset.nodeId = nodeId;
        stagedNode.draggable = true;
        
        // 截断过长的文本
        const displayText = intentText.length > 50 ? 
                           intentText.substring(0, 47) + '...' : intentText;
        
        stagedNode.innerHTML = `
            <div class="staged-node-content">
                <span class="staged-node-text">${displayText}</span>
                <button class="remove-staged-btn" title="Remove">×</button>
            </div>
        `;
        
        // 拖拽事件
        this.setupStagedNodeDrag(stagedNode);
        
        // 删除按钮事件
        const removeBtn = stagedNode.querySelector('.remove-staged-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeStagedNode(nodeId);
        });
        
        // 如果是恢复操作，直接添加到暂存区并设置映射
        if (isRestored) {
            this.stagedNodes.set(nodeId, {
                element: stagedNode,
                text: intentText,
                type: 'idle-intent'
            });
            
            // 确保暂存区域存在
            this.ensureStagingAreaExists();
            
            // 添加到暂存区域
            const container = this.stagingArea.querySelector('.staged-nodes-container');
            container.appendChild(stagedNode);
            
            // 添加恢复动画
            stagedNode.style.opacity = '0';
            stagedNode.style.transform = 'scale(0.8)';
            setTimeout(() => {
                stagedNode.style.transition = 'all 0.3s ease';
                stagedNode.style.opacity = '1';
                stagedNode.style.transform = 'scale(1)';
                
                // 添加气泡动画
                setTimeout(() => {
                    stagedNode.classList.add('bubble-animation');
                }, 300);
            }, 50);
        }
        
        return stagedNode;
    }
    
    // 确保暂存区域存在
    ensureStagingAreaExists() {
        if (!this.stagingArea || !document.contains(this.stagingArea)) {
            this.createStagingArea();
        }
    }
    
    // 设置暂存节点拖拽
    setupStagedNodeDrag(stagedNode) {
        stagedNode.addEventListener('dragstart', (e) => {
            const nodeId = stagedNode.dataset.nodeId;
            const stagedData = this.stagedNodes.get(nodeId);
            
            e.dataTransfer.setData('text/plain', nodeId);
            e.dataTransfer.effectAllowed = 'move';
            stagedNode.classList.add('dragging');
            
            // 通知网络可视化开始暂存节点拖拽
            if (this.networkViz) {
                this.networkViz.startStagedNodeDrag(nodeId, stagedData);
            }
            
            console.log('Drag started for staged node:', nodeId);
        });
        
        stagedNode.addEventListener('dragend', () => {
            stagedNode.classList.remove('dragging');
            
            // 通知网络可视化结束暂存节点拖拽
            if (this.networkViz) {
                this.networkViz.endStagedNodeDrag();
            }
            
            console.log('Drag ended for staged node');
        });
    }
    
    // 删除暂存节点
    removeStagedNode(nodeId) {
        const stagedData = this.stagedNodes.get(nodeId);
        if (stagedData) {
            stagedData.element.remove();
            this.stagedNodes.delete(nodeId);
            console.log('Staged node removed:', nodeId);
        }
    }
    
    // 模拟LLM意图生成器
    async mockIntentGenerator() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const templates = [
                    "Analyze data patterns",
                    "Generate comprehensive report",
                    "Optimize workflow process",
                    "Review content quality",
                    "Plan strategic activities"
                ];
                
                const intents = templates
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3)
                    .map(intent => ({
                        text: intent,
                        confidence: Math.random() * 0.4 + 0.6,
                        type: 'idle-intent'
                    }));
                
                resolve(intents);
            }, 1500); // 模拟加载时间
        });
    }
    
    // 显示加载动画
    showLoadingAnimation() {
        this.submitButton.classList.add('loading');
        this.submitButton.innerHTML = `
            <span class="loading-spinner"></span>
            <span class="btn-text">Generating...</span>
        `;
        this.submitButton.disabled = true;
        
        // 添加光晕动画到整个面板
        this.container.classList.add('loading-glow');
        
        // 在暂存区域显示等待提示
        this.showStagingLoadingState();
    }
    
    // 隐藏加载动画
    hideLoadingAnimation() {
        this.submitButton.classList.remove('loading');
        this.submitButton.innerHTML = `
            <span class="btn-icon">✨</span>
            <span class="btn-text">Create</span>
        `;
        this.submitButton.disabled = false;
        
        // 移除光晕动画
        this.container.classList.remove('loading-glow');
        
        // 隐藏暂存区域的加载状态
        this.hideStagingLoadingState();
    }
    
    // 显示暂存区域加载状态
    showStagingLoadingState() {
        const container = this.stagingArea.querySelector('.staged-nodes-container');
        
        // 创建加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'staging-loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="ai-thinking-animation">
                <div class="thinking-dots">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
                <div class="thinking-text">AI is generating intent suggestions...</div>
            </div>
        `;
        
        container.appendChild(loadingIndicator);
    }
    
    // 隐藏暂存区域加载状态
    hideStagingLoadingState() {
        const loadingIndicator = this.stagingArea.querySelector('.staging-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
    
    // 更新按钮状态
    updateButtonState() {
        const hasInput = this.inputField.value.trim().length > 0;
        const text = this.submitButton.querySelector('.btn-text');
        
        if (hasInput) {
            text.textContent = 'Create';
        } else {
            text.textContent = 'Generate';
        }
    }
    
    // 注入样式
    injectStyles() {
        const styleId = 'intent-creation-panel-styles';
        if (document.getElementById(styleId)) return;
        
        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .intent-creation-panel {
                position: absolute;
                top: 20px;
                left: 20px;
                background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,249,250,0.9));
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
                z-index: 10001;
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.2);
                transition: all 0.3s ease;
            }
            
            .intent-creation-panel:hover {
                box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .panel-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .intent-input {
                width: 220px;
                padding: 12px 16px;
                border: 2px solid rgba(116, 185, 255, 0.3);
                border-radius: 24px;
                font-size: 14px;
                background: rgba(255,255,255,0.8);
                transition: all 0.3s ease;
                outline: none;
            }
            
            .intent-input:focus {
                border-color: #74b9ff;
                box-shadow: 0 0 0 3px rgba(116, 185, 255, 0.1);
                background: rgba(255,255,255,1);
            }
            
            .intent-input::placeholder {
                color: #999;
                font-style: italic;
                font-size: 12px;
            }
            
            .intent-submit-btn {
                padding: 12px 20px;
                background: linear-gradient(135deg, #74b9ff, #0984e3);
                color: white;
                border: none;
                border-radius: 24px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(116, 185, 255, 0.3);
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                font-weight: 500;
                min-width: 100px;
                justify-content: center;
            }
            
            .intent-submit-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(116, 185, 255, 0.4);
            }
            
            .intent-submit-btn:active {
                transform: translateY(0);
            }
            
            .intent-submit-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                transform: none;
            }
            
            .intent-submit-btn.loading {
                background: linear-gradient(135deg, #a29bfe, #6c5ce7);
            }
            
            .loading-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .staging-area {
                position: absolute;
                top: 100px;
                left: 20px;
                width: 280px;
                max-height: 320px;
                background: linear-gradient(135deg, rgba(248, 249, 250, 0.95), rgba(255, 255, 255, 0.9));
                border-radius: 20px;
                padding: 16px;
                overflow-y: auto;
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.3);
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                z-index: 10001;
                transition: all 0.3s ease;
            }
            
            .staging-header {
                display: flex;
                flex-direction: column;
                margin-bottom: 12px;
                text-align: center;
            }
            
            .staging-title {
                font-size: 14px;
                font-weight: 600;
                color: #333;
                margin-bottom: 2px;
            }
            
            .staging-subtitle {
                font-size: 11px;
                color: #666;
                font-style: italic;
            }
            
            .staged-nodes-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .staged-node {
                display: block;
                background: linear-gradient(135deg, #ff7675, #74b9ff);
                color: white;
                border-radius: 20px;
                cursor: grab;
                font-size: 13px;
                opacity: 0.9;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                position: relative;
                overflow: hidden;
                user-select: none;
            }
            
            .staged-node:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                opacity: 1;
            }
            
            .staged-node:active {
                cursor: grabbing;
                transform: scale(0.98);
            }
            
            .staged-node.dragging {
                opacity: 0.5;
                transform: rotate(2deg);
            }
            
            .staged-node-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
            }
            
            .staged-node-text {
                flex: 1;
                margin-right: 8px;
                line-height: 1.3;
            }
            
            .remove-staged-btn {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 16px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            
            .remove-staged-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
            }
            
            .staged-node::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                transition: left 0.6s;
            }
            
            .staged-node:hover::before {
                left: 100%;
            }
            
            @keyframes bubble-float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                33% { transform: translateY(-6px) rotate(1deg); }
                66% { transform: translateY(-3px) rotate(-1deg); }
            }
            
            .staged-node.bubble-animation {
                animation: bubble-float 3s ease-in-out infinite;
            }
            
            @keyframes glow-pulse {
                0%, 100% { 
                    box-shadow: 0 0 5px rgba(116, 185, 255, 0.3),
                                0 0 15px rgba(116, 185, 255, 0.2),
                                0 0 25px rgba(116, 185, 255, 0.1);
                }
                50% { 
                    box-shadow: 0 0 10px rgba(116, 185, 255, 0.6),
                                0 0 25px rgba(116, 185, 255, 0.4),
                                0 0 40px rgba(116, 185, 255, 0.3);
                }
            }
            
            .intent-creation-panel.loading-glow {
                animation: glow-pulse 2s ease-in-out infinite;
            }
            
            .staging-loading-indicator {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                background: linear-gradient(135deg, rgba(116, 185, 255, 0.1), rgba(255, 255, 255, 0.1));
                border-radius: 12px;
                margin: 8px 0;
                border: 1px dashed rgba(116, 185, 255, 0.3);
            }
            
            .ai-thinking-animation {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }
            
            .thinking-dots {
                display: flex;
                gap: 6px;
            }
            
            .thinking-dots .dot {
                width: 8px;
                height: 8px;
                background: #74b9ff;
                border-radius: 50%;
                animation: thinking-bounce 1.4s ease-in-out infinite both;
            }
            
            .thinking-dots .dot:nth-child(1) { animation-delay: -0.32s; }
            .thinking-dots .dot:nth-child(2) { animation-delay: -0.16s; }
            .thinking-dots .dot:nth-child(3) { animation-delay: 0s; }
            
            @keyframes thinking-bounce {
                0%, 80%, 100% { 
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                40% { 
                    transform: scale(1.2);
                    opacity: 1;
                }
            }
            
            .thinking-text {
                font-size: 12px;
                color: #666;
                font-style: italic;
                text-align: center;
                animation: text-pulse 2s ease-in-out infinite;
            }
            
            @keyframes text-pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // 清理
    cleanup() {
        if (this.container) {
            this.container.remove();
        }
        if (this.stagingArea) {
            this.stagingArea.remove();
        }
        
        // 清理样式
        const styles = document.getElementById('intent-creation-panel-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('IntentCreationPanel cleaned up');
    }
}

// 导出类以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntentCreationPanel;
}