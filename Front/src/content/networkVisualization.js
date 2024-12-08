// 网络图配置和状态管理
class NetworkManager {
    static activeNodeMenu = false;  // 跟踪节点菜单状态
    static immutableIntents = new Set();  // 存储所有 immutable 的意图名称

    constructor(intentTree, containerArea = null, mode = 'standalone') {
        this.intentTree = intentTree;
        this.containerArea = containerArea;
        this.displayMode = mode;
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

        console.log('intentTree:', JSON.stringify(this.intentTree, null, 2));

        try {
            const { nodes, edges } = this.transformIntentTreeToNetwork(this.intentTree);
            this.nodes.add(nodes);
            this.edges.add(edges);
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
        nodes.push({
            id: rootId,
            label: intentTree.scenario || 'Current Task',
            type: 'root',
            color: this.getNodeColor('root'),
            size: this.getNodeSize('root'),
            opacity: 1,  // 设置为完全不透明，表示已确认状态
            fixed: true,   // 固定根节点位置
            physics: false // 禁用物理引擎对根节点的影响
        });
        // 设置根节点的初始状态为已确认
        this.nodeStates.set(rootId, true);

        // 遍历每个意图组
        Object.entries(intentTree.item).forEach(([intentName, records], index) => {
            // Skip intents that start with 'remaining_intent_'
            if (intentName.startsWith('remaining_intent_')) {
                return;
            }

            const intentId = `intent_${nodeId++}`;
            const isImmutable = NetworkManager.immutableIntents.has(intentName);
            
            nodes.push({
                id: intentId,
                label: intentName,
                type: 'intent',
                color: this.getNodeColor('intent'),
                size: this.getNodeSize('intent'),
                opacity: isImmutable ? 1 : 0.3  // 如果是 immutable，设置为不透明
            });
            // 设置意图节点的初始状态
            this.nodeStates.set(intentId, isImmutable);

            // 连接根节点到意图节点
            edges.push({
                from: rootId,
                to: intentId,
                arrows: 'to',
                dashes: !isImmutable  // 如果是 immutable，使用实线
            });

            // 处理记录
            if (Array.isArray(records)) {
                records.forEach(record => {
                    const recordId = `record_${nodeId++}`;
                    nodes.push({
                        id: recordId,
                        label: this.truncateText(record.content, 30),
                        type: 'record',
                        color: this.getNodeColor('record'),
                        size: this.getNodeSize('record'),
                        opacity: isImmutable ? 1 : 0.3,  // 如果父意图是 immutable，子节点也设置为不透明
                        title: this.formatRecordTooltip(record)  // 设置悬停提示
                    });
                    // 设置记录节点的初始状态与父意图节点一致
                    this.nodeStates.set(recordId, isImmutable);

                    // 连接意图节点到记录节点
                    edges.push({
                        from: intentId,
                        to: recordId,
                        arrows: 'to',
                        dashes: !isImmutable  // 如果父意图是 immutable，使用实线
                    });
                });
            }
        });

        return { nodes, edges };
    }

    // 辅助方法：截断文本
    truncateText(text, maxLength) {
        if (!text) return 'No content';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // 辅助方法：格式化记录的悬停提示
    formatRecordTooltip(record) {
        const content = record.content?.trim() || 'N/A';
        const context = record.context?.trim() || 'N/A';
        const comment = record.comment?.trim() || 'N/A';
        
        return `Content: ${content}
Context: ${context}
Comment: ${comment}`;
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
            root: 30,    // 根节点最大
            intent: 25,  // 意图节点中等
            record: 20   // 记录节点最小
        };
        return sizes[type] || 15;
    }

    // 更新节点状态
    updateNodeState(nodeId, confirmed) {
        this.nodeStates.set(nodeId, confirmed);
        
        // 如果是意图节点且被确认，添加到 immutable 集合中
        const node = this.nodes.get(nodeId);
        if (node && node.type === 'intent' && confirmed) {
            NetworkManager.immutableIntents.add(node.label);
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
        
        // 获取节点的DOM位置
        const nodePosition = this.network.getPositions([nodeId])[nodeId];
        const domPosition = this.network.canvasToDOM(nodePosition);
        
        // 获取容器的位置信息
        const containerRect = this.container.getBoundingClientRect();
        
        // 计算菜单的实际位置，需要加上容器的偏移
        const menuX = domPosition.x + containerRect.left;
        const menuY = domPosition.y + containerRect.top;
        
        // 获取节点的大小信息
        const node = this.nodes.get(nodeId);
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
            transform: 'translate(-50%, -100%)', // 水平居中并向上偏移菜单自身高度
            left: x + 'px',
            top: y + 'px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '5px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: '10001'
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
            padding: '5px 10px',
            cursor: 'pointer',
            color: color,
            fontWeight: '500',
            borderBottom: text.includes('Confirmed') ? '1px solid #eee' : 'none'
        });
        item.textContent = text;

        this.setupMenuItemEvents(item, color, hoverColor);
        this.setupMenuItemAction(item, nodeId, text);

        return item;
    }

