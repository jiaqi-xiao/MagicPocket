// 网络图配置和状态管理
class NetworkManager {
    static activeNodeMenu = false;  // 跟踪节点菜单状态
    static immutableIntents = new Set();  // 存储所有 immutable 的意图名称
    static hierarchicalDirection = 'LR';  // 存储层级布局方向配置
    
    // 节点类型常量
    static NodeTypes = {
        HIGH_INTENT: 'high-intent',    // 高级意图节点 - 红色
        LOW_INTENT: 'low-intent',      // 低级意图节点 - 蓝色
        RECORD: 'record'               // 记录节点 - 青色
    };

    constructor(intentTree, containerArea = null, mode = 'standalone', layout = 'force') {
        this.intentTree = intentTree;
        this.containerArea = containerArea;
        this.displayMode = mode;
        this.layout = layout;
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();
        this.nodeStates = new Map();
        this.network = null;
        this.container = null;
        this.visContainer = null;
        this.nodeMergeManager = null; // 节点合并管理器

        // 从初始意图树中收集 immutable 意图 - 支持多级意图结构
        if (intentTree && intentTree.item) {
            Object.entries(intentTree.item).forEach(([intentName, intentData]) => {
                // 检查高级意图的确认状态
                if (intentData && intentData.confirmed) {
                    NetworkManager.immutableIntents.add(intentName);
                }
                
                // 检查低级意图的确认状态
                if (intentData && intentData.child && Array.isArray(intentData.child)) {
                    intentData.child.forEach(childIntent => {
                        if (childIntent.intent && childIntent.confirmed) {
                            NetworkManager.immutableIntents.add(childIntent.intent);
                        }
                    });
                }
            });
        }
    }

    // 初始化网络容器
    initContainer() {
        this.container = document.createElement("div");
        this.container.id = "networkVisualizationContainer";

        switch (this.displayMode) {
            case 'standalone':
                this.setupStandaloneContainer();
                break;
            case 'integrated':
                this.setupIntegratedContainer();
                break;
            case 'sidepanel':
                this.setupSidePanelContainer();
                break;
            default:
                this.setupStandaloneContainer();
        }

        if (this.displayMode !== 'sidepanel') {
            this.addCloseButton();
        }
        this.setupVisContainer();
    }

