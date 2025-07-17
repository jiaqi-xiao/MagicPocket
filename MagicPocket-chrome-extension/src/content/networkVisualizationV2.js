// NetworkVisualizationV2.js - 完全重构的多层意图拖拽重组系统
// 专为拖拽重组功能设计的简洁高效实现

class NetworkVisualizationV2 {
    constructor(intentTree, containerArea = null, mode = 'standalone') {
        this.intentTree = intentTree;
        this.containerArea = containerArea;
        this.displayMode = mode;
        
        // 核心数据结构
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();
        this.network = null;
        this.container = null;
        
        // 拖拽重组状态
        this.dragState = {
            isDragging: false,
            draggedNodeId: null,
            draggedSubtree: new Set(),
            targetNode: null,
            originalOpacities: new Map(),
            dropZoneRadius: 80
        };
        
        // 节点关系映射
        this.nodeRelations = {
            parents: new Map(),     // nodeId -> parentId
            children: new Map(),    // nodeId -> [childIds]
            nodeTypes: new Map()    // nodeId -> type
        };
        
        console.log('NetworkVisualizationV2 initialized');
    }

    // 主要初始化方法
    async initialize() {
        try {
            this.createContainer();
            this.buildNetworkData();
            this.createNetwork();
            this.setupEventHandlers();
            console.log('V2 Network visualization ready');
        } catch (error) {
            console.error('Failed to initialize V2 network:', error);
            throw error;
        }
    }