    // 设置菜单项事件
    setupMenuItemEvents(item, color, hoverColor) {
        item.addEventListener('mouseover', () => {
            item.style.backgroundColor = '#f0f0f0';
            item.style.color = hoverColor;
        });
        item.addEventListener('mouseout', () => {
            item.style.backgroundColor = 'white';
            item.style.color = color;
        });
    }

    // 设置菜单项动作
    setupMenuItemAction(item, nodeId, text) {
        if (text.includes('Node')) {
            item.onclick = () => this.deleteNode(nodeId, item);
        } else {
            item.onclick = () => this.toggleNodeState(nodeId, item);
        }
    }

    // 设置添加子意图节点的动作
    setupAddChildIntentAction(menuItem, nodeId) {
        menuItem.onclick = async () => {
            // 创建对话框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
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
            const title = document.createElement('h3');
            title.textContent = 'Add New Intent';
            title.style.cssText = `
                margin: 0 0 15px 0;
                color: #2d3436;
            `;

            // 创建输入框
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Enter intent name';
            input.value = 'New Intent ' + (Object.keys(this.intentTree.item || {}).length + 1);
            input.style.cssText = `
                width: 100%;
                padding: 8px;
                margin-bottom: 15px;
                border: 1px solid #dfe6e9;
                border-radius: 4px;
                box-sizing: border-box;
            `;

            // 创建按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            `;

            // 创建确认按钮
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirm';
            confirmButton.style.cssText = `
                padding: 6px 12px;
                background: #27ae60;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;

            // 创建取消按钮
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = `
                padding: 6px 12px;
                background: #95a5a6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;

            // 添加按钮事件
            confirmButton.onclick = async () => {
                const intentName = input.value.trim();
                if (!intentName) {
                    alert('Please enter an intent name');
                    return;
                }

                const newNodeId = 'intent_' + (this.nodes.length + 1);
                
                // 添加新节点到数据集
                this.nodes.add({
                    id: newNodeId,
                    label: intentName,
                    type: 'intent',
                    color: this.getNodeColor('intent'),
                    size: this.getNodeSize('intent'),
                    opacity: 1  // 设置为已确认状态
                });

                // 添加连接边
                this.edges.add({
                    from: nodeId,
                    to: newNodeId,
                    arrows: 'to',
                    dashes: false  // 实线表示已确认状态
                });

                // 设置新节点状态为已确认
                this.updateNodeState(newNodeId, true);  // 使用updateNodeState来确保一致的状态更新
                
                // 更新意图树数据
                if (!this.intentTree.item) {
                    this.intentTree.item = {};
                }
                this.intentTree.item[intentName] = [];

                // 持久化更新后的意图树
                try {
                    await saveIntentTree(this.intentTree);
                    console.log('Intent tree updated and saved successfully');
                } catch (error) {
                    console.error('Error saving intent tree:', error);
                    alert('Failed to save the new intent. Please try again.');
                    
                    // 如果保存失败，回滚更改
                    this.nodes.remove(newNodeId);
                    this.edges.remove({ from: nodeId, to: newNodeId });
                    this.nodeStates.delete(newNodeId);
                    NetworkManager.immutableIntents.delete(intentName);
                    if (this.intentTree.item[intentName]) {
                        delete this.intentTree.item[intentName];
                    }
                }

                // 关闭对话框和菜单
                document.body.removeChild(dialog);
            };

            cancelButton.onclick = () => {
                document.body.removeChild(dialog);
            };

            // 组装对话框
            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(confirmButton);
            dialog.appendChild(title);
            dialog.appendChild(input);
            dialog.appendChild(buttonContainer);
            document.body.appendChild(dialog);

            // 聚焦输入框并选中默认文本
            input.focus();
            input.select();

            // 添加按下回车键确认的功能
            input.addEventListener('keyup', (event) => {
                if (event.key === 'Enter') {
                    confirmButton.click();
                } else if (event.key === 'Escape') {
                    cancelButton.click();
                }
            });
        };
    }