    setupStandaloneContainer() {
        Object.assign(this.container.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80vw",
            height: "80vh",
            backgroundColor: "white",
            padding: "20px",
            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            zIndex: "10000",
            borderRadius: "8px"
        });
        document.body.appendChild(this.container);
    }

    setupIntegratedContainer() {
        Object.assign(this.container.style, {
            position: "relative",
            width: "30vw",
            minWidth: "320px",
            height: "70vh",
            backgroundColor: "white",
            padding: "20px",
            boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
            borderRadius: "8px",
            marginRight: "12px",
            display: "inline-block",
            verticalAlign: "top"
        });
    
        // Find records container
        const recordsList = this.containerArea.querySelector(".mp-floating-main-container");
        if (recordsList) {
            // 保持原始容器宽度
            recordsList.style.width = "40vw";
            recordsList.style.minWidth = "360px";
            recordsList.style.flexShrink = "0"; // 防止容器被压缩
            
            // Add network container as first child
            this.containerArea.insertBefore(this.container, this.containerArea.firstChild);
        } else {
            this.containerArea.appendChild(this.container);
        }
    
        // 更新容器区域样式
        Object.assign(this.containerArea.style, {
            display: "flex",
            flexDirection: "row", 
            alignItems: "flex-start",
            justifyContent: "flex-start",
            width: "calc(70vw + 60px)", // 调整总宽度
            gap: "2px",
            maxWidth: "100vw", // 防止溢出屏幕
            overflowX: "auto" // 允许在需要时横向滚动
        });

        // 添加 with-network 类以触发额外的样式
        this.containerArea.classList.add('with-network');
    }

    setupSidePanelContainer() {
        Object.assign(this.container.style, {
            position: "relative",
            width: "100%",
            height: "100%",
            backgroundColor: "white",
            borderRadius: "12px",
            overflow: "hidden"
        });

        if (this.containerArea) {
            this.containerArea.innerHTML = ''; // 清除加载状态
            this.containerArea.appendChild(this.container);
        }
    }

    // 初始化网络节点
    initializeNodes() {
        if (!this.intentTree || !this.intentTree.item) {
            console.warn('No valid intent tree data for visualization');
            return;
        }

        try {
            const networkData = this.transformIntentTreeToNetwork(this.intentTree);
            this.nodes.add(networkData.nodes);
            this.edges.add(networkData.edges);

        } catch (error) {
            console.error('Error initializing nodes:', error);
            throw error;
        }
    }

    transformIntentTreeToNetwork(intentTree) {
        const nodes = [];
        const edges = [];
        let nodeId = 1;

        // 验证数据结构
        if (!intentTree || !intentTree.item) {
            console.error('Invalid intent tree structure:', intentTree);
            throw new Error('Invalid intent tree structure');
        }

        // 递归处理意图节点的函数 - 支持两级意图层级
        const processIntentNode = (parentId, nodeData, nodeName, level, nodeType = NetworkManager.NodeTypes.HIGH_INTENT) => {
            const currentNodeId = `${nodeType}_${nodeId++}`;
            // 修复节点状态判断逻辑 - 优先检查nodeStates，其次检查immutableIntents
            let isImmutable = false;
            
            // 先检查是否已存在节点状态记录
            const existingNodeId = Array.from(this.nodeStates.entries())
                .find(([id, state]) => {
                    const existingNode = this.nodes.get(id);
                    return existingNode && existingNode.originalLabel === nodeName;
                });
            
            if (existingNodeId && existingNodeId[1] !== undefined) {
                isImmutable = existingNodeId[1];
            } else {
                // 检查是否在immutable集合中或者intentData中有confirmed标记
                isImmutable = NetworkManager.immutableIntents.has(nodeName) || 
                             (nodeData && nodeData.confirmed === true);
            }
            
            // 添加当前意图节点
            nodes.push({
                id: currentNodeId,
                label: this.wrapLabel(nodeName, nodeType === NetworkManager.NodeTypes.HIGH_INTENT ? 20 : 15, nodeType),
                originalLabel: nodeName,
                type: nodeType,
                color: this.getNodeColor(nodeType),
                size: this.getNodeSize(nodeType),
                level: this.layout === 'hierarchical' ? level : undefined,
                opacity: isImmutable ? 1 : 0.3
            });
            
            // 设置节点状态
            this.nodeStates.set(currentNodeId, isImmutable);

            // 连接父节点到当前节点
            if (parentId) {
                edges.push({
                    from: parentId,
                    to: currentNodeId,
                    arrows: 'to',
                    dashes: !isImmutable
                });
            }

            // 检查是否有子节点 - 支持三层级结构
            if (nodeData.child && Array.isArray(nodeData.child) && nodeData.child.length > 0) {
                // 检查子节点是否是意图节点（有intent属性）
                const hasChildIntents = nodeData.child.some(child => child.intent);
                
                if (hasChildIntents) {
                    // 如果当前是高级意图，子节点应该是低级意图
                    const childNodeType = nodeType === NetworkManager.NodeTypes.HIGH_INTENT ? 
                        NetworkManager.NodeTypes.LOW_INTENT : NetworkManager.NodeTypes.LOW_INTENT;
                    
                    // 递归处理子意图节点
                    nodeData.child.forEach(childNode => {
                        if (childNode.intent) {
                            processIntentNode(currentNodeId, childNode, childNode.intent, level + 1, childNodeType);
                        }
                    });
                } else {
                    // 子节点是记录，直接显示
                    this.processRecordNodes(nodeData.child, currentNodeId, level + 1, isImmutable);
                }
            } else if (nodeData.group && Array.isArray(nodeData.group)) {
                // 没有子节点但有group，显示group中的记录
                this.processRecordNodes(nodeData.group, currentNodeId, level + 1, isImmutable);
            } else {
                console.warn(`No valid child or group data found for intent "${nodeName}"`, nodeData);
            }
        };
        
        // 处理记录节点的辅助函数
        this.processRecordNodes = (records, parentId, level, isImmutable) => {
            records.forEach(record => {
                const recordId = `record_${nodeId++}`;
                const recordNode = {
                    id: recordId,
                    label: this.wrapLabel(this.truncateText(record.content || record.text || record.description || 'No content', 30), 12, NetworkManager.NodeTypes.RECORD),
                    type: NetworkManager.NodeTypes.RECORD,
                    color: this.getNodeColor(NetworkManager.NodeTypes.RECORD),
                    size: this.getNodeSize(NetworkManager.NodeTypes.RECORD),
                    level: this.layout === 'hierarchical' ? level : undefined,
                    opacity: isImmutable ? 1 : 0.3,
                    title: this.formatRecordTooltip({
                        content: record.content || record.text || record.description || 'No content',
                        context: record.context || '',
                        comment: record.comment || ''
                    })
                };
                nodes.push(recordNode);
                this.nodeStates.set(recordId, isImmutable);

                edges.push({
                    from: parentId,
                    to: recordId,
                    arrows: 'to',
                    dashes: !isImmutable
                });
            });
        };

        // 遍历每个意图组 - 直接创建高级意图节点，无根节点
        Object.entries(intentTree.item).forEach(([intentName, intentData]) => {
            // Skip intents that start with 'remaining_intent_'
            if (intentName.startsWith('remaining_intent_')) {
                return;
            }

            // 处理每个高级意图节点（原来的一级意图现在变为高级意图）
            processIntentNode(null, intentData, intentName, 0, NetworkManager.NodeTypes.HIGH_INTENT);
        });

        console.log('Final network structure:', {
            nodes: nodes,
            edges: edges,
            nodeStates: Array.from(this.nodeStates.entries())
        });
        return { nodes, edges };
    }

    wrapLabelVertical(text) {
        if (!text) return 'No content';
        
        const lines = [];
        let currentSegment = '';
        
        // 遍历字符串中的每个字符
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            
            if (char === ' ') {
                // 如果是空格，处理当前积累的片段
                if (currentSegment) {
                    lines.push(currentSegment);
                    currentSegment = '';
                }
            } else if (/[\u4e00-\u9fa5]/.test(char)) {
                // 如果当前字符是中文
                if (currentSegment) {
                    // 如果之前有积累的英文片段，先添加
                    lines.push(currentSegment);
                    currentSegment = '';
                }
                // 中文字符单独成行
                lines.push(char);
            } else {
                // 英文字符，累积到当前片段
                currentSegment += char;
                
                // 如果下一个字符是中文，当前片段结束
                if (nextChar && /[\u4e00-\u9fa5]/.test(nextChar)) {
                    lines.push(currentSegment);
                    currentSegment = '';
                }
            }
        }
        
        // 处理最后可能剩余的片段
        if (currentSegment) {
            lines.push(currentSegment);
        }
        
        return lines.join('\n');
    }

    wrapLabel(text, maxLength, nodeType) {
        if (!text) return 'No content';
        
        // Split text into words
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        // Process each word
        for (const word of words) {
            // If adding this word would exceed maxLength
            if ((currentLine + ' ' + word).length > maxLength) {
                // If current line is not empty, push it and start new line
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    // If word itself is too long, truncate it
                    currentLine = word.substring(0, maxLength - 3) + '...';
                }
            } else {
                // Add word to current line
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        
        // Add the last line if not empty
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // For record nodes, limit to max 2 lines and add ellipsis if needed
        if (nodeType !== 'intent' && lines.length > 2) {
            lines.length = 2;
            lines[1] = lines[1].substring(0, maxLength - 3) + '...';
        }
        
        // Join lines with newline character
        return lines.join('\n');
    }

    // 辅助方法：截断文本
    truncateText(text, maxLength) {
        if (!text) {
            console.warn('Empty or null text received');
            return 'No content';
        }
        const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        return truncated;
    }

    // 辅助方法：格式化记录的悬停提示
    formatRecordTooltip(record) {
        const tooltipContainer = document.createElement('div');
        
        // 获取network容器的大小
        const networkContainer = this.container;
        const containerRect = networkContainer.getBoundingClientRect();
        const maxHeight = Math.min(300, containerRect.height * 0.8); // 最大高度为容器高度的80%
        const maxWidth = Math.min(400, containerRect.width * 0.8);  // 最大宽度为容器宽度的80%

        Object.assign(tooltipContainer.style, {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            padding: '12px',
            maxWidth: maxWidth + 'px',
            maxHeight: maxHeight + 'px',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative'
        });

        // 添加滚动事件处理
        let isScrolling = false;
        tooltipContainer.addEventListener('wheel', (e) => {
            const canScroll = tooltipContainer.scrollHeight > tooltipContainer.clientHeight;
            if (canScroll) {
                e.stopPropagation();
                e.preventDefault();
                tooltipContainer.scrollTop += e.deltaY;
                
                // 标记正在滚动
                isScrolling = true;
                clearTimeout(this._scrollTimeout);
                this._scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                }, 150);

                // 当正在滚动时临时禁用network的缩放
                if (this.network) {
                    this.network.setOptions({
                        interaction: {
                            zoomView: !isScrolling
                        }
                    });
                }
            }
        }, { passive: false });

        // 创建并添加内容部分
        if (record.content) {
            const contentSection = this.createTooltipSection('Content', record.content, '#2196F3');
            tooltipContainer.appendChild(contentSection);
        }

        // 创建并添加评论部分
        if (record.comment) {
            const commentSection = this.createTooltipSection('Comment', record.comment, '#FF9800');
            tooltipContainer.appendChild(commentSection);
        }

        return tooltipContainer;
    }

    // 辅助方法：格式化记录的悬停提示部分
    createTooltipSection(title, content, color) {
        const section = document.createElement('div');
        Object.assign(section.style, {
            marginBottom: title === 'Comment' ? '0' : '16px'
        });

        // 创建标题
        const titleElement = document.createElement('div');
        Object.assign(titleElement.style, {
            fontWeight: '600',
            color: color,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            position: 'sticky',
            top: '0',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            paddingBottom: '4px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
        });

        // 添加图标
        const icon = document.createElement('span');
        icon.textContent = title === 'Content' ? '📝' : '💭';
        icon.style.fontSize = '14px';
        titleElement.appendChild(icon);

        // 添加标题文本
        const titleText = document.createElement('span');
        titleText.textContent = title;
        titleElement.appendChild(titleText);

        // 创建内容
        const contentElement = document.createElement('div');
        Object.assign(contentElement.style, {
            color: '#666',
            fontSize: '13px',
            lineHeight: '1.6',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderRadius: '6px',
            whiteSpace: 'pre-wrap',  // 保留换行和空格
            wordBreak: 'break-word'  // 长单词换行
        });
        contentElement.textContent = content;

        section.appendChild(titleElement);
        section.appendChild(contentElement);

        return section;
    }

    // 获取节点颜色
    getNodeColor(type) {
        const colors = {
            root: { background: '#ff7675', border: '#d63031' },                    // 根节点 - 红色系 (保留兼容性)
            intent: { background: '#74b9ff', border: '#0984e3' },                 // 意图节点 - 蓝色系 (保留兼容性)
            [NetworkManager.NodeTypes.HIGH_INTENT]: { background: '#ff7675', border: '#d63031' },  // 高级意图 - 红色系
            [NetworkManager.NodeTypes.LOW_INTENT]: { background: '#74b9ff', border: '#0984e3' },   // 低级意图 - 蓝色系
            [NetworkManager.NodeTypes.RECORD]: { background: '#81ecec', border: '#00cec9' }        // 记录节点 - 青色系
        };
        return colors[type] || { background: '#a29bfe', border: '#6c5ce7' };
    }

    // 获取节点大小
    getNodeSize(type) {
        const sizes = {
            root: 30,                                              // 根节点 (保留兼容性)
            intent: 15,                                            // 意图节点 (保留兼容性)
            [NetworkManager.NodeTypes.HIGH_INTENT]: 20,           // 高级意图 - 比低级稍大
            [NetworkManager.NodeTypes.LOW_INTENT]: 15,            // 低级意图 - 与原intent相同
            [NetworkManager.NodeTypes.RECORD]: 10                 // 记录节点
        };
        return sizes[type] || 10;
    }

    // 更新节点状态
    updateNodeState(nodeId, confirmed) {
        console.log(`updateNodeState called: nodeId=${nodeId}, confirmed=${confirmed}`);
        this.nodeStates.set(nodeId, confirmed);
        
        // 如果是意图节点且被确认，添加到 immutable 集合中并保存状态到存储
        const node = this.nodes.get(nodeId);
        console.log(`Node details: type=${node?.type}, originalLabel=${node?.originalLabel}, label=${node?.label}`);
        
        if (node && (node.type === 'intent' || 
                    node.type === NetworkManager.NodeTypes.HIGH_INTENT || 
                    node.type === NetworkManager.NodeTypes.LOW_INTENT)) {
            const intentName = node.originalLabel || node.label;
            console.log(`Processing intent node: ${intentName}, confirmed=${confirmed}`);
            
            if (confirmed) {
                NetworkManager.immutableIntents.add(intentName);
                // 保存确认状态到意图树数据
                this.saveNodeConfirmationState(intentName, true);
            } else {
                NetworkManager.immutableIntents.delete(intentName);
                // 保存确认状态到意图树数据
                this.saveNodeConfirmationState(intentName, false);
            }
        } else {
            console.log(`Node is not an intent node or node not found`);
        }
        
        this.nodes.update({
            id: nodeId,
            opacity: confirmed ? 1 : 0.3
        });

        this.updateEdgesForNode(nodeId);
    }

    // 保存节点确认状态到意图树数据
    async saveNodeConfirmationState(intentName, confirmed) {
        try {
            console.log(`saveNodeConfirmationState called: ${intentName} = ${confirmed}`);
            
            if (!this.intentTree || !this.intentTree.item) {
                console.log(`Intent tree not available`);
                return;
            }
            
            let intentLocation = null;
            
            // 首先检查是否是高级意图（在 intentTree.item 的顶层）
            if (this.intentTree.item[intentName]) {
                intentLocation = { type: 'high-level', ref: this.intentTree.item[intentName] };
                console.log(`Found as high-level intent: ${intentName}`);
            } else {
                // 在高级意图的子节点中查找低级意图
                for (const [parentIntentName, parentIntentData] of Object.entries(this.intentTree.item)) {
                    if (parentIntentData.child && Array.isArray(parentIntentData.child)) {
                        const childIntent = parentIntentData.child.find(child => 
                            child.intent === intentName
                        );
                        if (childIntent) {
                            intentLocation = { type: 'low-level', ref: childIntent, parent: parentIntentName };
                            console.log(`Found as low-level intent under ${parentIntentName}: ${intentName}`);
                            break;
                        }
                    }
                }
            }
            
            if (intentLocation) {
                // 设置确认状态
                intentLocation.ref.confirmed = confirmed;
                console.log(`Intent tree updated for ${intentName} (${intentLocation.type})`);
                
                // 持久化到存储
                if (typeof saveIntentTree === 'function') {
                    await saveIntentTree(this.intentTree);
                    console.log(`Node confirmation state saved: ${intentName} = ${confirmed}`);
                } else {
                    console.log(`saveIntentTree function not available`);
                }
            } else {
                console.log(`Intent not found in tree: ${intentName}`);
                console.log(`Available high-level intents:`, Object.keys(this.intentTree.item || {}));
            }
        } catch (error) {
            console.error('Error saving node confirmation state:', error);
        }
    }

    // 更新节点相关的边
    updateEdgesForNode(nodeId) {
        this.edges.forEach(edge => {
            if (edge.from === nodeId || edge.to === nodeId) {
                const fromConfirmed = this.nodeStates.get(edge.from);
                const toConfirmed = this.nodeStates.get(edge.to);
                this.edges.update({
                    id: edge.id,
                    dashes: !(fromConfirmed && toConfirmed)
                });
            }
        });
    }

    // 创建节点菜单
    createNodeMenu(nodeId) {
        // 如果已经存在菜单，先移除它
        const existingMenu = document.getElementById('nodeMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // 设置菜单激活状态
        NetworkManager.activeNodeMenu = true;
        
        const menu = document.createElement('div');
        const node = this.nodes.get(nodeId);
        
        // 记录菜单打开日志
        window.Logger.log(window.LogCategory.UI, 'network_node_menu_opened', {
            node_id: nodeId,
            type: node.type,
            label: node.label
        });
        
        // 获取节点的DOM位置
        const nodePosition = this.network.getPositions([nodeId])[nodeId];
        const domPosition = this.network.canvasToDOM(nodePosition);
        
        // 获取容器的位置信息
        const containerRect = this.container.getBoundingClientRect();
        
        // 计算菜单的实际位置，需要加上容器的偏移
        const menuX = domPosition.x + containerRect.left;
        const menuY = domPosition.y + containerRect.top;
        
        // 获取节点的大小信息
        const nodeSize = node.size || 16;
        
        this.setupNodeMenu(menu, menuX, menuY);
        this.addMenuItems(menu, nodeId);
        document.body.appendChild(menu);
        
        // 确保菜单不会超出视窗并居中对齐
        this.adjustMenuPosition(menu, menuX);
        
        this.setupMenuCloseEvent(menu);
    }

    setupNodeMenu(menu, x, y) {
        menu.id = 'nodeMenu';
        Object.assign(menu.style, {
            position: 'fixed',
            transform: 'translate(-50%, -100%)',
            left: x + 'px',
            top: y + 'px',
            backgroundColor: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10001',
            minWidth: '150px',
            backdropFilter: 'blur(8px)',
            transition: 'opacity 0.2s ease-in-out'
        });
    }

    adjustMenuPosition(menu, nodeX) {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 检查上边界
        if (rect.top < 0) {
            // 如果上方空间不足，则显示在节点下方
            menu.style.top = (parseInt(menu.style.top) + rect.height + 30) + 'px';
        }
        
        // 检查左右边界，保持水平居中但不超出屏幕
        const halfWidth = rect.width / 2;
        if (nodeX - halfWidth < 0) {
            menu.style.left = halfWidth + 'px';
        } else if (nodeX + halfWidth > viewportWidth) {
            menu.style.left = (viewportWidth - halfWidth) + 'px';
        }
    }

    // 添加菜单项
    addMenuItems(menu, nodeId) {
        const node = this.nodes.get(nodeId);
        
        // 如果是高级意图节点，添加"添加子意图"按钮
        if (node.type === NetworkManager.NodeTypes.HIGH_INTENT) {
            const addChildBtn = this.createMenuItem(
                nodeId,
                'Add Child Intent',
                '#27ae60',
                '#2ecc71'
            );
            menu.appendChild(addChildBtn);
            this.setupAddChildIntentAction(addChildBtn, nodeId);
        }
        
        // 如果是意图节点（高级或低级），添加"编辑意图"按钮
        if (node.type === NetworkManager.NodeTypes.HIGH_INTENT || 
            node.type === NetworkManager.NodeTypes.LOW_INTENT || 
            node.type === 'intent') {
            const editIntentBtn = this.createMenuItem(
                nodeId,
                'Edit Intent',
                '#2d3436',
                '#0984e3'
            );
            menu.appendChild(editIntentBtn);
            this.setupEditIntentAction(editIntentBtn, nodeId);
        }

        const toggleBtn = this.createMenuItem(
            nodeId,
            this.nodeStates.get(nodeId) ? 'Set as Pending' : 'Set as Confirmed',
            '#2d3436',
            '#0984e3'
        );
        const deleteBtn = this.createMenuItem(nodeId, 'Delete Node', '#e74c3c', '#d63031');

        menu.appendChild(toggleBtn);
        menu.appendChild(deleteBtn);
    }

    // 创建菜单项
    createMenuItem(nodeId, text, color, hoverColor) {
        const item = document.createElement('div');
        Object.assign(item.style, {
            padding: '8px 16px',
            cursor: 'pointer',
            color: color,
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            userSelect: 'none'
        });
        
        // 添加图标和文本的容器
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.gap = '8px';
        
        // 根据操作类型添加不同的图标
        const icon = document.createElement('span');
        icon.style.fontSize = '16px';
        if (text.includes('Delete')) {
            icon.innerHTML = '';
        } else if (text.includes('Add')) {
            icon.innerHTML = '';
        } else if (text.includes('Edit')) {
            icon.innerHTML = '';
        } else {
            icon.innerHTML = '';
        }
        
        content.appendChild(icon);
        content.appendChild(document.createTextNode(text));
        item.appendChild(content);

        this.setupMenuItemEvents(item, color, hoverColor);
        this.setupMenuItemAction(item, nodeId, text);

        return item;
    }

    // 设置菜单项事件
    setupMenuItemEvents(item, color, hoverColor) {
        item.addEventListener('mouseover', () => {
            Object.assign(item.style, {
                backgroundColor: '#f5f5f5',
                color: hoverColor,
                transform: 'translateX(4px)'
            });
        });
        
        item.addEventListener('mouseout', () => {
            Object.assign(item.style, {
                backgroundColor: 'transparent',
                color: color,
                transform: 'translateX(0)'
            });
        });
    }

    // 设置菜单项动作
    setupMenuItemAction(item, nodeId, text) {
        const node = this.nodes.get(nodeId);
        if (text.includes('Delete')) {
            item.onclick = () => {
                // 记录菜单项点击日志
                window.Logger.log(window.LogCategory.UI, 'network_node_menu_item_clicked', {
                    node_id: nodeId,
                    type: node.type,
                    label: node.label,
                    confirmed: this.nodeStates.get(nodeId),
                    action: 'delete'
                });
                this.deleteNode(nodeId, item);
            };
        } else if (text.includes('Set as')) {
            item.onclick = () => {
                // 记录菜单项点击日志
                window.Logger.log(window.LogCategory.UI, 'network_node_menu_item_clicked', {
                    node_id: nodeId,
                    type: node.type,
                    label: node.label,
                    confirmed: this.nodeStates.get(nodeId),
                    action: 'toggle_state'
                });
                this.toggleNodeState(nodeId, item);
            };
        }
    }

    // 编辑意图节点的动作
    setupEditIntentAction(menuItem, nodeId) {
        const node = this.nodes.get(nodeId);
        menuItem.onclick = async () => {
            const intentName = node.originalLabel || node.label;
            
            this.createDialog('Edit Intent', intentName, async (newIntentName) => {
                // 记录节点编辑日志
                window.Logger.log(window.LogCategory.SYSTEM, 'network_node_edited', {
                    node_id: nodeId,
                    type: node.type,
                    old_label: intentName,
                    new_label: newIntentName
                });
                
                // 更新意图树数据
                if (this.intentTree.item && this.intentTree.item[intentName] !== undefined) {
                    // 更新意图树
                    const originalData = this.intentTree.item[intentName];
                    this.intentTree.item[newIntentName] = JSON.parse(JSON.stringify(originalData));
                    delete this.intentTree.item[intentName];
                    
                    // 持久化更新后的意图树
                    try {
                        await saveIntentTree(this.intentTree);
                        
                        // 更新节点显示
                        this.nodes.update({
                            id: nodeId,
                            label: this.wrapLabel(newIntentName, 20, 'intent'),
                            originalLabel: newIntentName
                        });

                        // 设置为已确认
                        this.updateNodeState(nodeId, true);
                    } catch (error) {
                        console.error('Error saving intent tree:', error);
                        alert('Failed to save the edited intent. Please try again.');
                        
                        // 回滚更改
                        this.intentTree.item[intentName] = JSON.parse(JSON.stringify(this.intentTree.item[newIntentName]));
                        delete this.intentTree.item[newIntentName];
                    }
                } else {
                    console.error('Intent not found in the tree:', intentName);
                }
            });
        };
    }

    // 设置添加子意图节点的动作
    setupAddChildIntentAction(menuItem, nodeId) {
        const node = this.nodes.get(nodeId);
        menuItem.onclick = async () => {
            const defaultValue = 'New Intent ' + (Object.keys(this.intentTree.item || {}).length + 1);
            
            this.createDialog('Add New Intent', defaultValue, async (intentName) => {
                const newNodeId = this.generateUniqueNodeId();
                
                // 添加新节点到数据集 - 使用 V2 版本的配置格式
                this.nodes.add({
                    id: newNodeId,
                    label: this.wrapLabel(intentName, 15, 'intent'),
                    originalLabel: intentName,
                    type: 'intent',
                    color: this.getNodeColor('intent'),
                    size: this.getNodeSize('intent'),
                    opacity: 1,
                    fixed: { x: false, y: false }  // V2 版本的配置方式
                });

                // 添加连接边
                this.edges.add({
                    from: nodeId,
                    to: newNodeId,
                    arrows: 'to',
                    dashes: false
                });

                // 记录节点添加日志
                window.Logger.log(window.LogCategory.UI, 'network_node_added', {
                    node_id: newNodeId,
                    type: 'intent',
                    label: intentName,
                    parent_id: nodeId,
                    parent_label: node.label
                });

                // 设置新节点状态为已确认
                this.updateNodeState(newNodeId, true);
                
                // 更新意图树数据
                if (!this.intentTree.item) {
                    this.intentTree.item = {};
                }
                this.intentTree.item[intentName] = [];

                // 持久化更新后的意图树
                try {
                    await saveIntentTree(this.intentTree);
                } catch (error) {
                    console.error('Error saving intent tree:', error);
                    alert('Failed to save the new intent. Please try again.');
                    
                    // 如果保存失败，回滚更新
                    this.nodes.remove(newNodeId);
                    this.edges.remove({ from: nodeId, to: newNodeId });
                    this.nodeStates.delete(newNodeId);
                    NetworkManager.immutableIntents.delete(intentName);
                    if (this.intentTree.item[intentName]) {
                        delete this.intentTree.item[intentName];
                    }
                }
            });
        };
    }

    // 生成唯一的节点ID
    generateUniqueNodeId() {
        let counter = 1;
        while (true) {
            const newId = 'intent_' + counter;
            const existingNode = this.nodes.get(newId);
            if (!existingNode) {
                return newId;
            }
            counter++;
        }
    }

    // 删除节点
    async deleteNode(nodeId, menuItem) {
        const node = this.nodes.get(nodeId);
        // 记录节点删除日志
        window.Logger.log(window.LogCategory.UI, 'network_node_deleted', {
            node_id: nodeId,
            type: node.type,
            label: node.label
        });
        
        try {
            // 获取要删除的节点信息
            if (!node) {
                throw new Error('Node not found');
            }

            // 保存要删除的节点和边的信息（用于回滚）
            const deletedNode = { ...node };
            const deletedEdges = [];
            this.edges.forEach(edge => {
                if (edge.from === nodeId || edge.to === nodeId) {
                    deletedEdges.push({ ...edge });
                }
            });

            // 从可视化中删除节点和相关边
            this.nodes.remove(nodeId);
            this.edges.forEach(edge => {
                if (edge.from === nodeId || edge.to === nodeId) {
                    this.edges.remove(edge.id);
                }
            });

            // 从内存中删除节点状态
            this.nodeStates.delete(nodeId);

            // 如果是意图节点，从意图树中删除相应的数据
            if ((node.type === NetworkManager.NodeTypes.HIGH_INTENT || 
                 node.type === NetworkManager.NodeTypes.LOW_INTENT || 
                 node.type === 'intent') && this.intentTree.item) {
                const intentName = node.originalLabel || node.label;
                delete this.intentTree.item[intentName];
                NetworkManager.immutableIntents.delete(intentName);
            }

            // 持久化更新后的意图树
            await saveIntentTree(this.intentTree);
            console.log('Intent tree updated and saved successfully after node deletion');

            // 删除菜单项
            if (menuItem && menuItem.parentElement) {
                menuItem.parentElement.remove();
            }

        } catch (error) {
            console.error('Error deleting node:', error);
            alert('Failed to delete the node. Rolling back changes...');

            // 回滚所有更改
            try {
                // 恢复节点
                this.nodes.add(deletedNode);
                // 恢复边
                deletedEdges.forEach(edge => {
                    this.edges.add(edge);
                });
                // 恢复节点状态
                if (deletedNode.type === NetworkManager.NodeTypes.HIGH_INTENT || 
                    deletedNode.type === NetworkManager.NodeTypes.LOW_INTENT || 
                    deletedNode.type === 'intent') {
                    this.nodeStates.set(nodeId, NetworkManager.immutableIntents.has(deletedNode.originalLabel || deletedNode.label));
                }
                // 恢复意图树数据
                if ((deletedNode.type === NetworkManager.NodeTypes.HIGH_INTENT || 
                     deletedNode.type === NetworkManager.NodeTypes.LOW_INTENT || 
                     deletedNode.type === 'intent') && this.intentTree.item) {
                    const intentName = deletedNode.originalLabel || deletedNode.label;
                    this.intentTree.item[intentName] = [];
                }
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
                alert('Critical error: Failed to rollback changes. Please refresh the page.');
            }
        }
    }

    // 切换节点状态
    toggleNodeState(nodeId, menuItem) {
        const newState = !this.nodeStates.get(nodeId);
        this.updateNodeState(nodeId, newState);
        
        // 移除菜单
        menuItem.parentElement.remove();
        NetworkManager.activeNodeMenu = false;
        
        // 记录状态切换日志
        window.Logger.log(window.LogCategory.UI, 'network_node_state_toggled', {
            node_id: nodeId,
            new_state: newState ? 'confirmed' : 'pending'
        });
    }

    // 设置菜单关闭事件
    setupMenuCloseEvent(menu) {
        const closeMenu = (e) => {
            // 只检查点击是否在菜单外
            if (!menu.contains(e.target)) {
                menu.remove();
                NetworkManager.activeNodeMenu = false;
                document.removeEventListener('click', closeMenu);
            }
        };
        // 延迟添加事件监听器，避免立即触发
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // 初始化网络图
    initializeNetwork() {
        setTimeout(() => {
            const options = this.getNetworkOptions();
            
            // 清除加载指示器
            this.visContainer.innerHTML = '';
            
            // 初始化网络
            this.network = new vis.Network(this.visContainer, {
                nodes: this.nodes,
                edges: this.edges
            }, options);

            // 添加网络事件监听
            this.setupNetworkEvents();
            
            // 延迟初始化节点合并管理器，确保网络完全准备就绪
            setTimeout(() => {
                this.initializeNodeMergeManager();
            }, 100);
            
            // 等待布局稳定后进行初始缩放适配和自动排版
            this.network.once('stabilized', () => {
                // 首次展示时自动执行横向排版，确保节点位置合理
                this.arrangeHorizontalLayout();
                
                // 延迟执行缩放适配，确保排版完成后再适配视图
                setTimeout(() => {
                    this.network.fit({
                        animation: {
                            duration: 1000,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                }, 300);
            });

            // 添加网络可视化初始化完成的日志
            const nodes = this.nodes.get();
            window.Logger.log(window.LogCategory.UI, 'network_visualization_initialized', {
                total_nodes: nodes.length,
                edges_count: this.edges.length,
                high_intent_nodes: nodes.filter(node => node.type === NetworkManager.NodeTypes.HIGH_INTENT).length,
                low_intent_nodes: nodes.filter(node => node.type === NetworkManager.NodeTypes.LOW_INTENT).length,
                intent_nodes: nodes.filter(node => node.type === 'intent').length,
                record_nodes: nodes.filter(node => node.type === NetworkManager.NodeTypes.RECORD || node.type === 'record').length
            });
        }, 100);
    }

    getNetworkOptions() {
        const baseOptions = {
            nodes: {
                shape: 'dot',
                size: 12,  // 将默认大小从16减小到12
                font: {
                    size: 14,
                    color: '#333333',
                    face: 'system-ui, -apple-system, sans-serif',
                    multi: true,
                    background: {
                        enabled: true,
                        color: 'rgba(255, 255, 255, 0.85)',
                        size: 6,
                        strokeWidth: 0
                    },
                    align: 'center',
                    vadjust: 8
                },
                borderWidth: 2,
                shadow: true,
                fixed: false,
                scaling: {
                    label: {
                        enabled: true,
                        min: 12,
                        max: 16
                    }
                }
            },
            edges: {
                width: 2,
                smooth: {
                    type: 'curvedCW',     // 使用曲线连接，提升视觉效果
                    roundness: 0.2        // 设置曲线的弧度
                },
                arrows: {
                    to: { 
                        enabled: true, 
                        scaleFactor: 0.5,
                        type: 'arrow'        // 使用箭头类型
                    }
                },
                length: 120,              // 设置边长度
                color: {
                    color: '#848484',     // 边的颜色
                    highlight: '#2B7CE9', // 高亮时的颜色
                    hover: '#2B7CE9',     // 悬停时的颜色
                    inherit: false,       // 不继承节点颜色
                    opacity: 0.8          // 透明度
                },
                shadow: false,            // 禁用阴影提升性能
                hoverWidth: 3             // 悬停时的边宽度
            },
            interaction: {
                dragNodes: true,        // 启用所有节点拖动
                dragView: true,
                zoomView: true,
                hover: true,
                selectable: true,
                hideEdgesOnDrag: false,
                hideEdgesOnZoom: false,
                hover: true,
                multiselect: false,
                selectConnectedEdges: true,
                hoverConnectedEdges: true,
                zoomSpeed: 0.3
            },
            layout: {
                randomSeed: 1,
                improvedLayout: true
            }
        };

        // 使用简单的布局配置，参考 V2 版本
        baseOptions.layout = {
            randomSeed: 42
        };
        
        // 使用 V2 版本的简化物理引擎配置 - 拖到哪里停在哪里
        baseOptions.physics = {
            enabled: true,
            stabilization: { 
                enabled: false // 关闭自动稳定，允许自由拖拽
            },
            solver: 'repulsion',
            repulsion: {
                nodeDistance: 0,
                centralGravity: 0,
                springLength: 0,
                springConstant: 0,
                damping: 1
            }
        };

        // 使用 V2 版本的节点配置 - 允许自由移动
        this.nodes.get().forEach(node => {
            this.nodes.update({
                id: node.id,
                fixed: { x: false, y: false }  // V2 版本的配置方式
            });
        });

        // 为侧边栏模式添加特殊配置
        if (this.displayMode === 'sidepanel') {
            return {
                ...baseOptions,
                nodes: {
                    ...baseOptions.nodes,
                    size: 12,
                    font: {
                        size: 12,
                        color: '#333'
                    }
                }
            };
        }

        return baseOptions;
    }

    // 设置网络事件
    setupNetworkEvents() {
        let isTooltipVisible = false;
        let tooltipNode = null;

        // 左键点击节点 - 仅记录日志，不显示菜单
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                
                // 记录节点点击日志
                window.Logger.log(window.LogCategory.UI, 'network_node_clicked', {
                    node_id: nodeId,
                    type: node.type,
                    label: node.label,
                    confirmed: this.nodeStates.get(nodeId)
                });
            } else {
                // 点击空白区域时重置所有节点的状态显示
                this.resetAllNodeStates();
            }
        });

        // 右键点击节点显示菜单
        this.network.on('oncontext', (params) => {
            params.event.preventDefault();
            
            // 检查是否右键点击在节点上
            const nodeId = this.network.getNodeAt(params.pointer.DOM);
            if (nodeId) {
                // 直接显示右键菜单，无需先选中节点
                // this.showContextMenu(nodeId, params.pointer.DOM);
                this.createNodeMenu(nodeId);
            }
        });

        // 监听悬停事件
        this.network.on('hoverNode', (params) => {
            tooltipNode = params.node;
            isTooltipVisible = true;
            // 禁用缩放
            this.network.setOptions({
                interaction: {
                    zoomView: false
                }
            });
        });

        // 监听悬停结束事件
        this.network.on('blurNode', (params) => {
            if (params.node === tooltipNode) {
                tooltipNode = null;
                isTooltipVisible = false;
                // 恢复缩放
                this.network.setOptions({
                    interaction: {
                        zoomView: true
                    }
                });
            }
        });

        // 监听滚轮事件
        this.visContainer.addEventListener('wheel', (event) => {
            if (isTooltipVisible) {
                // 如果提示框可见，检查事件目标
                let target = event.target;
                let isInsideTooltip = false;

                // 检查事件是否发生在提示框内
                while (target && target !== this.visContainer) {
                    if (target.classList.contains('vis-tooltip')) {
                        isInsideTooltip = true;
                        break;
                    }
                    target = target.parentElement;
                }

                // 如果不在提示框内，阻止事件
                if (!isInsideTooltip) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        }, { passive: false });

        // 拖动事件现在由NodeMergeManager统一处理
        // 移除重复的事件监听器以避免冲突

        // 添加选择事件
        this.network.on('select', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                if (node.type === NetworkManager.NodeTypes.RECORD || node.type === 'record') {
                    // 高亮显示相关节点
                    this.highlightConnectedNodes(nodeId);
                }
            } else {
                // 取消高亮
                this.clearHighlight();
            }
        });
    }

    // 初始化节点合并管理器
    initializeNodeMergeManager() {
        console.log('Attempting to initialize NodeMergeManager...');
        console.log('Network exists:', !!this.network);
        console.log('NodeMergeManager defined:', typeof NodeMergeManager !== 'undefined');
        
        if (!this.network) {
            console.error('Cannot initialize NodeMergeManager: network is null');
            return;
        }
        
        if (typeof NodeMergeManager === 'undefined') {
            console.error('Cannot initialize NodeMergeManager: NodeMergeManager class is not defined');
            return;
        }
        
        try {
            this.nodeMergeManager = new NodeMergeManager(this);
            console.log('NodeMergeManager initialized successfully');
        } catch (error) {
            console.error('Error initializing NodeMergeManager:', error);
        }
    }

    // 高亮相关节点
    highlightConnectedNodes(nodeId) {
        const connectedNodes = this.network.getConnectedNodes(nodeId);
        const allNodes = this.nodes.get();
        const allEdges = this.edges.get();
        
        // 降低其他节点的透明度
        allNodes.forEach(node => {
            if (node.id !== nodeId && !connectedNodes.includes(node.id)) {
                this.nodes.update({
                    id: node.id,
                    opacity: 0.3
                });
            }
        });
        
        // 降低其他边的透明度
        allEdges.forEach(edge => {
            if (edge.from !== nodeId && edge.to !== nodeId) {
                this.edges.update({
                    id: edge.id,
                    opacity: 0.3
                });
            }
        });
    }

    // 清除高亮效果
    clearHighlight() {
        const allNodes = this.nodes.get();
        const allEdges = this.edges.get();
        
        // 恢复所有节点的透明度
        allNodes.forEach(node => {
            this.nodes.update({
                id: node.id,
                opacity: 1.0
            });
        });
        
        // 恢复所有边的透明度
        allEdges.forEach(edge => {
            this.edges.update({
                id: edge.id,
                opacity: 1.0
            });
        });
    }

    // 重置所有节点状态显示 - 根据确认状态设置正确的透明度
    resetAllNodeStates() {
        const allNodes = this.nodes.get();
        
        // 根据节点的确认状态重置透明度
        allNodes.forEach(node => {
            const isImmutable = this.nodeStates.get(node.id);
            this.nodes.update({
                id: node.id,
                opacity: isImmutable ? 1.0 : 0.3
            });
        });

        // 同时重置边的状态
        this.updateAllEdgesStates();
    }

    // 更新所有边的状态
    updateAllEdgesStates() {
        const allEdges = this.edges.get();
        
        allEdges.forEach(edge => {
            const fromConfirmed = this.nodeStates.get(edge.from);
            const toConfirmed = this.nodeStates.get(edge.to);
            this.edges.update({
                id: edge.id,
                dashes: !(fromConfirmed && toConfirmed),
                opacity: 1.0
            });
        });
    }

    // 获取带有确认状态的意图树
    getIntentTreeWithStates() {
        const newIntentTree = {
            scenario: this.intentTree.scenario,
            child: []
        };
        
        // 递归处理节点的函数
        const processIntentNode = (intentData, intentName, idCounter) => {
            const description = intentData?.description || intentName;
            const intentObj = {
                id: idCounter,
                intent: intentName,
                description: description,
                isLeafNode: false,
                immutable: NetworkManager.immutableIntents?.has(intentName) || false,
                child: [],
                child_num: 0,
                priority: 1
            };

            // 检查是否有子节点
            if (intentData.child && Array.isArray(intentData.child) && intentData.child.length > 0) {
                // 检查子节点是否是意图节点（有intent属性）
                const hasChildIntents = intentData.child.some(child => child.intent);
                
                if (hasChildIntents) {
                    // 递归处理子意图节点
                    intentData.child.forEach(childNode => {
                        if (childNode.intent) {
                            const childIntent = processIntentNode(childNode, childNode.intent, idCounter + 1);
                            intentObj.child.push(childIntent);
                            intentObj.child_num++;
                        }
                    });
                } else {
                    // 子节点是记录，直接添加到child
                    intentObj.child = intentData.child;
                    intentObj.child_num = intentData.child.length;
                }
            } else if (intentData.group && Array.isArray(intentData.group)) {
                // 没有子节点但有group，使用group中的记录
                intentObj.child = intentData.group;
                intentObj.child_num = intentData.group.length;
            }

            return intentObj;
        };
        
        if (this.intentTree?.item) {
            let idCounter = 1;
            Object.keys(this.intentTree.item).forEach(intentName => {
                if (!intentName || intentName.startsWith('remaining_intent_')) {
                    return;
                }

                const intentData = this.intentTree.item[intentName];
                if (!intentData) {
                    console.warn(`Intent data is missing for intent: ${intentName}`);
                    return;
                }

                const intentObj = processIntentNode(intentData, intentName, idCounter++);
                newIntentTree.child.push(intentObj);
            });
        }

        return newIntentTree;
    }

    // Add cleanup method to handle container removal properly
    cleanup() {
        if (this.container) {
            this.container.remove();
            if (this.containerArea) {
                this.containerArea.classList.remove('with-network');
                // 重置容器区域样式
                Object.assign(this.containerArea.style, {
                    width: "40vw"
                });
                
                // 重置记录列表容器样式
                const recordsList = this.containerArea.querySelector(".mp-floating-main-container");
                if (recordsList) {
                    recordsList.style.width = "40vw";
                    recordsList.style.minWidth = "360px";
                }
            }
        }
        isNetworkVisible = false;
    }

    setupVisContainer() {
        this.visContainer = document.createElement("div");
        Object.assign(this.visContainer.style, {
            width: "100%",
            height: "calc(100% - 40px)",
            position: "relative",
            overflow: "hidden"
        });
        
        // 添加工具栏
        const toolbar = document.createElement("div");
        Object.assign(toolbar.style, {
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: "1000",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "5px",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)"
        });

        // 添加方向切换开关
        const directionSwitch = document.createElement("div");
        Object.assign(directionSwitch.style, {
            display: "flex",
            alignItems: "center",
            background: "#f5f5f5",
            borderRadius: "6px",
            padding: "2px",
            cursor: "pointer",
            userSelect: "none",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
        });

        const horizontalSvg = `
        <svg width="16" height="16" viewBox="0 0 80 70" fill="none">
            <!-- Root node -->
            <circle cx="10" cy="35" r="4" fill="currentColor"/>
            <!-- Leaf nodes -->
            <circle cx="70" cy="15" r="4" fill="currentColor"/>
            <circle cx="70" cy="35" r="4" fill="currentColor"/>
            <circle cx="70" cy="55" r="4" fill="currentColor"/>
            <!-- Curved paths -->
            <path d="M 14 35 C 35 35, 45 15, 66 15" stroke="currentColor" fill="none" stroke-width="2"/>
            <path d="M 14 35 C 35 35, 45 35, 66 35" stroke="currentColor" fill="none" stroke-width="2"/>
            <path d="M 14 35 C 35 35, 45 55, 66 55" stroke="currentColor" fill="none" stroke-width="2"/>
        </svg>`;

        const verticalSvg = `
        <svg width="16" height="16" viewBox="0 0 70 80" fill="none">
            <!-- Root node -->
            <circle cx="35" cy="10" r="4" fill="currentColor"/>
            <!-- Leaf nodes -->
            <circle cx="15" cy="70" r="4" fill="currentColor"/>
            <circle cx="35" cy="70" r="4" fill="currentColor"/>
            <circle cx="55" cy="70" r="4" fill="currentColor"/>
            <!-- Curved paths -->
            <path d="M 35 14 C 35 35, 15 45, 15 66" stroke="currentColor" fill="none" stroke-width="2"/>
            <path d="M 35 14 C 35 35, 35 45, 35 66" stroke="currentColor" fill="none" stroke-width="2"/>
            <path d="M 35 14 C 35 35, 55 45, 55 66" stroke="currentColor" fill="none" stroke-width="2"/>
        </svg>`;

        const horizontalBtn = document.createElement("div");
        const verticalBtn = document.createElement("div");

        const btnStyle = {
            padding: "2px 4px",
            fontSize: "12px",
            borderRadius: "4px",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "16px",
            height: "16px"
        };

        Object.assign(horizontalBtn.style, {
            ...btnStyle,
            backgroundColor: NetworkManager.hierarchicalDirection === 'LR' ? "#fff" : "transparent",
            color: NetworkManager.hierarchicalDirection === 'LR' ? "#333" : "#666",
            boxShadow: NetworkManager.hierarchicalDirection === 'LR' ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none"
        });
        horizontalBtn.innerHTML = horizontalSvg;
        horizontalBtn.title = "Horizontal Layout";

        Object.assign(verticalBtn.style, {
            ...btnStyle,
            backgroundColor: NetworkManager.hierarchicalDirection === 'UD' ? "#fff" : "transparent",
            color: NetworkManager.hierarchicalDirection === 'UD' ? "#333" : "#666",
            boxShadow: NetworkManager.hierarchicalDirection === 'UD' ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none"
        });
        verticalBtn.innerHTML = verticalSvg;
        verticalBtn.title = "Vertical Layout";

        const updateButtonStyles = (isHorizontal) => {
            const oldDirection = NetworkManager.hierarchicalDirection;
            NetworkManager.hierarchicalDirection = isHorizontal ? 'LR' : 'UD';

            // 记录布局方向改变日志
            window.Logger.log(window.LogCategory.UI, 'network_direction_changed', {
                old_direction: oldDirection,
                new_direction: NetworkManager.hierarchicalDirection
            });

            Object.assign(horizontalBtn.style, {
                backgroundColor: isHorizontal ? "#fff" : "transparent",
                color: isHorizontal ? "#333" : "#666",
                boxShadow: isHorizontal ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none"
            });
            Object.assign(verticalBtn.style, {
                backgroundColor: !isHorizontal ? "#fff" : "transparent",
                color: !isHorizontal ? "#333" : "#666",
                boxShadow: !isHorizontal ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none"
            });
        };

        horizontalBtn.addEventListener("click", () => {
            updateButtonStyles(true);
            // 执行水平自动排版，保持自由拖动能力
            this.arrangeHorizontalLayout();
        });

        verticalBtn.addEventListener("click", () => {
            updateButtonStyles(false);
            // 执行垂直自动排版，保持自由拖动能力
            this.arrangeVerticalLayout();
        });

        directionSwitch.appendChild(horizontalBtn);
        directionSwitch.appendChild(verticalBtn);
        toolbar.appendChild(directionSwitch);
        
        this.container.appendChild(toolbar);
        this.container.appendChild(this.visContainer);
        
        const loader = document.createElement("div");
        loader.textContent = "Loading visualization...";
        Object.assign(loader.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#666"
        });
        this.visContainer.appendChild(loader);
    }

    switchDisplayMode(newMode, containerArea = null) {
        if (newMode === this.displayMode) return;

        this.container.remove();
        this.displayMode = newMode;
        this.containerArea = containerArea;
        this.initContainer();
        this.initializeNetwork();
    }

    // 设置容器样式
    setupContainerStyle() {
        Object.assign(this.container.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80vw",
            height: "80vh",
            backgroundColor: "white",
            padding: "20px",
            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            zIndex: "10000",
            borderRadius: "8px"
        });
    }

    // 添加关闭按钮
    addCloseButton() {
        const closeBtn = document.createElement("button");
        this.setupCloseButtonStyle(closeBtn);
        this.container.appendChild(closeBtn);
    }

    // 设置关闭按钮样式
    setupCloseButtonStyle(closeBtn) {
        closeBtn.textContent = "";
        Object.assign(closeBtn.style, {
            position: "absolute",
            right: "10px",
            top: "10px",
            border: "1px solid #ccc",
            background: "#fff",
            color: "#333",
            fontSize: "24px",
            cursor: "pointer",
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
            lineHeight: "1",
            textAlign: "center",
            userSelect: "none",
            transform: "translateY(-2px)",
            zIndex: "1"
        });

        this.setupCloseButtonEvents(closeBtn);
    }

    // 设置关闭按钮事件
    setupCloseButtonEvents(closeBtn) {
        closeBtn.addEventListener("mouseover", () => {
            closeBtn.style.backgroundColor = "#f0f0f0";
            closeBtn.style.borderColor = "#999";
        });
    
        closeBtn.addEventListener("mouseout", () => {
            closeBtn.style.backgroundColor = "#fff";
            closeBtn.style.borderColor = "#ccc";
        });
    
        closeBtn.onclick = (e) => {
            e.preventDefault();
            this.cleanup(); // Use cleanup method instead of just removing container
        };
    }

    // 在 NetworkManager 类中添加新的通用对话框方法
    createDialog(dialogTitle, defaultValue, onConfirm) {
        // 创建对话框
        const intentDialog = document.createElement('div');
        intentDialog.id = 'mp-intent-dialog';  // 添加唯一ID
        intentDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10002;
            min-width: 300px;
        `;

        // 创建标题
        const intentDialogTitle = document.createElement('h3');
        intentDialogTitle.id = 'mp-intent-dialog-title';  // 添加唯一ID
        intentDialogTitle.textContent = dialogTitle;  // 使用参数名dialogTitle而不是title
        intentDialogTitle.style.cssText = `
            margin: 0 0 15px 0;
            color: #2d3436;
        `;

        // 创建输入框
        const intentInput = document.createElement('input');
        intentInput.id = 'mp-intent-dialog-input';  // 添加唯一ID
        intentInput.type = 'text';
        intentInput.placeholder = 'Enter intent name';
        intentInput.value = defaultValue;
        intentInput.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-bottom: 15px;
            border: 1px solid #dfe6e9;
            border-radius: 4px;
            box-sizing: border-box;
        `;

        // 创建按钮容器
        const intentButtonContainer = document.createElement('div');
        intentButtonContainer.id = 'mp-intent-dialog-buttons';  // 添加唯一ID
        intentButtonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        // 创建确认按钮
        const intentConfirmButton = document.createElement('button');
        intentConfirmButton.id = 'mp-intent-dialog-confirm';  // 添加唯一ID
        intentConfirmButton.textContent = 'Confirm';
        intentConfirmButton.style.cssText = `
            padding: 6px 12px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;

        // 创建取消按钮
        const intentCancelButton = document.createElement('button');
        intentCancelButton.id = 'mp-intent-dialog-cancel';  // 添加唯一ID
        intentCancelButton.textContent = 'Cancel';
        intentCancelButton.style.cssText = `
            padding: 6px 12px;
            background: #95a5a6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;

        // 添加按钮事件
        intentConfirmButton.onclick = async () => {
            const value = intentInput.value.trim();
            if (!value) {
                alert('Please enter an intent name');
                return;
            }
            await onConfirm(value);
            document.body.removeChild(intentDialog);
        };

        intentCancelButton.onclick = () => {
            document.body.removeChild(intentDialog);
        };

        // 组装对话框
        intentButtonContainer.appendChild(intentCancelButton);
        intentButtonContainer.appendChild(intentConfirmButton);
        intentDialog.appendChild(intentDialogTitle);
        intentDialog.appendChild(intentInput);
        intentDialog.appendChild(intentButtonContainer);
        document.body.appendChild(intentDialog);

        // 聚焦输入框并选中默认文本
        intentInput.focus();
        intentInput.select();

        // 添加按下回车键确认的功能
        intentInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                intentConfirmButton.click();
            } else if (event.key === 'Escape') {
                intentCancelButton.click();
            }
        });

        return intentDialog;
    }
    
    // 垂直自动排版 - 高级意图一横排在上，低级意图一横排在下，记录节点在下方
    arrangeVerticalLayout() {
        const allNodes = this.nodes.get();
        const allEdges = this.edges.get();
        const containerWidth = this.visContainer.clientWidth;
        const containerHeight = this.visContainer.clientHeight;
        
        // 分类节点
        const highIntentNodes = allNodes.filter(node => node.type === NetworkManager.NodeTypes.HIGH_INTENT);
        const lowIntentNodes = allNodes.filter(node => node.type === NetworkManager.NodeTypes.LOW_INTENT || node.type === 'intent');
        const recordNodes = allNodes.filter(node => node.type === NetworkManager.NodeTypes.RECORD || node.type === 'record');
        
        const updates = [];
        
        // 全局间距配置 - 统一控制所有层级的间距
        const globalSpacing = {
            horizontal: Math.max(120, containerWidth * 0.08),  // 水平间距，最小120px
            vertical: Math.max(80, containerHeight * 0.15),    // 垂直层间距，最小80px
            subTree: Math.max(60, containerWidth * 0.04),      // 子树内间距，最小60px
            record: Math.max(80, containerWidth * 0.06)        // 记录节点间距，最小80px
        };
        
        // 三层结构的Y坐标
        const highIntentY = -globalSpacing.vertical;   // 高级意图在上方
        const lowIntentY = 0;                          // 低级意图在中间
        const recordY = globalSpacing.vertical;        // 记录节点在下方
        
        // 1. 计算所有层级的总宽度，确保全局布局协调
        const allGroupWidths = [];
        
        // 计算高级意图层的总宽度
        const highIntentTotalWidth = highIntentNodes.length > 1 
            ? (highIntentNodes.length - 1) * globalSpacing.horizontal 
            : 0;
        allGroupWidths.push(highIntentTotalWidth);
        
        // 计算低级意图层的总宽度
        let lowIntentTotalWidth = 0;
        if (lowIntentNodes.length > 0) {
            // 按父节点分组计算宽度
            const childGroups = new Map();
            highIntentNodes.forEach(highNode => {
                childGroups.set(highNode.id, []);
            });
            
            lowIntentNodes.forEach(lowNode => {
                const parentEdge = allEdges.find(edge => 
                    edge.to === lowNode.id && 
                    highIntentNodes.some(h => h.id === edge.from)
                );
                
                if (parentEdge) {
                    const parentId = parentEdge.from;
                    if (childGroups.has(parentId)) {
                        childGroups.get(parentId).push(lowNode);
                    }
                } else {
                    const firstHighIntent = highIntentNodes[0];
                    if (firstHighIntent && childGroups.has(firstHighIntent.id)) {
                        childGroups.get(firstHighIntent.id).push(lowNode);
                    }
                }
            });
            
            // 计算每组的宽度并求总宽度
            let totalSubTreeWidth = 0;
            childGroups.forEach((children, parentId) => {
                if (children.length > 0) {
                    const groupWidth = children.length > 1 
                        ? (children.length - 1) * globalSpacing.subTree 
                        : 0;
                    totalSubTreeWidth = Math.max(totalSubTreeWidth, groupWidth);
                }
            });
            lowIntentTotalWidth = Math.max(totalSubTreeWidth, highIntentTotalWidth);
        }
        allGroupWidths.push(lowIntentTotalWidth);
        
        // 使用最大宽度作为全局布局基准
        const maxLayoutWidth = Math.max(...allGroupWidths);
        
        // 2. 排列高级意图节点 - 基于全局最大宽度居中
        if (highIntentNodes.length > 0) {
            const actualSpacing = highIntentNodes.length > 1 
                ? Math.min(globalSpacing.horizontal, maxLayoutWidth / (highIntentNodes.length - 1))
                : globalSpacing.horizontal;
            const totalWidth = (highIntentNodes.length - 1) * actualSpacing;
            const startX = -totalWidth / 2;
            
            highIntentNodes.forEach((node, index) => {
                updates.push({
                    id: node.id,
                    x: startX + index * actualSpacing,
                    y: highIntentY,
                    fixed: { x: false, y: false }
                });
            });
        }
        
        // 3. 根据连接关系排列低级意图节点
        if (lowIntentNodes.length > 0) {
            const childGroups = new Map();
            
            // 初始化每个高级意图的子节点组
            highIntentNodes.forEach(highNode => {
                childGroups.set(highNode.id, []);
            });
            
            // 根据边的连接关系分组低级意图节点
            lowIntentNodes.forEach(lowNode => {
                const parentEdge = allEdges.find(edge => 
                    edge.to === lowNode.id && 
                    highIntentNodes.some(h => h.id === edge.from)
                );
                
                if (parentEdge) {
                    const parentId = parentEdge.from;
                    if (childGroups.has(parentId)) {
                        childGroups.get(parentId).push(lowNode);
                    }
                } else {
                    const firstHighIntent = highIntentNodes[0];
                    if (firstHighIntent && childGroups.has(firstHighIntent.id)) {
                        childGroups.get(firstHighIntent.id).push(lowNode);
                    }
                }
            });
            
            // 为每组低级意图节点定位
            childGroups.forEach((childNodes, parentId) => {
                if (childNodes.length === 0) return;
                
                // 找到父节点的位置
                const parentUpdate = updates.find(u => u.id === parentId);
                const parentX = parentUpdate ? parentUpdate.x : 0;
                
                // 计算子节点间距，考虑全局布局协调
                const maxChildWidth = childNodes.length > 1 
                    ? Math.min(globalSpacing.subTree, maxLayoutWidth / (childNodes.length - 1))
                    : globalSpacing.subTree;
                const totalChildWidth = (childNodes.length - 1) * maxChildWidth;
                const startChildX = parentX - totalChildWidth / 2;
                
                childNodes.forEach((childNode, index) => {
                    updates.push({
                        id: childNode.id,
                        x: startChildX + index * maxChildWidth,
                        y: lowIntentY,
                        fixed: { x: false, y: false }
                    });
                });
            });
        }
        
        // 4. 根据连接关系排列记录节点
        if (recordNodes.length > 0) {
            const recordGroups = new Map();
            
            // 初始化每个低级意图的子记录组
            lowIntentNodes.forEach(lowNode => {
                recordGroups.set(lowNode.id, []);
            });
            
            // 根据边的连接关系分组记录节点
            recordNodes.forEach(recordNode => {
                const parentEdge = allEdges.find(edge => 
                    edge.to === recordNode.id && 
                    lowIntentNodes.some(l => l.id === edge.from)
                );
                
                if (parentEdge) {
                    const parentId = parentEdge.from;
                    if (recordGroups.has(parentId)) {
                        recordGroups.get(parentId).push(recordNode);
                    }
                } else {
                    const firstLowIntent = lowIntentNodes[0];
                    if (firstLowIntent && recordGroups.has(firstLowIntent.id)) {
                        recordGroups.get(firstLowIntent.id).push(recordNode);
                    }
                }
            });
            
            // 为每组记录节点定位
            recordGroups.forEach((recordNodesList, parentId) => {
                if (recordNodesList.length === 0) return;
                
                // 找到父节点的位置
                const parentUpdate = updates.find(u => u.id === parentId);
                const parentX = parentUpdate ? parentUpdate.x : 0;
                
                // 计算记录节点间距，与全局布局保持一致
                const maxRecordWidth = recordNodesList.length > 1 
                    ? Math.min(globalSpacing.record, maxLayoutWidth / (recordNodesList.length - 1))
                    : globalSpacing.record;
                const totalRecordWidth = (recordNodesList.length - 1) * maxRecordWidth;
                const startRecordX = parentX - totalRecordWidth / 2;
                
                recordNodesList.forEach((recordNode, index) => {
                    updates.push({
                        id: recordNode.id,
                        x: startRecordX + index * maxRecordWidth,
                        y: recordY,
                        fixed: { x: false, y: false }
                    });
                });
            });
        }
        
        // 批量更新节点位置
        this.nodes.update(updates);
        
        // 添加平滑的动画过渡
        this.network.setOptions({
            physics: {
                enabled: true,
                stabilization: { 
                    enabled: true,
                    iterations: 100,
                    updateInterval: 25
                },
                solver: 'repulsion',
                repulsion: {
                    nodeDistance: 0,
                    centralGravity: 0,
                    springLength: 0,
                    springConstant: 0,
                    damping: 1
                }
            }
        });
        
        // 在动画完成后恢复原配置
        setTimeout(() => {
            this.network.setOptions({
                physics: {
                    enabled: true,
                    stabilization: { enabled: false },
                    solver: 'repulsion',
                    repulsion: {
                        nodeDistance: 0,
                        centralGravity: 0,
                        springLength: 0,
                        springConstant: 0,
                        damping: 1
                    }
                }
            });
        }, 1000);
        
        // 记录排版事件
        window.Logger.log(window.LogCategory.UI, 'network_vertical_layout_applied', {
            high_intent_count: highIntentNodes.length,
            low_intent_count: lowIntentNodes.length,
            record_count: recordNodes.length
        });
    }
    
    // 水平自动排版 - 高级意图一列在左，低级意图一列在中，记录节点在右侧
    arrangeHorizontalLayout() {
        const allNodes = this.nodes.get();
        const allEdges = this.edges.get();
        const containerWidth = this.visContainer.clientWidth;
        const containerHeight = this.visContainer.clientHeight;
        
        // 分类节点
        const highIntentNodes = allNodes.filter(node => node.type === NetworkManager.NodeTypes.HIGH_INTENT);
        const lowIntentNodes = allNodes.filter(node => node.type === NetworkManager.NodeTypes.LOW_INTENT || node.type === 'intent');
        const recordNodes = allNodes.filter(node => node.type === NetworkManager.NodeTypes.RECORD || node.type === 'record');
        
        const updates = [];
        
        // 三列结构的X坐标
        const layerWidth = containerWidth * 0.25;  // 每列的间距
        const highIntentX = -layerWidth;    // 高级意图在左侧
        const lowIntentX = 0;              // 低级意图在中间
        const recordX = layerWidth;        // 记录节点在右侧
        
        // 1. 排列高级意图节点 - 一列在左侧
        if (highIntentNodes.length > 0) {
            const nodeSpacing = 120;  // 节点间固定间距
            const totalHeight = (highIntentNodes.length - 1) * nodeSpacing;
            const startY = -totalHeight / 2;
            
            highIntentNodes.forEach((node, index) => {
                updates.push({
                    id: node.id,
                    x: highIntentX,
                    y: startY + index * nodeSpacing,
                    fixed: { x: false, y: false }
                });
            });
        }
        
        // 2. 根据连接关系排列低级意图节点
        if (lowIntentNodes.length > 0) {
            // 为每个高级意图找到其子低级意图
            const childGroups = new Map();
            
            // 初始化每个高级意图的子节点组
            highIntentNodes.forEach(highNode => {
                childGroups.set(highNode.id, []);
            });
            
            // 根据边的连接关系分组低级意图节点
            lowIntentNodes.forEach(lowNode => {
                // 找到这个低级意图的父高级意图
                const parentEdge = allEdges.find(edge => 
                    edge.to === lowNode.id && 
                    highIntentNodes.some(h => h.id === edge.from)
                );
                
                if (parentEdge) {
                    const parentId = parentEdge.from;
                    if (childGroups.has(parentId)) {
                        childGroups.get(parentId).push(lowNode);
                    }
                } else {
                    // 如果没有找到父节点，放在第一个组
                    const firstHighIntent = highIntentNodes[0];
                    if (firstHighIntent && childGroups.has(firstHighIntent.id)) {
                        childGroups.get(firstHighIntent.id).push(lowNode);
                    }
                }
            });
            
            // 为每组低级意图节点定位
            childGroups.forEach((childNodes, parentId) => {
                if (childNodes.length === 0) return;
                
                // 找到父节点的位置
                const parentUpdate = updates.find(u => u.id === parentId);
                const parentY = parentUpdate ? parentUpdate.y : 0;
                
                // 在父节点右侧排列子节点
                const childSpacing = 80;  // 子节点间间距
                const totalChildHeight = (childNodes.length - 1) * childSpacing;
                const startChildY = parentY - totalChildHeight / 2;
                
                childNodes.forEach((childNode, index) => {
                    updates.push({
                        id: childNode.id,
                        x: lowIntentX,
                        y: startChildY + index * childSpacing,
                        fixed: { x: false, y: false }
                    });
                });
            });
        }
        
        // 3. 根据连接关系排列记录节点
        if (recordNodes.length > 0) {
            // 为每个低级意图找到其记录节点
            const recordGroups = new Map();
            
            // 初始化每个低级意图的子记录组
            lowIntentNodes.forEach(lowNode => {
                recordGroups.set(lowNode.id, []);
            });
            
            // 根据边的连接关系分组记录节点
            recordNodes.forEach(recordNode => {
                // 找到这个记录节点的父低级意图
                const parentEdge = allEdges.find(edge => 
                    edge.to === recordNode.id && 
                    lowIntentNodes.some(l => l.id === edge.from)
                );
                
                if (parentEdge) {
                    const parentId = parentEdge.from;
                    if (recordGroups.has(parentId)) {
                        recordGroups.get(parentId).push(recordNode);
                    }
                } else {
                    // 如果没有找到父节点，放在第一个组
                    const firstLowIntent = lowIntentNodes[0];
                    if (firstLowIntent && recordGroups.has(firstLowIntent.id)) {
                        recordGroups.get(firstLowIntent.id).push(recordNode);
                    }
                }
            });
            
            // 为每组记录节点定位
            recordGroups.forEach((recordNodesList, parentId) => {
                if (recordNodesList.length === 0) return;
                
                // 找到父节点的位置
                const parentUpdate = updates.find(u => u.id === parentId);
                const parentY = parentUpdate ? parentUpdate.y : 0;
                
                // 在父节点右侧排列记录节点
                const recordSpacing = 60;  // 记录节点间间距
                const totalRecordHeight = (recordNodesList.length - 1) * recordSpacing;
                const startRecordY = parentY - totalRecordHeight / 2;
                
                recordNodesList.forEach((recordNode, index) => {
                    updates.push({
                        id: recordNode.id,
                        x: recordX,
                        y: startRecordY + index * recordSpacing,
                        fixed: { x: false, y: false }
                    });
                });
            });
        }
        
        // 批量更新节点位置
        this.nodes.update(updates);
        
        // 添加平滑的动画过渡
        this.network.setOptions({
            physics: {
                enabled: true,
                stabilization: { 
                    enabled: true,
                    iterations: 100,
                    updateInterval: 25
                },
                solver: 'repulsion',
                repulsion: {
                    nodeDistance: 0,
                    centralGravity: 0,
                    springLength: 0,
                    springConstant: 0,
                    damping: 1
                }
            }
        });
        
        // 在动画完成后恢复原配置
        setTimeout(() => {
            this.network.setOptions({
                physics: {
                    enabled: true,
                    stabilization: { enabled: false },
                    solver: 'repulsion',
                    repulsion: {
                        nodeDistance: 0,
                        centralGravity: 0,
                        springLength: 0,
                        springConstant: 0,
                        damping: 1
                    }
                }
            });
        }, 1000);
        
        // 记录排版事件
        window.Logger.log(window.LogCategory.UI, 'network_horizontal_layout_applied', {
            high_intent_count: highIntentNodes.length,
            low_intent_count: lowIntentNodes.length,
            record_count: recordNodes.length
        });
    }
}

