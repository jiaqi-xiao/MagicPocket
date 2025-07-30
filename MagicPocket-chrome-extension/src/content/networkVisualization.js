// 网络图配置和状态管理
class NetworkManager {
    static activeNodeMenu = false;  // 跟踪节点菜单状态
    static immutableIntents = new Set();  // 存储所有 immutable 的意图名称
    static hierarchicalDirection = 'LR';  // 存储层级布局方向配置

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

        // 从初始意图树中收集 immutable 意图
        if (intentTree && intentTree.child) {
            intentTree.child.forEach(node => {
                if (node.immutable && node.intent) {
                    NetworkManager.immutableIntents.add(node.intent);
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

        // 添加根节点
        const rootId = 'root';
        const rootSize = this.getNodeSize('root');
        const padding = 30;
        const rootNode = {
            id: rootId,
            label: this.wrapLabelVertical(intentTree.scenario || 'Current Task'),
            type: 'root',
            color: this.getNodeColor('root'),
            size: rootSize,
            opacity: 1,
            fixed: true,
            physics: false,
            level: this.layout === 'hierarchical' ? 0 : undefined,
            font: { 
                size: 14,
                align: 'center',
                multi: true,
                face: 'system-ui, -apple-system, sans-serif',
                color: '#333333',
                yalign: 'middle',
                ygap: 3,
                x: -(rootSize + padding),
                y: 0
            }
        };
        nodes.push(rootNode);
        
        // 设置根节点的初始状态为已确认
        this.nodeStates.set(rootId, true);

        // 递归处理节点的函数
        const processNode = (parentId, nodeData, nodeName, level) => {
            const currentNodeId = `intent_${nodeId++}`;
            const isImmutable = NetworkManager.immutableIntents.has(nodeName);
            
            // 添加当前节点
            nodes.push({
                id: currentNodeId,
                label: this.wrapLabel(nodeName, 15, 'intent'),
                originalLabel: nodeName,
                type: 'intent',
                color: this.getNodeColor('intent'),
                size: this.getNodeSize('intent'),
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

            // 检查是否有子节点
            if (nodeData.child && Array.isArray(nodeData.child) && nodeData.child.length > 0) {
                // 检查子节点是否是意图节点（有intent属性）
                const hasChildIntents = nodeData.child.some(child => child.intent);
                
                if (hasChildIntents) {
                    // 递归处理子意图节点
                    nodeData.child.forEach(childNode => {
                        if (childNode.intent) {
                            processNode(currentNodeId, childNode, childNode.intent, level + 1);
                        }
                    });
                } else {
                    // 子节点是记录，直接显示
                    nodeData.child.forEach(record => {
                        const recordId = `record_${nodeId++}`;
                        const recordNode = {
                            id: recordId,
                            label: this.wrapLabel(this.truncateText(record.content || record.text || record.description || 'No content', 30), 12, 'record'),
                            type: 'record',
                            color: this.getNodeColor('record'),
                            size: this.getNodeSize('record'),
                            level: this.layout === 'hierarchical' ? level + 1 : undefined,
                            opacity: isImmutable ? 1 : 0.3,
                            title: this.formatRecordTooltip({
                                content: record.content || record.text || record.description || 'No content',
                                context: record.context || nodeData.description || '',
                                comment: record.comment || ''
                            })
                        };
                        nodes.push(recordNode);
                        this.nodeStates.set(recordId, isImmutable);

                        edges.push({
                            from: currentNodeId,
                            to: recordId,
                            arrows: 'to',
                            dashes: !isImmutable
                        });
                    });
                }
            } else if (nodeData.group && Array.isArray(nodeData.group)) {
                // 没有子节点但有group，显示group中的记录
                nodeData.group.forEach(record => {
                    const recordId = `record_${nodeId++}`;
                    const recordNode = {
                        id: recordId,
                        label: this.wrapLabel(this.truncateText(record.content || record.text || record.description || 'No content', 30), 12, 'record'),
                        type: 'record',
                        color: this.getNodeColor('record'),
                        size: this.getNodeSize('record'),
                        level: this.layout === 'hierarchical' ? level + 1 : undefined,
                        opacity: isImmutable ? 1 : 0.3,
                        title: this.formatRecordTooltip({
                            content: record.content || record.text || record.description || 'No content',
                            context: record.context || nodeData.description || '',
                            comment: record.comment || ''
                        })
                    };
                    nodes.push(recordNode);
                    this.nodeStates.set(recordId, isImmutable);

                    edges.push({
                        from: currentNodeId,
                        to: recordId,
                        arrows: 'to',
                        dashes: !isImmutable
                    });
                });
            } else {
                console.warn(`No valid child or group data found for intent "${nodeName}"`, nodeData);
            }
        };

        // 遍历每个意图组
        Object.entries(intentTree.item).forEach(([intentName, intentData], index) => {
            // Skip intents that start with 'remaining_intent_'
            if (intentName.startsWith('remaining_intent_')) {
                return;
            }

            // 处理每个意图节点
            processNode(rootId, intentData, intentName, 1);
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
            root: { background: '#ff7675', border: '#d63031' },    // 红色系
            intent: { background: '#74b9ff', border: '#0984e3' },  // 蓝色系
            record: { background: '#81ecec', border: '#00cec9' }   // 青色系
        };
        return colors[type] || { background: '#a29bfe', border: '#6c5ce7' };
    }

    // 获取节点大小
    getNodeSize(type) {
        const sizes = {
            root: 30,
            intent: 15,
            record: 10
        };
        return sizes[type] || 10;
    }

    // 更新节点状态
    updateNodeState(nodeId, confirmed) {
        this.nodeStates.set(nodeId, confirmed);
        
        // 如果是意图节点且被确认，添加到 immutable 集合中
        const node = this.nodes.get(nodeId);
        if (node && node.type === 'intent' && confirmed) {
            NetworkManager.immutableIntents.add(node.originalLabel || node.label);
        }
        
        this.nodes.update({
            id: nodeId,
            opacity: confirmed ? 1 : 0.3
        });

        this.updateEdgesForNode(nodeId);
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
        
        // 如果是根节点，添加"添加子意图"按钮
        if (nodeId === 'root') {
            const addChildBtn = this.createMenuItem(
                nodeId,
                'Add Child Intent',
                '#27ae60',
                '#2ecc71'
            );
            menu.appendChild(addChildBtn);
            this.setupAddChildIntentAction(addChildBtn, nodeId);
        }
        
        // 如果是意图节点，添加"编辑意图"按钮
        if (node.type === 'intent') {
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
                
                // 添加新节点到数据集
                this.nodes.add({
                    id: newNodeId,
                    label: this.wrapLabel(intentName, 15, 'intent'),
                    originalLabel: intentName,
                    type: 'intent',
                    color: this.getNodeColor('intent'),
                    size: this.getNodeSize('intent'),
                    level: this.layout === 'hierarchical' ? 1 : undefined,
                    opacity: 1,
                    fixed: false,
                    physics: false
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
        if (nodeId === 'root') {
            return; // 不允许删除根节点
        }
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
            if (node.type === 'intent' && this.intentTree.item) {
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
                if (deletedNode.type === 'intent') {
                    this.nodeStates.set(nodeId, NetworkManager.immutableIntents.has(deletedNode.originalLabel || deletedNode.label));
                }
                // 恢复意图树数据
                if (deletedNode.type === 'intent' && this.intentTree.item) {
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
        menuItem.parentElement.remove();
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
            
            // 等待布局稳定后进行初始缩放适配
            this.network.once('stabilized', () => {
                this.network.fit({
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            });

            // 添加网络可视化初始化完成的日志
            const nodes = this.nodes.get();
            window.Logger.log(window.LogCategory.UI, 'network_visualization_initialized', {
                total_nodes: nodes.length,
                edges_count: this.edges.length,
                intent_nodes: nodes.filter(node => node.type === 'intent').length,
                record_nodes: nodes.filter(node => node.type === 'record').length
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
                    type: 'cubicBezier',
                    forceDirection: this.layout === 'hierarchical' ? 
                        (NetworkManager.hierarchicalDirection === 'LR' ? 'horizontal' : 'vertical') : 
                        'none'
                },
                arrows: {
                    to: { enabled: true, scaleFactor: 0.5 }
                }
            },
            interaction: {
                dragNodes: true,
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
                zoomSpeed: 0.3  // 添加这个配置来减慢缩放速度
            },
            layout: {
                randomSeed: 1,
                improvedLayout: true
            }
        };

        // 根据布局类型设置不同的布局参数
        if (this.layout === 'hierarchical') {
            baseOptions.layout = {
                hierarchical: {
                    direction: NetworkManager.hierarchicalDirection, // 使用静态变量
                    sortMethod: 'directed',
                    levelSeparation: 150,
                    nodeSpacing: 100,
                    treeSpacing: 150,
                    blockShifting: true,
                    edgeMinimization: true,
                    parentCentralization: true
                }
            };
            // 在层级布局中禁用物理引擎以允许自由拖动
            baseOptions.physics = {
                enabled: false
            };
        } else {
            // 力导向布局的物理引擎参数
            baseOptions.physics = {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -3000,
                    centralGravity: 0.5,
                    springLength: 130,
                    springConstant: 0.08,
                    damping: 0.09,
                    avoidOverlap: 1
                },
                stabilization: {
                    enabled: true,
                    iterations: 1000,
                    updateInterval: 50
                }
            };
        }

        // 设置根节点固定在左侧
        const containerWidth = this.visContainer.clientWidth;
        const containerHeight = this.visContainer.clientHeight;
        this.nodes.get().forEach(node => {
            if (node.id === 'root') {
                this.nodes.update({
                    id: node.id,
                    fixed: true,
                    x: -containerWidth * 0.3,  // 将根节点固定在容器左侧30%的位置
                    y: containerHeight * 0.5    // 垂直居中
                });
            }
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

        // 点击节点显示菜单
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

        // 添加拖动开始事件
        this.network.on('dragStart', (params) => {
            if (params.nodes.length > 0) {
                this.container.style.cursor = 'grabbing';
            }
        });

        // 添加拖动结束事件
        this.network.on('dragEnd', (params) => {
            this.container.style.cursor = 'default';
        });

        // 添加选择事件
        this.network.on('select', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                if (node.type === 'record') {
                    // 高亮显示相关节点
                    this.highlightConnectedNodes(nodeId);
                }
            } else {
                // 取消高亮
                this.clearHighlight();
            }
        });
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
            if (NetworkManager.hierarchicalDirection !== 'LR') {
                updateButtonStyles(true);
                
                // 如果当前是层级布局，立即更新视图
                if (this.layout === 'hierarchical' && this.network) {
                    this.network.setOptions({
                        layout: {
                            hierarchical: {
                                direction: NetworkManager.hierarchicalDirection
                            }
                        },
                        edges: {
                            smooth: {
                                type: 'cubicBezier',
                                forceDirection: 'horizontal'
                            }
                        }
                    });
                }
            }
        });

        verticalBtn.addEventListener("click", () => {
            if (NetworkManager.hierarchicalDirection !== 'UD') {
                updateButtonStyles(false);
                
                // 如果当前是层级布局，立即更新视图
                if (this.layout === 'hierarchical' && this.network) {
                    this.network.setOptions({
                        layout: {
                            hierarchical: {
                                direction: NetworkManager.hierarchicalDirection
                            }
                        },
                        edges: {
                            smooth: {
                                type: 'cubicBezier',
                                forceDirection: 'vertical'
                            }
                        }
                    });
                }
            }
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