    // 删除节点
    deleteNode(nodeId, menuItem) {
        if (nodeId !== 'center') {
            this.nodes.remove(nodeId);
            this.edges.forEach(edge => {
                if (edge.from === nodeId || edge.to === nodeId) {
                    this.edges.remove(edge.id);
                }
            });
        }
        menuItem.parentElement.remove();
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
        }, 100);
    }

    getNetworkOptions() {
        const baseOptions = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: {
                    size: 14,
                    color: '#333'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2,
                smooth: {
                    type: 'continuous'
                },
                arrows: {
                    to: { enabled: true, scaleFactor: 0.5 }
                }
            },
            physics: {
                enabled: true,
                stabilization: {
                    enabled: true,
                    iterations: 1000
                },
                hierarchicalRepulsion: {
                    nodeDistance: 120
                }
            },
            interaction: {
                dragNodes: function (node) {
                    return node.id !== 'root'; // 禁止拖动根节点
                }
            }
        };

        // 为侧边栏模式添加特殊配置
        if (this.displayMode === 'sidepanel') {
            return {
                ...baseOptions,
                nodes: {
                    ...baseOptions.nodes,
                    size: 12, // 更小的节点
                    font: {
                        size: 12, // 更小的字体
                        color: '#333'
                    }
                },
                physics: {
                    ...baseOptions.physics,
                    stabilization: {
                        enabled: true,
                        iterations: 500 // 减少迭代次数以加快加载
                    },
                    barnesHut: {
                        gravitationalConstant: -2000,
                        centralGravity: 0.1,
                        springLength: 95,
                        springConstant: 0.04,
                        damping: 0.09
                    }
                },
                interaction: {
                    dragNodes: true,
                    dragView: true,
                    zoomView: true,
                    hover: true,
                    multiselect: false,
                    keyboard: false
                }
            };
        }

        return baseOptions;
    }

    // 设置网络事件
    setupNetworkEvents() {
        // 点击节点显示菜单
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                // 直接使用节点位置创建菜单
                this.createNodeMenu(nodeId);
            }
        });

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
        // 创建新的意图树结构
        const newIntentTree = {
            scenario: this.intentTree.scenario,
            child: []
        };
        
        // 遍历所有节点状态
        if (this.intentTree.item) {
            let idCounter = 1; // 用于生成唯一的ID
            Object.keys(this.intentTree.item).forEach(intentName => {
                // 跳过以 'remaining_intent_' 开头的意图
                if (intentName.startsWith('remaining_intent_')) {
                    return;
                }

                // 创建意图对象
                const intentObj = {
                    id: idCounter++,
                    intent: intentName,
                    isLeafNode: false,
                    // 如果意图名称在 immutableIntents 中，就标记为 immutable
                    immutable: NetworkManager.immutableIntents.has(intentName),
                    child: this.intentTree.item[intentName] || [],
                    child_num: (this.intentTree.item[intentName] || []).length,
                    priority: 1
                };

                newIntentTree.child.push(intentObj);
            });
        }

        console.log('Intent tree with states:', JSON.stringify(newIntentTree, null, 2));
        console.log('Immutable intents:', Array.from(NetworkManager.immutableIntents));
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
                    width: "40vw",
                    maxWidth: "600px"
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
        closeBtn.textContent = "×";
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
async function showNetworkVisualization(intentTree, containerArea = null, mode = 'standalone') {
    try {
        if (typeof vis === 'undefined') {
            console.error('Vis.js not loaded');
            alert('Network visualization library not loaded properly. Please try again.');
            return;
        }

        console.log('Visualization data:', intentTree);
        console.log('networkVisualizationContainer mode:', mode);

        // save intentTree
        await saveIntentTree(intentTree);
        
        this.intentTree = intentTree;
        const networkManager = new NetworkManager(intentTree, containerArea, mode);
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