// Add function to save IntentTree when Analyze is clicked
async function saveIntentTree(intentTree) {
    try {
        
        // intentTree: {
        //     "item": {
        //       "游览巴塞罗那主要景点": [
        //         {
        //           "id": 1732720186197,
        //           "comment": "",
        //           "content": "时间紧张的话米拉和巴特罗二选一即可",
        //           "context": "",
        //           "isLeafNode": true
        //         },
        //         {
        //           "id": 1732720196427,
        //           "comment": "拍照",
        //           "content": "tibidabo山属巴塞最高峰，山顶有游乐园",
        //           "context": "",
        //           "isLeafNode": true
        //         }
        //       ],
        //       "提供西班牙旅行建议": [
        //         {
        //           "id": 1732720288906,
        //           "comment": "",
        //           "content": "托莱多小镇一日游～整个小镇都被列为世界文化遗产",
        //           "context": "",
        //           "isLeafNode": true
        //         },
        //       ]
        //     },
        //     "scenario": "Write a travel plan"
        //   }
        // format intentTree with format check
        if (!intentTree || !intentTree.item) {
            throw new Error('Invalid intent tree structure received from server');
        }
        await chrome.runtime.sendMessage({
            action: 'saveIntentTree',
            intentTree: intentTree
        });
        console.log('Intent tree saved successfully');
    } catch (error) {
        console.error('Error saving intent tree:', error);
    }
}


