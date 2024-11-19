// 网络图配置和状态管理
class NetworkManager {
    constructor(records, containerArea = null, mode = 'standalone') {
        this.records = records;
        this.containerArea = containerArea;
        this.displayMode = mode; // 'standalone' or 'integrated'
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();
        this.nodeStates = new Map();
        this.network = null;
        this.container = null;
        this.visContainer = null;
    }

    // 初始化网络容器
    initContainer() {
        this.container = document.createElement("div");
        this.container.id = "networkVisualizationContainer";

        if (this.displayMode === 'standalone') {
            this.setupStandaloneContainer();
        } else {
            this.setupIntegratedContainer();
        }

        this.addCloseButton();
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
    // In networkVisualization.js, add to class NetworkManager
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
        this.visContainer.style.width = "100%";
        this.visContainer.style.height = "calc(100% - 40px)";
        this.container.appendChild(this.visContainer);
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

    // 初始化网络节点
    initializeNodes() {
        this.initializeCenterNode();
        this.initializeMiddleLayers();
        this.initializeRecordNodes();
    }

    // 初始化中心节点
    initializeCenterNode() {
        this.nodes.add({
            id: 'center',
            label: 'Main Goal',
            color: '#ff7675',
            shape: 'dot',
            size: 20,
            opacity: 1
        });
        this.nodeStates.set('center', true);
    }

    // 初始化中间层节点
    initializeMiddleLayers() {
        const middleLayer1 = ['Planning', 'Execution', 'Feedback'];
        const middleLayer2 = ['Task Analysis', 'Resource Prep', 'Progress', 'Quality Check'];

        this.createLayerNodes(middleLayer1, 1);
        this.createLayerNodes(middleLayer2, 2);
    }

    // 创建层级节点
    createLayerNodes(layer, level) {
        layer.forEach((label, index) => {
            const id = `l${level}_${index}`;
            const fromId = level === 1 ? 'center' : `l1_${Math.floor(index / 2)}`;

            this.nodes.add({
                id: id,
                label: label,
                color: {
                    background: level === 1 ?
                        'rgba(116, 185, 255, 0.5)' :
                        'rgba(162, 155, 254, 0.5)'
                },
                shape: 'dot',
                size: level === 1 ? 15 : 12,
                opacity: 0.3
            });
            this.nodeStates.set(id, false);

            this.edges.add({
                id: `e_${fromId}_${id}`,
                from: fromId,
                to: id,
                dashes: true
            });
        });
    }

    // 初始化记录节点
    initializeRecordNodes() {
        this.records.forEach((record, index) => {
            const id = `record_${index}`;
            const content = record.type === 'text' ?
                record.content.substring(0, 5) + '...' :
                'Image ' + (index + 1);
            const fromId = `l2_${index % 4}`;

            this.nodes.add({
                id: id,
                label: content,
                color: '#81ecec',
                shape: 'dot',
                size: 10,
                opacity: 0.3
            });
            this.nodeStates.set(id, false);

            this.edges.add({
                id: `e_${fromId}_${id}`,
                from: fromId,
                to: id,
                dashes: true
            });
        });
    }

    // 更新节点状态
    updateNodeState(nodeId, confirmed) {
        this.nodeStates.set(nodeId, confirmed);
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
    createNodeMenu(nodeId, x, y) {
        const menu = document.createElement('div');
        this.setupNodeMenu(menu, x, y);
        this.addMenuItems(menu, nodeId);
        document.body.appendChild(menu);
        this.setupMenuCloseEvent(menu);
    }

    // 设置节点菜单样式
    setupNodeMenu(menu, x, y) {
        menu.id = 'nodeMenu';
        Object.assign(menu.style, {
            position: 'absolute',
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

    // 添加菜单项
    addMenuItems(menu, nodeId) {
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
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // 初始化网络图
    initializeNetwork() {
        const options = {
            physics: {
                stabilization: true,
                barnesHut: {
                    gravitationalConstant: -2000,
                    springLength: 200,
                    springConstant: 0.04
                }
            },
            layout: {
                hierarchical: {
                    enabled: false
                }
            },
            interaction: {
                hover: true
            }
        };

        this.network = new vis.Network(this.visContainer, {
            nodes: this.nodes,
            edges: this.edges
        }, options);

        this.setupNetworkEvents();
    }

    // 设置网络图事件
    setupNetworkEvents() {
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const canvasPosition = params.pointer.canvas;
                const DOMPosition = this.network.canvasToDOM(canvasPosition);
                this.createNodeMenu(nodeId, DOMPosition.x, DOMPosition.y);
            }
        });
    }
}

// 主函数
function showNetworkVisualization(records, containerArea = null) {
    try {
        if (typeof vis === 'undefined') {
            console.error('Vis.js not loaded');
            alert('Network visualization library not loaded properly. Please try again.');
            return;
        }

        const mode = containerArea ? 'integrated' : 'standalone';
        console.log('networkVisualizationContainer mode: ', mode);
        const networkManager = new NetworkManager(records, containerArea, mode);
        networkManager.initContainer();
        networkManager.initializeNodes();
        networkManager.initializeNetwork();

        isNetworkVisible = true;
        return networkManager; // Return instance for potential mode switching

    } catch (error) {
        console.error('Error in network visualization:', error);
        alert('An error occurred while creating the network visualization.');
    }
}