    // 创建容器
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'networkVisualizationV2Container';
        
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '85vw',
            height: '85vh',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: '10000',
            overflow: 'hidden'
        });

        // 添加标题栏
        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; background: linear-gradient(135deg, #ff7675, #fd79a8);">
                <h3 style="margin: 0; color: white; font-size: 16px; font-weight: 600;">🚀 Multi-Level Network V2 - Drag & Drop</h3>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="autoLayoutBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 12px; padding: 6px 12px; border-radius: 16px; cursor: pointer; transition: all 0.2s;">📐 Auto Layout</button>
                    <button id="closeV2Network" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 18px; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>
            </div>
        `;
        
        // 添加网络容器
        const networkContainer = document.createElement('div');
        networkContainer.id = 'v2NetworkContainer';
        Object.assign(networkContainer.style, {
            width: '100%',
            height: 'calc(100% - 64px)',
            position: 'relative'
        });

        this.container.appendChild(header);
        this.container.appendChild(networkContainer);
        document.body.appendChild(this.container);

        // 关闭按钮事件
        header.querySelector('#closeV2Network').onclick = () => this.cleanup();
        
        // 自动排版按钮事件
        const autoLayoutBtn = header.querySelector('#autoLayoutBtn');
        autoLayoutBtn.onclick = () => {
            autoLayoutBtn.style.background = 'rgba(255,255,255,0.4)';
            this.resetToTreeLayout();
            setTimeout(() => {
                autoLayoutBtn.style.background = 'rgba(255,255,255,0.2)';
            }, 200);
        };
        
        // 按钮悬停效果
        autoLayoutBtn.onmouseover = () => {
            autoLayoutBtn.style.background = 'rgba(255,255,255,0.3)';
        };
        autoLayoutBtn.onmouseout = () => {
            autoLayoutBtn.style.background = 'rgba(255,255,255,0.2)';
        };
    }

    // 构建网络数据
    buildNetworkData() {
        const nodes = [];
        const edges = [];
        let nodeId = 1;

        if (!this.intentTree?.item) {
            console.warn('No intent tree data');
            return;
        }

        // 获取所有低级意图节点
        const lowIntents = Object.keys(this.intentTree.item).filter(name => 
            !name.startsWith('remaining_intent_')
        );
        
        // 为演示创建多个高级意图节点，每个包含1-2个低级意图
        const highIntentGroups = this.createHighIntentGroups(lowIntents);
        
        // 布局参数
        const containerWidth = 800; // 假设容器宽度
        const levelHeight = 180;
        const baseY = -200;
        
        // 创建高级意图节点
        const highNodeSpacing = Math.max(150, containerWidth * 0.8 / (highIntentGroups.length + 1));
        const highTotalWidth = (highIntentGroups.length - 1) * highNodeSpacing;
        const highStartX = -highTotalWidth / 2;
        
        highIntentGroups.forEach((intentGroup, index) => {
            const highId = `high_${nodeId++}`;
            
            nodes.push({
                id: highId,
                label: this.formatLabel(`h-Intent-${index + 1}`, 'high'),
                type: 'high-intent',
                level: 0,
                x: highStartX + index * highNodeSpacing,
                y: baseY,
                color: { background: '#ff7675', border: '#d63031' },
                size: 25,
                opacity: 0.4, // 默认半透明
                font: { size: 16, color: '#333', bold: true },
                fixed: { x: false, y: false }, // 允许自由移动
                title: this.formatIntentTooltip(`h-Intent-${index + 1}`, 'high-intent', intentGroup.length)
            });

            this.nodeRelations.children.set(highId, []);
            this.nodeRelations.nodeTypes.set(highId, 'high-intent');

            // 创建低级意图节点
            const validIntents = intentGroup.filter(name => name && this.intentTree.item[name]);
            
            validIntents.forEach((intentName, lowIndex) => {
                const intent = { name: intentName, data: this.intentTree.item[intentName] };
                const lowId = `low_${nodeId++}`;
                
                // 计算低级意图节点的位置
                const lowY = baseY + levelHeight;
                let lowX = highStartX + index * highNodeSpacing;
                
                // 如果该高级意图有多个低级意图，进行水平分布
                if (validIntents.length > 1) {
                    const lowSpacing = 100; // 同父节点下子节点的间距
                    const lowTotalWidth = (validIntents.length - 1) * lowSpacing;
                    lowX = lowX - lowTotalWidth / 2 + lowIndex * lowSpacing;
                }
                
                nodes.push({
                    id: lowId,
                    label: this.formatLabel(intent.name, 'low'),
                    type: 'low-intent',
                    level: 1,
                    x: lowX,
                    y: lowY,
                    color: { background: '#74b9ff', border: '#0984e3' },
                    size: 20,
                    opacity: 0.3, // 默认半透明
                    font: { size: 14, color: '#333' },
                    fixed: { x: false, y: false }, // 允许自由移动
                    title: this.formatIntentTooltip(intent.name, 'low-intent', intent.data?.group?.length || 0)
                });

                // 建立关系
                this.nodeRelations.parents.set(lowId, highId);
                this.nodeRelations.children.get(highId).push(lowId);
                this.nodeRelations.children.set(lowId, []);
                this.nodeRelations.nodeTypes.set(lowId, 'low-intent');

                // 创建连接
                edges.push({
                    from: highId,
                    to: lowId,
                    arrows: 'to',
                    width: 2,
                    dashes: [5, 5] // 虚线表示待确认
                });

                // 创建记录节点
                if (intent.data?.group?.length) {
                    intent.data.group.forEach((record, recordIndex) => {
                        const recordId = `record_${nodeId++}`;
                        
                        // 计算记录节点的位置
                        const recordY = baseY + levelHeight * 2;
                        let recordX = lowX;
                        
                        // 如果该低级意图有多个记录，进行水平分布
                        if (intent.data.group.length > 1) {
                            const recordSpacing = 80; // 同父节点下记录节点的间距
                            const recordTotalWidth = (intent.data.group.length - 1) * recordSpacing;
                            recordX = recordX - recordTotalWidth / 2 + recordIndex * recordSpacing;
                        }
                        
                        nodes.push({
                            id: recordId,
                            label: this.formatLabel(record.content || 'Record', 'record'),
                            type: 'record',
                            level: 2,
                            x: recordX,
                            y: recordY,
                            color: { background: '#81ecec', border: '#00cec9' },
                            size: 10,
                            opacity: 0.3,
                            font: { size: 12, color: '#333' },
                            fixed: { x: false, y: false }, // 允许自由移动
                            title: this.formatTooltipContent(record.content || 'No content', record.comment || 'No comment')
                        });

                        // 建立关系
                        this.nodeRelations.parents.set(recordId, lowId);
                        this.nodeRelations.children.get(lowId).push(recordId);
                        this.nodeRelations.nodeTypes.set(recordId, 'record');

                        // 创建连接
                        edges.push({
                            from: lowId,
                            to: recordId,
                            arrows: 'to',
                            width: 1,
                            dashes: [3, 3]
                        });
                    });
                }
            });
        });

        this.nodes.add(nodes);
        this.edges.add(edges);
        
        console.log('Network data built:', { nodes: nodes.length, edges: edges.length });
    }

    // 创建高级意图分组 - 简单的演示分组逻辑
    createHighIntentGroups(lowIntents) {
        const groups = [];
        const groupSize = 2; // 每个高级意图包含最多2个低级意图
        
        for (let i = 0; i < lowIntents.length; i += groupSize) {
            groups.push(lowIntents.slice(i, i + groupSize));
        }
        
        // 确保至少有2个高级意图用于演示
        if (groups.length < 2) {
            // 如果低级意图太少，创建一些空的高级意图用于演示
            while (groups.length < 3) {
                groups.push([]);
            }
        }
        
        return groups;
    }

    // 格式化标签
    formatLabel(text, type) {
        const maxLength = type === 'high' ? 20 : type === 'low' ? 16 : 12;
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    // 格式化工具提示内容
    formatTooltipContent(content, comment) {
        // 限制单行内容长度，超长时自动换行
        const formatText = (text, label) => {
            if (!text || text === 'No content' || text === 'No comment') {
                return `${label}: ${text}`;
            }
            
            // 将长文本按50字符换行，提高可读性
            const lines = [];
            let currentLine = '';
            const words = text.split(/\s+/);
            
            for (const word of words) {
                if ((currentLine + word).length <= 50) {
                    currentLine += (currentLine ? ' ' : '') + word;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            
            const formattedText = lines.join('\n  '); // 缩进续行
            return `${label}: ${formattedText}`;
        };
        
        const contentLine = formatText(content, 'Content');
        const commentLine = formatText(comment, 'Comment');
        
        return `${contentLine}\n\n${commentLine}`;
    }

    // 格式化意图节点工具提示
    formatIntentTooltip(intentName, nodeType, childrenCount) {
        const typeLabel = nodeType === 'high-intent' ? 'High-Level Intent' : 'Low-Level Intent';
        const childrenLabel = nodeType === 'high-intent' ? 'Low-level intents' : 'Records';
        
        // 格式化意图名称，按50字符换行
        const formatIntentName = (name) => {
            if (name.length <= 50) return name;
            
            const lines = [];
            let currentLine = '';
            const words = name.split(/\s+/);
            
            for (const word of words) {
                if ((currentLine + word).length <= 50) {
                    currentLine += (currentLine ? ' ' : '') + word;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            
            return lines.join('\n  ');
        };
        
        const formattedName = formatIntentName(intentName);
        
        return `Type: ${typeLabel}\nIntent: ${formattedName}\n${childrenLabel}: ${childrenCount}`;
    }

    // 创建网络
    createNetwork() {
        const container = document.getElementById('v2NetworkContainer');
        
        const options = {
            nodes: {
                shape: 'dot',
                borderWidth: 2,
                shadow: { enabled: true, size: 5, x: 2, y: 2 },
                chosen: { node: true },
                font: { 
                    multi: false,
                    strokeWidth: 0,
                    strokeColor: 'transparent'
                }
            },
            edges: {
                smooth: { type: 'dynamic' },
                color: { color: '#848484', highlight: '#ff6b6b' },
                arrows: {
                    to: { enabled: true, scaleFactor: 0.8 }
                }
            },
            physics: {
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
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                hover: true,
                tooltipDelay: 300
            },
            layout: {
                randomSeed: 42
            }
        };

        this.network = new vis.Network(container, {
            nodes: this.nodes,
            edges: this.edges
        }, options);

        // 添加工具提示样式限制
        this.injectTooltipStyles();

        // 初始布局已在节点创建时设置，不需要额外调用

        console.log('Network created successfully');
    }

    // 注入工具提示样式
    injectTooltipStyles() {
        // 检查是否已经注入样式
        if (document.getElementById('vis-tooltip-styles-v2')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'vis-tooltip-styles-v2';
        style.textContent = `
            /* vis.js 工具提示样式优化 */
            .vis-tooltip {
                max-width: 300px !important;
                min-width: 150px !important;
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
                word-break: break-word !important;
                line-height: 1.4 !important;
                padding: 10px 14px !important;
                font-size: 13px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                background: #ffffff !important;
                color: #333333 !important;
                border: 1px solid #e0e0e0 !important;
                border-radius: 8px !important;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15) !important;
                z-index: 10005 !important;
            }
            
            /* 确保长文本能够换行 */
            .vis-tooltip div {
                max-width: 100% !important;
                word-wrap: break-word !important;
                white-space: pre-wrap !important;
                color: #333333 !important;
            }
        `;
        
        document.head.appendChild(style);
        console.log('Tooltip styles injected for width limitation');
    }


    // 设置事件处理
    setupEventHandlers() {
        // 拖拽开始
        this.network.on('dragStart', (params) => {
            if (params.nodes.length === 1) {
                this.startDrag(params.nodes[0]);
            }
        });

        // 拖拽中
        this.network.on('dragging', (params) => {
            if (this.dragState.isDragging) {
                this.updateDragTarget(params);
            }
        });

        // 拖拽结束
        this.network.on('dragEnd', () => {
            if (this.dragState.isDragging) {
                this.endDrag();
            }
        });

        // 点击事件
        this.network.on('click', (params) => {
            if (params.nodes.length === 1) {
                this.toggleNodeConfirmation(params.nodes[0]);
            }
        });

        // 右键菜单事件
        this.network.on('oncontext', (params) => {
            params.event.preventDefault();
            
            // 检查是否右键点击在节点上
            const nodeId = this.network.getNodeAt(params.pointer.DOM);
            if (nodeId) {
                // 直接显示右键菜单，无需先选中节点
                this.showContextMenu(nodeId, params.pointer.DOM);
            }
        });

        console.log('Event handlers setup complete');
    }

    // 开始拖拽
    startDrag(nodeId) {
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        
        // 所有节点类型都允许拖拽
        if (nodeType === 'high-intent' || nodeType === 'low-intent' || nodeType === 'record') {
            this.dragState.isDragging = true;
            this.dragState.draggedNodeId = nodeId;
            
            // 对于Record节点，只拖拽自身；对于Intent节点，拖拽整个子树
            if (nodeType === 'record') {
                this.dragState.draggedSubtree = new Set([nodeId]);
            } else {
                this.dragState.draggedSubtree = this.getSubtree(nodeId);
            }

            // 设置子树透明度
            this.dragState.draggedSubtree.forEach(id => {
                const node = this.nodes.get(id);
                if (node) { // 检查节点是否存在
                    this.dragState.originalOpacities.set(id, node.opacity);
                    this.nodes.update({ id, opacity: 0.2 });
                } else {
                    // 如果节点不存在，从子树中移除
                    this.dragState.draggedSubtree.delete(id);
                    console.warn(`Node ${id} not found, removed from subtree`);
                }
            });

            console.log('Reorganization drag started:', nodeId, 'Type:', nodeType, 'Subtree:', Array.from(this.dragState.draggedSubtree));
        }
        
        return true;
    }

    // 更新拖拽目标
    updateDragTarget(params) {
        const dragPos = params.pointer.canvas;
        let closestTarget = null;
        let minDistance = this.dragState.dropZoneRadius;

        // 检查所有意图节点
        this.nodes.get().forEach(node => {
            if (this.isValidDropTarget(node.id)) {
                const nodePos = this.network.getPositions([node.id])[node.id];
                const distance = Math.sqrt(
                    Math.pow(dragPos.x - nodePos.x, 2) + 
                    Math.pow(dragPos.y - nodePos.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    closestTarget = node;
                }
            }
        });

        // 更新目标高亮
        if (closestTarget !== this.dragState.targetNode) {
            this.clearTargetHighlight();
            this.dragState.targetNode = closestTarget;
            if (closestTarget) {
                this.highlightDropTarget(closestTarget.id);
            }
        }
    }

    // 检查是否为有效拖拽目标
    isValidDropTarget(nodeId) {
        const node = this.nodes.get(nodeId);
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        
        return node && // 节点必须存在
               (nodeType === 'high-intent' || nodeType === 'low-intent') && 
               !this.dragState.draggedSubtree.has(nodeId);
    }

    // 高亮拖拽目标
    highlightDropTarget(nodeId) {
        const node = this.nodes.get(nodeId);
        this.nodes.update({
            id: nodeId,
            borderWidth: 4,
            color: {
                ...node.color,
                border: '#ff6b6b'
            },
            shadow: { enabled: true, size: 10, color: '#ff6b6b' }
        });
    }

    // 清除目标高亮
    clearTargetHighlight() {
        if (this.dragState.targetNode) {
            const nodeType = this.nodeRelations.nodeTypes.get(this.dragState.targetNode.id);
            const originalColor = this.getNodeColor(nodeType);
            
            this.nodes.update({
                id: this.dragState.targetNode.id,
                borderWidth: 2,
                color: originalColor,
                shadow: { enabled: true, size: 5 }
            });
        }
    }

    // 结束拖拽
    endDrag() {
        console.log('Drag ended. Target:', this.dragState.targetNode?.id);

        if (this.dragState.targetNode) {
            this.performReorganization();
        } else {
            this.restoreOriginalState();
        }

        this.clearDragState();
    }

    // 执行重组
    performReorganization() {
        const sourceId = this.dragState.draggedNodeId;
        const targetId = this.dragState.targetNode.id;
        
        const sourceType = this.nodeRelations.nodeTypes.get(sourceId);
        const targetType = this.nodeRelations.nodeTypes.get(targetId);

        console.log(`Reorganizing: ${sourceType}(${sourceId}) -> ${targetType}(${targetId})`);

        // 显示碰撞检测对话框
        this.showCollisionDialog(sourceId, targetId, sourceType, targetType);
    }

    // 显示碰撞检测对话框
    showCollisionDialog(sourceId, targetId, sourceType, targetType) {
        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);
        
        // 根据节点类型确定可用选项
        const options = this.getCollisionOptions(sourceType, targetType);
        
        if (options.length === 0) {
            // 不允许的操作
            this.showNotAllowedMessage(sourceType, targetType);
            this.restoreOriginalState();
            this.clearDragState();
            return;
        }

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.id = 'collisionDialog';
        dialog.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 10001;
                min-width: 320px;
                max-width: 480px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px; font-weight: 600;">
                    Node Reorganization Options
                </h3>
                <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #666;">
                    <div><strong>Source Node:</strong> ${sourceNode.label} (${this.getNodeTypeLabel(sourceType)})</div>
                    <div style="margin-top: 4px;"><strong>Target Node:</strong> ${targetNode.label} (${this.getNodeTypeLabel(targetType)})</div>
                </div>
                <div style="margin: 20px 0;">
                    ${options.map(option => `
                        <button 
                            class="collision-option-btn"
                            data-action="${option.action}"
                            style="
                                display: block;
                                width: 100%;
                                padding: 12px 16px;
                                margin: 8px 0;
                                background: ${option.primary ? '#007bff' : '#6c757d'};
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 14px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';"
                        >
                            ${option.icon} ${option.label}
                        </button>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button id="cancelReorganization" style="
                        flex: 1;
                        padding: 10px 16px;
                        background: #f8f9fa;
                        color: #666;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // 绑定事件
        dialog.querySelectorAll('.collision-option-btn').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                this.executeReorganization(sourceId, targetId, action);
                dialog.remove();
            };
        });

        document.getElementById('cancelReorganization').onclick = () => {
            this.restoreOriginalState();
            this.clearDragState();
            dialog.remove();
        };
    }

    // 获取节点类型标签
    getNodeTypeLabel(type) {
        const labels = {
            'high-intent': 'High-Level Intent',
            'low-intent': 'Low-Level Intent',
            'record': 'Record'
        };
        return labels[type] || type;
    }

    // 获取碰撞选项
    getCollisionOptions(sourceType, targetType) {
        const options = [];
        
        if (sourceType === 'high-intent' && targetType === 'high-intent') {
            options.push(
                { action: 'merge', label: 'Merge Nodes', icon: '🔗', primary: true },
                { action: 'attach', label: 'Demote as Child', icon: '🔻', primary: false }
            );
        } else if (sourceType === 'low-intent' && targetType === 'low-intent') {
            // Low-Level Intent 之间只能合并，不能设为子节点
            options.push(
                { action: 'merge', label: 'Merge Nodes', icon: '🔗', primary: true }
            );
        } else if (sourceType === 'record' && targetType === 'low-intent') {
            options.push(
                { action: 'attach', label: 'Attach as Child', icon: '📎', primary: true }
            );
        } else if (sourceType === 'low-intent' && targetType === 'high-intent') {
            options.push(
                { action: 'attach', label: 'Move to High-Intent', icon: '📎', primary: true }
            );
        } else if (sourceType === 'high-intent' && targetType === 'low-intent') {
            options.push(
                { action: 'merge', label: 'Demote & Merge', icon: '🔻', primary: true }
            );
        }
        
        return options;
    }

    // 显示不允许操作的消息
    showNotAllowedMessage(sourceType, targetType) {
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10001;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #856404;
                text-align: center;
            ">
                <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                <div style="font-weight: 600; margin-bottom: 8px;">Operation Not Allowed</div>
                <div style="font-size: 14px;">
                    ${this.getNodeTypeLabel(sourceType)} cannot be dragged to ${this.getNodeTypeLabel(targetType)}
                </div>
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 2000);
    }

    // 执行重组操作
    executeReorganization(sourceId, targetId, action) {
        const sourceType = this.nodeRelations.nodeTypes.get(sourceId);
        const targetType = this.nodeRelations.nodeTypes.get(targetId);
        
        console.log(`Executing reorganization: ${action} for ${sourceType}(${sourceId}) -> ${targetType}(${targetId})`);
        
        switch (action) {
            case 'merge':
                if (sourceType === targetType) {
                    this.mergeNodes(sourceId, targetId);
                } else if (sourceType === 'high-intent' && targetType === 'low-intent') {
                    this.demoteHighIntent(sourceId, targetId);
                }
                break;
            case 'attach':
                if (sourceType === 'record' && targetType === 'low-intent') {
                    this.attachRecordToLowIntent(sourceId, targetId);
                } else if (sourceType === 'low-intent' && targetType === 'high-intent') {
                    this.moveToHighIntent(sourceId, targetId);
                } else if (sourceType === targetType && sourceType === 'high-intent') {
                    // 高级意图设为子节点 - 降级处理
                    this.demoteHighIntentAsChild(sourceId, targetId);
                }
                break;
        }

        // 临时禁用物理引擎确保位置调整生效
        this.network.setOptions({ physics: { enabled: false } });
        
        this.restoreOriginalState();
        
        // 延迟恢复物理引擎
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
            this.updateNetworkLayout();
        }, 300);
    }

    // 新增：记录节点附加到低级意图
    attachRecordToLowIntent(recordId, lowIntentId) {
        const currentParent = this.nodeRelations.parents.get(recordId);
        
        // 从当前父节点移除
        if (currentParent) {
            const siblings = this.nodeRelations.children.get(currentParent) || [];
            this.nodeRelations.children.set(currentParent, siblings.filter(id => id !== recordId));
            
            // 移除旧连接
            const oldEdge = this.edges.get({
                filter: edge => edge.from === currentParent && edge.to === recordId
            });
            if (oldEdge.length > 0) {
                this.edges.remove(oldEdge[0].id);
            }
        }

        // 添加到新父节点
        this.nodeRelations.parents.set(recordId, lowIntentId);
        const newSiblings = this.nodeRelations.children.get(lowIntentId) || [];
        this.nodeRelations.children.set(lowIntentId, [...newSiblings, recordId]);

        // 创建新连接
        this.edges.add({
            from: lowIntentId,
            to: recordId,
            arrows: 'to',
            width: 1,
            dashes: [3, 3]
        });

        // 调整记录节点位置
        this.adjustChildPosition(recordId, lowIntentId);

        console.log(`Attached record ${recordId} to low-intent ${lowIntentId}`);
    }

    // 新增：高级意图降级为子节点
    demoteHighIntentAsChild(sourceHighId, targetHighId) {
        const sourceNode = this.nodes.get(sourceHighId);
        const sourceChildren = this.nodeRelations.children.get(sourceHighId) || [];
        
        console.log(`Demoting high-intent ${sourceHighId} as child of ${targetHighId}`);
        
        // 1. 收集所有叶子节点（record节点）
        const leafNodes = [];
        
        sourceChildren.forEach(childId => {
            const childType = this.nodeRelations.nodeTypes.get(childId);
            
            if (childType === 'record') {
                // 直接收集记录节点
                leafNodes.push(childId);
            } else if (childType === 'low-intent') {
                // 收集低级意图下的所有记录节点
                const grandChildren = this.nodeRelations.children.get(childId) || [];
                grandChildren.forEach(grandChildId => {
                    const grandChildType = this.nodeRelations.nodeTypes.get(grandChildId);
                    if (grandChildType === 'record') {
                        leafNodes.push(grandChildId);
                    }
                });
                
                // 删除原低级意图节点
                this.removeNodeAndConnections(childId);
            }
        });
        
        // 2. 将源高级意图节点降级为低级意图
        const newLabel = `${sourceNode.label} (降级)`;
        this.nodes.update({
            id: sourceHighId,
            label: this.formatLabel(newLabel, 'low'),
            type: 'low-intent',
            level: 1, // 重要：更新level为低级意图层级
            color: { background: '#74b9ff', border: '#0984e3' },
            size: 20,
            font: { size: 14, color: '#333' },
            title: `Demoted from high-intent: ${sourceNode.label}`
        });
        
        // 更新节点类型
        this.nodeRelations.nodeTypes.set(sourceHighId, 'low-intent');
        
        // 3. 将降级后的节点连接到目标高级意图下
        // 移除原来的父子关系（如果有的话）
        const originalParent = this.nodeRelations.parents.get(sourceHighId);
        if (originalParent) {
            const siblings = this.nodeRelations.children.get(originalParent) || [];
            this.nodeRelations.children.set(originalParent, siblings.filter(id => id !== sourceHighId));
            
            // 移除旧的父子连接
            const oldEdge = this.edges.get({
                filter: edge => edge.from === originalParent && edge.to === sourceHighId
            });
            if (oldEdge.length > 0) {
                this.edges.remove(oldEdge[0].id);
            }
        }
        
        // 建立新的父子关系
        this.nodeRelations.parents.set(sourceHighId, targetHighId);
        const targetChildren = this.nodeRelations.children.get(targetHighId) || [];
        this.nodeRelations.children.set(targetHighId, [...targetChildren, sourceHighId]);
        
        // 创建新的父子连接
        this.edges.add({
            from: targetHighId,
            to: sourceHighId,
            arrows: 'to',
            width: 2
        });
        
        // 4. 将所有叶子节点连接到降级后的低级意图下
        this.nodeRelations.children.set(sourceHighId, leafNodes);
        
        leafNodes.forEach(leafId => {
            // 更新父子关系
            this.nodeRelations.parents.set(leafId, sourceHighId);
            
            // 移除旧的连接
            const oldEdges = this.edges.get({
                filter: edge => edge.to === leafId
            });
            this.edges.remove(oldEdges.map(edge => edge.id));
            
            // 创建新连接
            this.edges.add({
                from: sourceHighId,
                to: leafId,
                arrows: 'to',
                width: 1,
                dashes: [3, 3]
            });
        });
        
        // 5. 调整降级后节点的位置
        this.adjustChildPosition(sourceHighId, targetHighId);
        
        // 6. 调整所有叶子节点的位置
        this.adjustAllChildrenPositions(sourceHighId);
        
        console.log(`High-intent ${sourceHighId} demoted to low-intent under ${targetHighId}`);
        console.log(`Connected ${leafNodes.length} leaf nodes to demoted low-intent`);
        console.log(`New label: ${newLabel}`);
    }

    // 合并同级节点
    mergeNodes(sourceId, targetId) {
        const sourceChildren = this.nodeRelations.children.get(sourceId) || [];
        const targetChildren = this.nodeRelations.children.get(targetId) || [];

        // 获取源节点和目标节点的标签信息
        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);
        
        // 创建合并后的新标签，显示合并来源
        const mergedLabel = `${targetNode.label} + ${sourceNode.label}`;
        
        // 将源节点的子节点移动到目标节点
        sourceChildren.forEach(childId => {
            this.nodeRelations.parents.set(childId, targetId);
            
            // 更新边连接
            const edgeToRemove = this.edges.get({
                filter: edge => edge.from === sourceId && edge.to === childId
            });
            if (edgeToRemove.length > 0) {
                this.edges.remove(edgeToRemove[0].id);
            }
            
            this.edges.add({
                from: targetId,
                to: childId,
                arrows: 'to',
                width: 2
            });
        });

        // 更新目标节点的子节点列表
        this.nodeRelations.children.set(targetId, [...targetChildren, ...sourceChildren]);

        // 更新目标节点的标签和工具提示
        const targetType = this.nodeRelations.nodeTypes.get(targetId);
        const finalChildrenCount = targetChildren.length + sourceChildren.length;
        
        this.nodes.update({
            id: targetId,
            label: this.formatLabel(mergedLabel, targetType === 'high-intent' ? 'high' : 'low'),
            title: this.formatIntentTooltip(mergedLabel, targetType, finalChildrenCount)
        });

        // 删除源节点及其父连接
        this.removeNodeAndConnections(sourceId);
        
        // 调整合并后的子节点位置
        this.adjustAllChildrenPositions(targetId);
        
        console.log(`Merged ${sourceId} into ${targetId}, new label: ${mergedLabel}`);
    }

    // 移动到高级意图
    moveToHighIntent(lowIntentId, highIntentId) {
        const currentParent = this.nodeRelations.parents.get(lowIntentId);
        
        // 从当前父节点移除
        if (currentParent) {
            const siblings = this.nodeRelations.children.get(currentParent) || [];
            this.nodeRelations.children.set(currentParent, siblings.filter(id => id !== lowIntentId));
            
            // 移除旧连接
            const oldEdge = this.edges.get({
                filter: edge => edge.from === currentParent && edge.to === lowIntentId
            });
            if (oldEdge.length > 0) {
                this.edges.remove(oldEdge[0].id);
            }
        }

        // 添加到新父节点
        this.nodeRelations.parents.set(lowIntentId, highIntentId);
        const newSiblings = this.nodeRelations.children.get(highIntentId) || [];
        this.nodeRelations.children.set(highIntentId, [...newSiblings, lowIntentId]);

        // 创建新连接
        this.edges.add({
            from: highIntentId,
            to: lowIntentId,
            arrows: 'to',
            width: 2
        });

        // 自动调整位置：将低级意图移动到高级意图下方合理位置
        this.adjustChildPosition(lowIntentId, highIntentId);

        console.log(`Moved ${lowIntentId} to ${highIntentId}`);
    }

    // 自动调整子节点位置
    adjustChildPosition(childId, parentId) {
        const parentPos = this.network.getPositions([parentId])[parentId];
        const allChildren = this.nodeRelations.children.get(parentId) || [];
        
        if (!parentPos) {
            console.warn(`Parent position not found for ${parentId}`);
            return;
        }
        
        // 计算子节点的新位置
        const levelHeight = 180; // 与树状布局保持一致
        const childY = parentPos.y + levelHeight;
        
        // 如果父节点下有多个子节点，需要水平分布
        const childIndex = allChildren.indexOf(childId);
        let childX = parentPos.x;
        
        if (allChildren.length > 1) {
            const childSpacing = 100; // 与树状布局保持一致
            const totalWidth = (allChildren.length - 1) * childSpacing;
            childX = parentPos.x - totalWidth / 2 + childIndex * childSpacing;
        }
        
        // 更新子节点位置
        const childNode = this.nodes.get(childId);
        if (childNode) {
            this.nodes.update({
                id: childId,
                x: childX,
                y: childY,
                fixed: { x: false, y: false } // 确保可以继续拖拽
            });
            
            console.log(`Adjusted position for ${childId}: (${childX}, ${childY}), index: ${childIndex}/${allChildren.length}`);
            
            // 递归调整该子节点的所有子节点位置
            this.adjustAllChildrenPositions(childId);
        }
    }
    
    // 递归调整所有子节点位置
    adjustAllChildrenPositions(parentId) {
        const children = this.nodeRelations.children.get(parentId) || [];
        
        children.forEach((childId, index) => {
            const parentPos = this.network.getPositions([parentId])[parentId];
            if (!parentPos) return;
            
            const childType = this.nodeRelations.nodeTypes.get(childId);
            let levelHeight;
            let childSpacing;
            
            // 根据节点类型设置不同的间距
            if (childType === 'low-intent') {
                levelHeight = 180;
                childSpacing = 100;
            } else if (childType === 'record') {
                levelHeight = 180;
                childSpacing = 80;
            } else {
                return; // 跳过其他类型
            }
            
            const childY = parentPos.y + levelHeight;
            let childX = parentPos.x;
            
            if (children.length > 1) {
                const totalWidth = (children.length - 1) * childSpacing;
                childX = parentPos.x - totalWidth / 2 + index * childSpacing;
            }
            
            this.nodes.update({
                id: childId,
                x: childX,
                y: childY,
                fixed: { x: false, y: false }
            });
            
            // 递归处理下一层
            this.adjustAllChildrenPositions(childId);
        });
    }

    // 高级意图融合到低级意图 (High -> Low 重组)
    demoteHighIntent(highIntentId, targetLowIntentId) {
        console.log(`High-to-Low reorganization: ${highIntentId} -> ${targetLowIntentId}`);
        
        const highNode = this.nodes.get(highIntentId);
        const targetNode = this.nodes.get(targetLowIntentId);
        const highChildren = this.nodeRelations.children.get(highIntentId) || [];
        
        // 1. 收集所有叶子节点（record节点）
        const leafNodes = [];
        
        highChildren.forEach(childId => {
            const childType = this.nodeRelations.nodeTypes.get(childId);
            
            if (childType === 'record') {
                // 直接收集记录节点
                leafNodes.push(childId);
            } else if (childType === 'low-intent') {
                // 收集低级意图下的所有记录节点
                const grandChildren = this.nodeRelations.children.get(childId) || [];
                grandChildren.forEach(grandChildId => {
                    const grandChildType = this.nodeRelations.nodeTypes.get(grandChildId);
                    if (grandChildType === 'record') {
                        leafNodes.push(grandChildId);
                    }
                });
                
                // 删除原低级意图节点（它将消失）
                this.removeNodeAndConnections(childId);
            }
        });
        
        // 3. 将所有叶子节点连接到目标低级意图下
        const currentTargetChildren = this.nodeRelations.children.get(targetLowIntentId) || [];
        
        leafNodes.forEach(leafId => {
            // 更新父子关系
            this.nodeRelations.parents.set(leafId, targetLowIntentId);
            
            // 移除旧的连接
            const oldEdges = this.edges.get({
                filter: edge => edge.to === leafId
            });
            this.edges.remove(oldEdges.map(edge => edge.id));
            
            // 创建新连接
            this.edges.add({
                from: targetLowIntentId,
                to: leafId,
                arrows: 'to',
                width: 1,
                dashes: [3, 3]
            });
        });
        
        // 更新目标节点的子节点列表
        this.nodeRelations.children.set(targetLowIntentId, [...currentTargetChildren, ...leafNodes]);
        
        // 3. 更新目标节点的标签和工具提示
        const mergedLabel = `${targetNode.label} + ${highNode.label}`;
        const finalChildrenCount = currentTargetChildren.length + leafNodes.length;
        
        this.nodes.update({
            id: targetLowIntentId,
            label: this.formatLabel(mergedLabel, 'low'),
            title: this.formatIntentTooltip(mergedLabel, 'low-intent', finalChildrenCount)
        });
        
        // 4. 删除原高级意图节点
        this.removeNodeAndConnections(highIntentId);
        
        // 5. 调整合并后的子节点位置
        this.adjustAllChildrenPositions(targetLowIntentId);
        
        console.log(`High-intent ${highIntentId} merged into low-intent ${targetLowIntentId}`);
        console.log(`Moved ${leafNodes.length} leaf nodes to target low-intent`);
        console.log(`Merged label: ${mergedLabel}`);
    }

    // 删除节点及其连接
    removeNodeAndConnections(nodeId) {
        // 删除所有相关的边
        const connectedEdges = this.edges.get({
            filter: edge => edge.from === nodeId || edge.to === nodeId
        });
        this.edges.remove(connectedEdges.map(edge => edge.id));

        // 从父节点的子节点列表中移除
        const parentId = this.nodeRelations.parents.get(nodeId);
        if (parentId) {
            const siblings = this.nodeRelations.children.get(parentId) || [];
            this.nodeRelations.children.set(parentId, siblings.filter(id => id !== nodeId));
        }

        // 删除节点
        this.nodes.remove(nodeId);

        // 清理关系映射
        this.nodeRelations.parents.delete(nodeId);
        this.nodeRelations.children.delete(nodeId);
        this.nodeRelations.nodeTypes.delete(nodeId);
        
        console.log(`Removed node ${nodeId} and cleaned up all references`);
    }

    // 恢复原始状态
    restoreOriginalState() {
        // 只恢复仍然存在的节点的透明度
        const existingNodeIds = new Set(this.nodes.getIds());
        
        this.dragState.draggedSubtree.forEach(id => {
            if (existingNodeIds.has(id)) {
                const originalOpacity = this.dragState.originalOpacities.get(id);
                if (originalOpacity !== undefined) {
                    this.nodes.update({ id, opacity: originalOpacity });
                }
            }
            // 移除已删除节点的记录
            else {
                this.dragState.originalOpacities.delete(id);
            }
        });
        
        // 清理不存在的节点ID
        this.dragState.draggedSubtree = new Set(
            Array.from(this.dragState.draggedSubtree).filter(id => existingNodeIds.has(id))
        );
    }

    // 清理拖拽状态
    clearDragState() {
        this.clearTargetHighlight();
        
        this.dragState.isDragging = false;
        this.dragState.draggedNodeId = null;
        this.dragState.draggedSubtree.clear();
        this.dragState.targetNode = null;
        this.dragState.originalOpacities.clear();
    }

    // 获取子树
    getSubtree(nodeId) {
        const subtree = new Set();
        const traverse = (id) => {
            // 只添加实际存在的节点
            if (this.nodes.get(id)) {
                subtree.add(id);
                const children = this.nodeRelations.children.get(id) || [];
                children.forEach(childId => traverse(childId));
            }
        };
        traverse(nodeId);
        return subtree;
    }

    // 切换节点确认状态
    toggleNodeConfirmation(nodeId) {
        const node = this.nodes.get(nodeId);
        const newOpacity = node.opacity < 1 ? 1.0 : 0.4;
        
        this.nodes.update({
            id: nodeId,
            opacity: newOpacity
        });

        // 更新相关边的样式
        const relatedEdges = this.edges.get({
            filter: edge => edge.from === nodeId || edge.to === nodeId
        });

        relatedEdges.forEach(edge => {
            this.edges.update({
                id: edge.id,
                dashes: newOpacity === 1.0 ? false : [5, 5],
                width: newOpacity === 1.0 ? 2 : 1
            });
        });

        console.log(`Toggled confirmation for ${nodeId}: ${newOpacity === 1.0 ? 'confirmed' : 'pending'}`);
    }

    // 显示右键菜单
    showContextMenu(nodeId, position) {
        // 清除现有菜单
        this.clearContextMenu();
        
        const node = this.nodes.get(nodeId);
        
        // 创建菜单
        const menu = document.createElement('div');
        menu.id = 'nodeContextMenu';
        menu.innerHTML = `
            <div style="
                position: fixed;
                top: ${position.y}px;
                left: ${position.x}px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                z-index: 10002;
                padding: 8px 0;
                min-width: 120px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                border: 1px solid #e0e0e0;
            ">
                <div class="menu-item" data-action="edit" style="
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #333;
                " onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                    <span>✏️</span>
                    <span>Edit Node</span>
                </div>
                <div class="menu-item" data-action="confirm" style="
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #333;
                " onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                    <span>${node.opacity >= 1.0 ? '❓' : '✅'}</span>
                    <span>${node.opacity >= 1.0 ? 'Set Pending' : 'Confirm Node'}</span>
                </div>
                <div class="menu-item" data-action="delete" style="
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #dc3545;
                " onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
                    <span>🗑️</span>
                    <span>Delete Node</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // 绑定事件
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.executeContextMenuAction(nodeId, action);
                this.clearContextMenu();
            };
        });
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.clearContextMenu.bind(this), { once: true });
        }, 100);
    }

    // 清除右键菜单
    clearContextMenu() {
        const existingMenu = document.getElementById('nodeContextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    // 执行右键菜单操作
    executeContextMenuAction(nodeId, action) {
        switch (action) {
            case 'edit':
                this.editNode(nodeId);
                break;
            case 'confirm':
                this.toggleNodeConfirmation(nodeId);
                break;
            case 'delete':
                this.deleteNode(nodeId);
                break;
        }
    }

    // 编辑节点
    editNode(nodeId) {
        const node = this.nodes.get(nodeId);
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        
        // 获取当前节点的内容信息
        let currentContent = '';
        let currentComment = '';
        
        if (nodeType === 'record' && node.title) {
            // 记录节点：从title中提取content和comment
            const commentMatch = node.title.match(/Comment:\s*(.*?)(?:\n|$)/s);
            currentComment = commentMatch ? commentMatch[1].trim() : '';
            if (currentComment === 'No comment') currentComment = '';
            
            // 提取Content部分，包括可能的多行内容
            const contentMatch = node.title.match(/Content:\s*(.*?)(?=\n\nComment:|$)/s);
            if (contentMatch) {
                // 清理缩进的续行
                currentContent = contentMatch[1]
                    .replace(/\n  /g, ' ')  // 移除换行和缩进
                    .trim();
            } else {
                currentContent = node.label;
            }
        } else if ((nodeType === 'high-intent' || nodeType === 'low-intent') && node.title) {
            // 意图节点：从title中提取intent名称，可能包含多行
            const intentMatch = node.title.match(/Intent:\s*(.*?)(?=\n[A-Z]|$)/s);
            if (intentMatch) {
                // 清理缩进的续行
                currentContent = intentMatch[1]
                    .replace(/\n  /g, ' ')  // 移除换行和缩进
                    .trim();
            } else {
                currentContent = node.label;
            }
        } else {
            // 默认情况：使用节点标签
            currentContent = node.label;
        }
        
        const dialog = document.createElement('div');
        dialog.id = 'editNodeDialog';
        
        // 根据节点类型决定内容输入方式
        let contentInputHtml = '';
        if (nodeType === 'record') {
            // Record节点：只读显示区域 + 展开功能
            const shouldShowExpand = currentContent.length > 100;
            const truncatedText = shouldShowExpand ? currentContent.substring(0, 100) + '...' : currentContent;
            
            contentInputHtml = `
                <div style="margin: 16px 0;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">
                        Content:
                    </label>
                    <div style="
                        padding: 8px 12px;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        background: #f8f9fa;
                        font-size: 14px;
                        line-height: 1.4;
                        color: #333;
                        min-height: 20px;
                        position: relative;
                    ">
                        <span id="displayText">${truncatedText}</span>
                        ${shouldShowExpand ? `
                            <button id="expandBtn" style="
                                background: none;
                                border: none;
                                color: #007bff;
                                cursor: pointer;
                                font-size: 12px;
                                margin-left: 8px;
                                padding: 2px 6px;
                                border-radius: 4px;
                                transition: background-color 0.2s;
                            " onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='transparent'">
                                Expand
                            </button>
                        ` : ''}
                    </div>
                </div>`;
        } else {
            // Intent节点：可编辑的textarea
            contentInputHtml = `
                <div style="margin: 16px 0;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">
                        Intent:
                    </label>
                    <textarea id="intentInput" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                        box-sizing: border-box;
                        min-height: 80px;
                        resize: vertical;
                        font-family: inherit;
                        line-height: 1.4;
                    ">${currentContent}</textarea>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        Enter the complete intent description
                    </div>
                </div>`;
        }
        
        dialog.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 10003;
                min-width: 360px;
                max-width: 520px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px; font-weight: 600;">
                    Edit ${this.getNodeTypeLabel(nodeType)}
                </h3>
                ${contentInputHtml}
                ${nodeType === 'record' ? `
                <div style="margin: 16px 0;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">
                        Comment:
                    </label>
                    <textarea id="nodeComment" placeholder="Add a comment for this record..." style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                        box-sizing: border-box;
                        min-height: 80px;
                        resize: vertical;
                        font-family: inherit;
                    ">${currentComment}</textarea>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        Maximum 500 characters
                    </div>
                </div>
                ` : ''}
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button id="saveNodeEdit" style="
                        flex: 1;
                        padding: 10px 16px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">Save</button>
                    <button id="cancelNodeEdit" style="
                        flex: 1;
                        padding: 10px 16px;
                        background: #f8f9fa;
                        color: #666;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 获取相关元素
        const commentInput = nodeType === 'record' ? document.getElementById('nodeComment') : null;
        const intentInput = nodeType !== 'record' ? document.getElementById('intentInput') : null;
        const expandBtn = document.getElementById('expandBtn');
        const displayText = document.getElementById('displayText');
        
        // 展开/收起功能（仅Record节点）
        if (expandBtn && displayText) {
            let isExpanded = false;
            expandBtn.onclick = () => {
                isExpanded = !isExpanded;
                if (isExpanded) {
                    displayText.textContent = currentContent;
                    expandBtn.textContent = 'Collapse';
                } else {
                    const truncatedText = currentContent.length > 100 ? currentContent.substring(0, 100) + '...' : currentContent;
                    displayText.textContent = truncatedText;
                    expandBtn.textContent = 'Expand';
                }
            };
        }
        
        // 聚焦到相应的输入框
        if (commentInput) {
            // Record节点：聚焦到评论框
            commentInput.focus();
            
            // 为评论框添加字符限制
            commentInput.oninput = (e) => {
                if (e.target.value.length > 500) {
                    e.target.value = e.target.value.substring(0, 500);
                }
            };
        } else if (intentInput) {
            // Intent节点：聚焦到意图输入框
            intentInput.focus();
            intentInput.select();
        }
        
        // 绑定事件
        document.getElementById('saveNodeEdit').onclick = () => {
            if (nodeType === 'record') {
                // Record节点：只更新评论
                const newComment = commentInput ? commentInput.value.trim() : null;
                this.updateNodeLabel(nodeId, node.label, newComment);
            } else {
                // Intent节点：更新intent内容
                const newIntent = intentInput ? intentInput.value.trim() : '';
                if (newIntent && newIntent !== currentContent) {
                    this.updateIntentNode(nodeId, newIntent);
                }
            }
            dialog.remove();
        };
        
        document.getElementById('cancelNodeEdit').onclick = () => {
            dialog.remove();
        };
        
        // 键盘快捷键处理
        if (commentInput) {
            commentInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    // Ctrl+Enter 保存
                    document.getElementById('saveNodeEdit').click();
                }
            });
        } else if (intentInput) {
            intentInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    // Ctrl+Enter 保存
                    document.getElementById('saveNodeEdit').click();
                }
            });
        }
        
        // Esc取消
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
    }

    // 更新节点标签
    updateNodeLabel(nodeId, newLabel, newComment = null) {
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        const formattedLabel = this.formatLabel(newLabel, nodeType === 'high-intent' ? 'high' : nodeType === 'low-intent' ? 'low' : 'record');
        
        // 准备更新对象
        const updateData = {
            id: nodeId,
            label: formattedLabel
        };
        
        // 如果是记录节点且提供了评论参数，更新工具提示
        if (nodeType === 'record') {
            const currentNode = this.nodes.get(nodeId);
            let contentText = 'No content';
            
            // 从现有title中提取content信息
            if (currentNode.title) {
                const contentMatch = currentNode.title.match(/Content:\s*(.*?)(?=\n\nComment:|$)/s);
                if (contentMatch) {
                    // 清理缩进的续行
                    contentText = contentMatch[1]
                        .replace(/\n  /g, ' ')  // 移除换行和缩进
                        .trim();
                } else {
                    contentText = 'No content';
                }
            }
            
            // 处理评论，如果newComment为null表示不更新评论
            let commentText;
            if (newComment !== null) {
                commentText = newComment || 'No comment';
            } else {
                // 从现有title中提取comment信息
                const commentMatch = currentNode.title ? currentNode.title.match(/Comment:\s*(.*)$/) : null;
                commentText = commentMatch ? commentMatch[1] : 'No comment';
            }
            
            // 更新工具提示
            updateData.title = this.formatTooltipContent(contentText, commentText);
        }
        
        this.nodes.update(updateData);
        
        const logMessage = nodeType === 'record' && newComment !== null 
            ? `Updated label and comment for ${nodeId}: "${formattedLabel}" with comment: "${newComment || 'No comment'}"`
            : `Updated label for ${nodeId}: ${formattedLabel}`;
        
        console.log(logMessage);
    }

    // 更新意图节点
    updateIntentNode(nodeId, newIntent) {
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        const formattedLabel = this.formatLabel(newIntent, nodeType === 'high-intent' ? 'high' : 'low');
        
        // 获取当前子节点数量
        const childrenCount = this.nodeRelations.children.get(nodeId)?.length || 0;
        
        // 更新节点标签和工具提示
        this.nodes.update({
            id: nodeId,
            label: formattedLabel,
            title: this.formatIntentTooltip(newIntent, nodeType, childrenCount)
        });
        
        console.log(`Updated intent for ${nodeId}: "${newIntent}"`);
    }

    // 删除节点
    deleteNode(nodeId) {
        const node = this.nodes.get(nodeId);
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        
        // 确认对话框
        const dialog = document.createElement('div');
        dialog.id = 'deleteNodeDialog';
        dialog.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 10003;
                min-width: 320px;
                max-width: 480px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">🗑️</div>
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px; font-weight: 600;">
                    Confirm Deletion
                </h3>
                <p style="margin: 16px 0; color: #666; font-size: 14px; line-height: 1.5;">
                    Are you sure you want to delete <strong>"${node.label}"</strong>?<br>
                    ${nodeType !== 'record' ? 'This will also delete all its child nodes.' : ''}
                </p>
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button id="confirmDeleteNode" style="
                        flex: 1;
                        padding: 10px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">Delete</button>
                    <button id="cancelDeleteNode" style="
                        flex: 1;
                        padding: 10px 16px;
                        background: #f8f9fa;
                        color: #666;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 绑定事件
        document.getElementById('confirmDeleteNode').onclick = () => {
            this.removeNodeAndConnections(nodeId);
            dialog.remove();
            console.log(`Deleted node ${nodeId} (${nodeType})`);
        };
        
        document.getElementById('cancelDeleteNode').onclick = () => {
            dialog.remove();
        };
    }

    // 重新构建节点关系映射（在重组后可能丢失）
    rebuildNodeRelations() {
        console.log('Rebuilding node relations...');
        
        // 清空现有关系
        this.nodeRelations.parents.clear();
        this.nodeRelations.children.clear();
        this.nodeRelations.nodeTypes.clear();
        
        const allNodes = this.nodes.get();
        const allEdges = this.edges.get();
        
        // 重建节点类型映射
        allNodes.forEach(node => {
            this.nodeRelations.nodeTypes.set(node.id, node.type);
            this.nodeRelations.children.set(node.id, []);
        });
        
        // 从边重建父子关系
        allEdges.forEach(edge => {
            const parentId = edge.from;
            const childId = edge.to;
            
            // 设置父子关系
            this.nodeRelations.parents.set(childId, parentId);
            
            // 添加到父节点的子节点列表
            if (!this.nodeRelations.children.has(parentId)) {
                this.nodeRelations.children.set(parentId, []);
            }
            this.nodeRelations.children.get(parentId).push(childId);
        });
        
        console.log('Node relations rebuilt:', {
            nodes: allNodes.length,
            edges: allEdges.length,
            parents: this.nodeRelations.parents.size,
            children: this.nodeRelations.children.size
        });
    }

    // 获取节点颜色
    getNodeColor(type) {
        const colors = {
            'high-intent': { background: '#ff7675', border: '#d63031' },
            'low-intent': { background: '#74b9ff', border: '#0984e3' },
            'record': { background: '#81ecec', border: '#00cec9' }
        };
        return colors[type] || colors['record'];
    }

    // 计算标准树状布局位置 - 抽取的共用函数（与buildNetworkData保持一致）
    calculateTreeLayoutPositions() {
        const positions = {};
        const containerWidth = this.container ? this.container.offsetWidth * 0.8 : 800;
        const levelHeight = 180;
        const baseY = -200;
        
        // 按照buildNetworkData的逻辑重新计算位置
        // 获取所有节点并按层级分组
        const nodesByLevel = { 0: [], 1: [], 2: [] };
        this.nodes.get().forEach(node => {
            if (nodesByLevel[node.level] !== undefined) {
                nodesByLevel[node.level].push(node);
            }
        });
        
        console.log('Calculating tree positions for nodes by level:', {
            'High-Intent': nodesByLevel[0].length,
            'Low-Intent': nodesByLevel[1].length,
            'Record': nodesByLevel[2].length
        });
        
        // 高级意图节点布局 - 与buildNetworkData保持一致
        const highNodes = nodesByLevel[0];
        if (highNodes.length > 0) {
            const highNodeSpacing = Math.max(150, containerWidth * 0.8 / (highNodes.length + 1));
            const highTotalWidth = (highNodes.length - 1) * highNodeSpacing;
            const highStartX = -highTotalWidth / 2;
            
            highNodes.forEach((node, index) => {
                positions[node.id] = {
                    x: highStartX + index * highNodeSpacing,
                    y: baseY
                };
            });
        }
        
        // 低级意图节点布局 - 按父节点分组
        const lowNodes = nodesByLevel[1];
        if (lowNodes.length > 0) {
            const lowNodesByParent = new Map();
            
            // 按父节点分组
            lowNodes.forEach(node => {
                const parentId = this.nodeRelations.parents.get(node.id);
                if (parentId) {
                    if (!lowNodesByParent.has(parentId)) {
                        lowNodesByParent.set(parentId, []);
                    }
                    lowNodesByParent.get(parentId).push(node);
                }
            });
            
            // 为每个父节点下的子节点计算位置
            lowNodesByParent.forEach((children, parentId) => {
                const parentPos = positions[parentId];
                if (parentPos) {
                    children.forEach((child, childIndex) => {
                        let childX = parentPos.x;
                        
                        // 如果有多个子节点，进行水平分布
                        if (children.length > 1) {
                            const lowSpacing = 100; // 与buildNetworkData保持一致
                            const lowTotalWidth = (children.length - 1) * lowSpacing;
                            childX = parentPos.x - lowTotalWidth / 2 + childIndex * lowSpacing;
                        }
                        
                        positions[child.id] = {
                            x: childX,
                            y: baseY + levelHeight
                        };
                    });
                }
            });
        }
        
        // 记录节点布局 - 按父节点分组
        const recordNodes = nodesByLevel[2];
        if (recordNodes.length > 0) {
            const recordNodesByParent = new Map();
            
            // 按父节点分组
            recordNodes.forEach(node => {
                const parentId = this.nodeRelations.parents.get(node.id);
                if (parentId) {
                    if (!recordNodesByParent.has(parentId)) {
                        recordNodesByParent.set(parentId, []);
                    }
                    recordNodesByParent.get(parentId).push(node);
                }
            });
            
            // 为每个父节点下的记录节点计算位置
            recordNodesByParent.forEach((children, parentId) => {
                const parentPos = positions[parentId];
                if (parentPos) {
                    children.forEach((child, childIndex) => {
                        let childX = parentPos.x;
                        
                        // 如果有多个记录，进行水平分布
                        if (children.length > 1) {
                            const recordSpacing = 80; // 与buildNetworkData保持一致
                            const recordTotalWidth = (children.length - 1) * recordSpacing;
                            childX = parentPos.x - recordTotalWidth / 2 + childIndex * recordSpacing;
                        }
                        
                        positions[child.id] = {
                            x: childX,
                            y: baseY + levelHeight * 2
                        };
                    });
                }
            });
        }
        
        return positions;
    }
    
    // 重置为树状布局
    resetToTreeLayout() {
        console.log('Resetting to tree layout...');
        
        // 重新构建节点关系映射
        this.rebuildNodeRelations();
        
        // 使用统一的布局计算函数
        const newPositions = this.calculateTreeLayoutPositions();
        
        // 应用新位置
        const positionedNodes = Object.keys(newPositions).length;
        console.log(`Applying tree layout positions to ${positionedNodes} nodes`);
        
        if (positionedNodes > 0) {
            // 临时禁用物理引擎以确保位置设置生效
            this.network.setOptions({
                physics: { enabled: false }
            });
            
            // 使用正确的vis.js API更新节点位置
            const nodesToUpdate = [];
            Object.keys(newPositions).forEach(nodeId => {
                const currentNode = this.nodes.get(nodeId);
                if (currentNode) {
                    nodesToUpdate.push({
                        ...currentNode,
                        x: newPositions[nodeId].x,
                        y: newPositions[nodeId].y,
                        fixed: { x: false, y: false } // 确保可以拖拽
                    });
                }
            });
            
            if (nodesToUpdate.length > 0) {
                this.nodes.update(nodesToUpdate);
                console.log(`Tree layout positions applied successfully to ${nodesToUpdate.length} nodes`);
                
                // 延迟后恢复物理引擎设置
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
                }, 100);
            }
        } else {
            console.warn('No positions calculated - tree layout reset failed');
        }
        
        // 调整完毕后适配视图
        setTimeout(() => {
            this.network.fit({
                animation: { duration: 1000, easingFunction: 'easeInOutQuad' }
            });
        }, 300);
    }

    // 更新网络布局
    updateNetworkLayout() {
        this.network.stabilize(100);
        setTimeout(() => {
            this.network.fit({
                animation: { duration: 1000, easingFunction: 'easeInOutQuad' }
            });
        }, 200);
    }

    // 清理
    cleanup() {
        if (this.network) {
            this.network.destroy();
        }
        if (this.container) {
            this.container.remove();
        }
        
        // 清理注入的样式（如果没有其他实例使用）
        const tooltipStyles = document.getElementById('vis-tooltip-styles-v2');
        if (tooltipStyles) {
            tooltipStyles.remove();
        }
        
        console.log('NetworkVisualizationV2 cleaned up');
    }
}

// 全局函数入口
window.showNetworkVisualizationV2 = async function(intentTree, containerArea = null, mode = 'standalone') {
    try {
        console.log('Creating V2 Network Visualization');
        
        const visualization = new NetworkVisualizationV2(intentTree, containerArea, mode);
        await visualization.initialize();
        
        return visualization;
    } catch (error) {
        console.error('Failed to create V2 network visualization:', error);
        alert('Failed to create network visualization. Check console for details.');
    }
};

console.log('NetworkVisualizationV2 - Complete rewrite loaded successfully');
console.log('showNetworkVisualizationV2 function available:', typeof window.showNetworkVisualizationV2);