// 主函数
/**
 * @param {string} layout - 布局方式：
 *   'force' - 力导向图布局（默认），节点位置由物理引擎动态计算
 *   'hierarchical' - 层级树状图布局，自上而下展示层级关系
 */
async function showNetworkVisualization(intentTree, containerArea = null, mode = 'standalone', layout = 'force') {
    try {
        if (typeof vis === 'undefined') {
            console.error('Vis.js not loaded');
            alert('Network visualization library not loaded properly. Please try again.');
            return;
        }

        console.log('Visualization data:', intentTree);
        console.log('networkVisualizationContainer mode:', mode);
        console.log('Layout mode:', layout);

        // save intentTree
        await saveIntentTree(intentTree);
        
        this.intentTree = intentTree;
        const networkManager = new NetworkManager(intentTree, containerArea, mode, layout);
        networkManager.initContainer();
        networkManager.initializeNodes();
        networkManager.initializeNetwork();

        isNetworkVisible = true;
        return networkManager;

    } catch (error) {
        console.error('Error in network visualization:', error);
        alert('An error occurred while creating the network visualization.');
    }
}


// 节点合并管理器 - 负责处理所有节点拖动合并操作
class NodeMergeManager {
    constructor(networkManager) {
        console.log('NodeMergeManager constructor called');
        this.networkManager = networkManager;
        this.network = networkManager.network;
        this.nodes = networkManager.nodes;
        this.edges = networkManager.edges;
        
        // 合并操作状态
        this.isDragging = false;
        this.draggedNode = null;
        this.potentialTarget = null;
        
        console.log('Network object:', this.network);
        console.log('Nodes dataset:', this.nodes);
        console.log('Edges dataset:', this.edges);
        
        this.initializeEventListeners();
    }

    // 初始化事件监听器
    initializeEventListeners() {
        if (!this.network) {
            console.error('Cannot initialize event listeners: network is null');
            return;
        }

        console.log('Initializing NodeMergeManager event listeners...');

        // 监听拖动开始
        this.network.on('dragStart', (params) => {
            console.log('Drag start detected:', params);
            if (params.nodes.length > 0) {
                this.isDragging = true;
                this.draggedNode = params.nodes[0];
                console.log('Dragging node:', this.draggedNode);
                
                // 更新光标样式
                if (this.networkManager.container) {
                    this.networkManager.container.style.cursor = 'grabbing';
                }
            }
        });

        // 监听拖动结束
        this.network.on('dragEnd', (params) => {
            console.log('Drag end detected:', params);
            if (this.isDragging && params.nodes.length > 0) {
                console.log('Handling drag end for node:', params.nodes[0]);
                this.handleDragEnd(params.nodes[0]);
            }
            
            // 重置光标样式
            if (this.networkManager.container) {
                this.networkManager.container.style.cursor = 'default';
            }
            
            this.resetDragState();
        });

        // 监听拖动过程中的碰撞检测
        this.network.on('dragging', (params) => {
            if (this.isDragging && params.nodes.length > 0) {
                this.checkCollisionDuringDrag(params.nodes[0]);
            }
        });

        console.log('Event listeners initialized successfully');
    }

    // 处理拖动结束事件
    handleDragEnd(draggedNodeId) {
        console.log('Handling drag end for node:', draggedNodeId);
        const targetNode = this.findCollisionTarget(draggedNodeId);
        console.log('Collision target found:', targetNode);
        
        if (targetNode && targetNode !== draggedNodeId) {
            console.log('Showing merge dialog for collision between:', draggedNodeId, 'and', targetNode);
            this.showMergeConfirmDialog(draggedNodeId, targetNode);
        } else {
            console.log('No valid collision target found or same node collision');
        }
    }

    // 检测碰撞目标节点
    findCollisionTarget(draggedNodeId) {
        console.log('Finding collision target for:', draggedNodeId);
        const draggedPosition = this.network.getPositions([draggedNodeId])[draggedNodeId];
        console.log('Dragged node position:', draggedPosition);
        
        const allNodes = this.nodes.get();
        console.log('Total nodes to check:', allNodes.length);
        
        for (const node of allNodes) {
            if (node.id === draggedNodeId) continue;
            
            const nodePosition = this.network.getPositions([node.id])[node.id];
            const distance = this.calculateDistance(draggedPosition, nodePosition);
            
            console.log(`Distance to node ${node.id}:`, distance);
            
            // 碰撞检测阈值
            const collisionThreshold = 100;
            if (distance < collisionThreshold) {
                console.log('Collision detected with node:', node.id, 'distance:', distance);
                return node.id;
            }
        }
        
        console.log('No collision found');
        return null;
    }

    // 计算两点间距离
    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 显示合并确认对话框
    showMergeConfirmDialog(sourceId, targetId) {
        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);
        
        const mergeType = this.detectMergeType(sourceNode, targetNode);
        
        if (!mergeType.allowed) {
            this.showWarningDialog(mergeType.message);
            return;
        }

        const dialog = this.createMergeDialog(sourceNode, targetNode, mergeType);
        document.body.appendChild(dialog);
    }

    // 检测合并类型
    detectMergeType(sourceNode, targetNode) {
        const NodeTypes = this.networkManager.constructor.NodeTypes;
        
        // 记录节点不能合并到记录节点
        if (sourceNode.type === NodeTypes.RECORD && targetNode.type === NodeTypes.RECORD) {
            return { allowed: false, message: 'Record nodes cannot be merged together' };
        }

        // 同级合并
        if (sourceNode.type === targetNode.type) {
            return {
                allowed: true,
                type: 'same-level',
                operation: `Merge ${sourceNode.type} nodes`
            };
        }

        // 高级意图 → 低级意图
        if (sourceNode.type === NodeTypes.HIGH_INTENT && targetNode.type === NodeTypes.LOW_INTENT) {
            return {
                allowed: true,
                type: 'high-to-low',
                operation: 'Move high-level intent records to low-level intent'
            };
        }

        // 低级意图 → 高级意图
        if (sourceNode.type === NodeTypes.LOW_INTENT && targetNode.type === NodeTypes.HIGH_INTENT) {
            return {
                allowed: true,
                type: 'low-to-high',
                operation: 'Move low-level intent as child of high-level intent'
            };
        }

        // 记录 → 意图节点
        if (sourceNode.type === NodeTypes.RECORD && 
            (targetNode.type === NodeTypes.HIGH_INTENT || targetNode.type === NodeTypes.LOW_INTENT)) {
            return {
                allowed: true,
                type: 'record-to-intent',
                operation: 'Attach record to intent node'
            };
        }

        return { allowed: false, message: 'This merge operation is not supported' };
    }

    // 创建合并对话框
    createMergeDialog(sourceNode, targetNode, mergeType) {
        const dialog = document.createElement('div');
        dialog.className = 'merge-confirm-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 300px;
        `;

        dialog.innerHTML = `
            <h3>Confirm Node Merge</h3>
            <p><strong>Operation:</strong> ${mergeType.operation}</p>
            <p><strong>Source:</strong> ${sourceNode.label}</p>
            <p><strong>Target:</strong> ${targetNode.label}</p>
            <div style="margin-top: 15px; text-align: right;">
                <button id="merge-cancel" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background: white;">Cancel</button>
                <button id="merge-confirm" style="padding: 8px 16px; border: none; border-radius: 4px; background: #007cba; color: white;">Confirm</button>
            </div>
        `;

        // 事件监听
        dialog.querySelector('#merge-cancel').onclick = () => {
            document.body.removeChild(dialog);
        };

        dialog.querySelector('#merge-confirm').onclick = () => {
            this.performMerge(sourceNode, targetNode, mergeType);
            document.body.removeChild(dialog);
        };

        return dialog;
    }

    // 显示警告对话框
    showWarningDialog(message) {
        const dialog = document.createElement('div');
        dialog.className = 'merge-warning-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 250px;
        `;

        dialog.innerHTML = `
            <h3>Merge Not Allowed</h3>
            <p>${message}</p>
            <div style="margin-top: 15px; text-align: right;">
                <button id="warning-ok" style="padding: 8px 16px; border: none; border-radius: 4px; background: #007cba; color: white;">OK</button>
            </div>
        `;

        dialog.querySelector('#warning-ok').onclick = () => {
            document.body.removeChild(dialog);
        };

        document.body.appendChild(dialog);
    }

    // 执行合并操作
    performMerge(sourceNode, targetNode, mergeType) {
        switch (mergeType.type) {
            case 'same-level':
                this.performSameLevelMerge(sourceNode, targetNode);
                break;
            case 'high-to-low':
                this.performHighToLowMerge(sourceNode, targetNode);
                break;
            case 'low-to-high':
                this.performLowToHighMerge(sourceNode, targetNode);
                break;
            case 'record-to-intent':
                this.performRecordToIntentMerge(sourceNode, targetNode);
                break;
        }
    }

    // 同级合并
    performSameLevelMerge(sourceNode, targetNode) {
        // 获取源节点的所有子节点
        const sourceChildren = this.getNodeChildren(sourceNode.id);
        
        // 将源节点的子节点连接到目标节点
        sourceChildren.forEach(childId => {
            this.edges.add({
                id: `${targetNode.id}-${childId}`,
                from: targetNode.id,
                to: childId
            });
        });

        // 删除源节点的边
        this.removeNodeEdges(sourceNode.id);
        
        // 删除源节点
        this.nodes.remove(sourceNode.id);
        
        // 更新存储
        this.updateStorageAfterMerge();
    }

    // 高级意图到低级意图合并
    performHighToLowMerge(sourceNode, targetNode) {
        // 获取源节点的记录子节点
        const sourceRecords = this.getNodeChildren(sourceNode.id)
            .filter(childId => {
                const child = this.nodes.get(childId);
                return child && child.type === this.networkManager.constructor.NodeTypes.RECORD;
            });
        
        // 将记录节点移动到目标低级意图节点下
        sourceRecords.forEach(recordId => {
            this.edges.add({
                id: `${targetNode.id}-${recordId}`,
                from: targetNode.id,
                to: recordId
            });
        });

        // 删除源节点及其连接
        this.removeNodeEdges(sourceNode.id);
        this.nodes.remove(sourceNode.id);
        
        this.updateStorageAfterMerge();
    }

    // 低级意图到高级意图合并
    performLowToHighMerge(sourceNode, targetNode) {
        // 将源低级意图节点及其所有子节点连接到目标高级意图节点
        this.edges.add({
            id: `${targetNode.id}-${sourceNode.id}`,
            from: targetNode.id,
            to: sourceNode.id
        });

        // 移除源节点的父级连接
        const sourceParentEdges = this.edges.get().filter(edge => edge.to === sourceNode.id);
        sourceParentEdges.forEach(edge => {
            if (edge.from !== targetNode.id) {
                this.edges.remove(edge.id);
            }
        });
        
        this.updateStorageAfterMerge();
    }

    // 记录到意图节点合并
    performRecordToIntentMerge(sourceNode, targetNode) {
        // 将记录节点连接到意图节点
        this.edges.add({
            id: `${targetNode.id}-${sourceNode.id}`,
            from: targetNode.id,
            to: sourceNode.id
        });

        // 移除记录节点的原始父级连接
        const sourceParentEdges = this.edges.get().filter(edge => edge.to === sourceNode.id);
        sourceParentEdges.forEach(edge => {
            if (edge.from !== targetNode.id) {
                this.edges.remove(edge.id);
            }
        });
        
        this.updateStorageAfterMerge();
    }

    // 获取节点的子节点ID列表
    getNodeChildren(nodeId) {
        return this.edges.get()
            .filter(edge => edge.from === nodeId)
            .map(edge => edge.to);
    }

    // 移除节点的所有边连接
    removeNodeEdges(nodeId) {
        const relatedEdges = this.edges.get().filter(edge => 
            edge.from === nodeId || edge.to === nodeId
        );
        
        relatedEdges.forEach(edge => {
            this.edges.remove(edge.id);
        });
    }

    // 更新存储 - 与现有存储系统兼容
    async updateStorageAfterMerge() {
        try {
            // 触发网络重新渲染
            if (this.networkManager.network) {
                this.networkManager.network.redraw();
            }

            // 如果存在意图树数据，保存更新后的结构
            if (this.networkManager.intentTree && typeof saveIntentTree === 'function') {
                await saveIntentTree(this.networkManager.intentTree);
                console.log('Intent tree updated and saved after merge operation');
            }
            
            // 记录合并操作日志
            if (window.Logger && window.LogCategory) {
                window.Logger.log(window.LogCategory.UI, 'node_merge_completed', {
                    timestamp: new Date().toISOString(),
                    network_nodes_count: this.nodes.length,
                    network_edges_count: this.edges.length
                });
            }
        } catch (error) {
            console.error('Error updating storage after merge:', error);
        }
    }

    // 重置拖动状态
    resetDragState() {
        this.isDragging = false;
        this.draggedNode = null;
        this.potentialTarget = null;
    }

    // 拖动过程中的碰撞检测（可选的视觉反馈）
    checkCollisionDuringDrag(draggedNodeId) {
        const targetNode = this.findCollisionTarget(draggedNodeId);
        
        if (targetNode !== this.potentialTarget) {
            // 移除之前的高亮
            if (this.potentialTarget) {
                this.removeNodeHighlight(this.potentialTarget);
            }
            
            // 添加新的高亮
            if (targetNode) {
                this.addNodeHighlight(targetNode);
            }
            
            this.potentialTarget = targetNode;
        }
    }

    // 添加节点高亮效果
    addNodeHighlight(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            this.nodes.update({
                id: nodeId,
                borderWidth: 3,
                borderColor: '#ff6b6b'
            });
        }
    }

    // 移除节点高亮效果
    removeNodeHighlight(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            this.nodes.update({
                id: nodeId,
                borderWidth: 1,
                borderColor: node.originalBorderColor || '#cccccc'
            });
        }
    }
}