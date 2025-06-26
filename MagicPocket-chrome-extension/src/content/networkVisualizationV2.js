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
                fixed: { x: false, y: false } // 允许自由移动
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
                    fixed: { x: false, y: false } // 允许自由移动
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
                            title: `Content: ${record.content || 'No content'}\nComment: ${record.comment || 'No comment'}`
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
                hover: true
            },
            layout: {
                randomSeed: 42
            }
        };

        this.network = new vis.Network(container, {
            nodes: this.nodes,
            edges: this.edges
        }, options);

        // 初始布局已在节点创建时设置，不需要额外调用

        console.log('Network created successfully');
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
        this.network.on('dragEnd', (params) => {
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

        console.log('Event handlers setup complete');
    }

    // 开始拖拽
    startDrag(nodeId) {
        const nodeType = this.nodeRelations.nodeTypes.get(nodeId);
        if (nodeType === 'record') return false; // 记录节点不能拖拽

        // 只有意图节点才进入重组模式
        if (nodeType === 'high-intent' || nodeType === 'low-intent') {
            this.dragState.isDragging = true;
            this.dragState.draggedNodeId = nodeId;
            this.dragState.draggedSubtree = this.getSubtree(nodeId);

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

            console.log('Reorganization drag started:', nodeId, 'Subtree:', Array.from(this.dragState.draggedSubtree));
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

        if (sourceType === targetType) {
            // 同级合并
            this.mergeNodes(sourceId, targetId);
        } else if (sourceType === 'low-intent' && targetType === 'high-intent') {
            // Low -> High: 移动到新的高级意图下
            this.moveToHighIntent(sourceId, targetId);
        } else if (sourceType === 'high-intent' && targetType === 'low-intent') {
            // High -> Low: 高级意图降级
            this.demoteHighIntent(sourceId, targetId);
        }

        this.restoreOriginalState();
        this.updateNetworkLayout();
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
        
        // 更新目标节点的标签
        this.nodes.update({
            id: targetId,
            label: this.formatLabel(mergedLabel, this.nodeRelations.nodeTypes.get(targetId) === 'high-intent' ? 'high' : 'low'),
            title: `Merged from: ${sourceNode.label} → ${targetNode.label}`
        });

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

        // 删除源节点及其父连接
        this.removeNodeAndConnections(sourceId);
        
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

        console.log(`Moved ${lowIntentId} to ${highIntentId}`);
    }

    // 降级高级意图
    demoteHighIntent(highIntentId, targetLowIntentId) {
        const targetParent = this.nodeRelations.parents.get(targetLowIntentId);
        const highChildren = this.nodeRelations.children.get(highIntentId) || [];

        // 将高级意图的子节点移动到目标低级意图的父节点
        highChildren.forEach(childId => {
            if (targetParent) {
                this.nodeRelations.parents.set(childId, targetParent);
                const parentChildren = this.nodeRelations.children.get(targetParent) || [];
                this.nodeRelations.children.set(targetParent, [...parentChildren, childId]);

                // 更新连接
                const oldEdge = this.edges.get({
                    filter: edge => edge.from === highIntentId && edge.to === childId
                });
                if (oldEdge.length > 0) {
                    this.edges.remove(oldEdge[0].id);
                }

                this.edges.add({
                    from: targetParent,
                    to: childId,
                    arrows: 'to',
                    width: 2
                });
            }
        });

        // 删除高级意图节点
        this.removeNodeAndConnections(highIntentId);
        
        console.log(`Demoted ${highIntentId}, children moved to parent of ${targetLowIntentId}`);
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

    // 重置为树状布局
    resetToTreeLayout() {
        console.log('Resetting to tree layout...');
        
        const nodesByLevel = { 0: [], 1: [], 2: [] };
        
        // 按层级分组节点，同时重新构建节点关系映射
        this.rebuildNodeRelations();
        
        this.nodes.get().forEach(node => {
            if (nodesByLevel[node.level]) {
                nodesByLevel[node.level].push(node);
            }
        });
        
        // 计算新的位置
        const newPositions = {};
        const containerWidth = this.container.offsetWidth * 0.8;
        const levelHeight = 180; // 层级间距
        const baseY = -200; // 起始Y坐标
        
        console.log('Nodes by level:', {
            'High-Intent': nodesByLevel[0].length,
            'Low-Intent': nodesByLevel[1].length, 
            'Record': nodesByLevel[2].length
        });
        
        // 为每层节点计算位置
        if (nodesByLevel[0].length > 0) {
            // 高级意图节点 - 水平均匀分布
            const highNodes = nodesByLevel[0];
            const highSpacing = Math.max(150, containerWidth / (highNodes.length + 1));
            const highTotalWidth = (highNodes.length - 1) * highSpacing;
            const highStartX = -highTotalWidth / 2;
            
            highNodes.forEach((node, index) => {
                newPositions[node.id] = {
                    x: highStartX + index * highSpacing,
                    y: baseY
                };
            });
            
            console.log(`Positioned ${highNodes.length} high-intent nodes`);
        }
        
        // 低级意图节点 - 按父节点分组分布
        if (nodesByLevel[1].length > 0) {
            const lowNodes = nodesByLevel[1];
            const lowNodesByParent = new Map();
            
            // 按父节点分组
            lowNodes.forEach(node => {
                const parentId = this.nodeRelations.parents.get(node.id);
                if (!lowNodesByParent.has(parentId)) {
                    lowNodesByParent.set(parentId, []);
                }
                lowNodesByParent.get(parentId).push(node);
            });
            
            // 为每组计算位置
            lowNodesByParent.forEach((children, parentId) => {
                const parentPos = newPositions[parentId];
                if (parentPos) {
                    children.forEach((child, index) => {
                        let childX = parentPos.x;
                        if (children.length > 1) {
                            const childSpacing = 100;
                            const childTotalWidth = (children.length - 1) * childSpacing;
                            childX = parentPos.x - childTotalWidth / 2 + index * childSpacing;
                        }
                        newPositions[child.id] = {
                            x: childX,
                            y: baseY + levelHeight
                        };
                    });
                    console.log(`Positioned ${children.length} low-intent nodes under parent ${parentId}`);
                } else {
                    console.warn(`Parent ${parentId} not found for low-intent nodes:`, children.map(c => c.id));
                    // 为没有找到父节点的低级意图节点分配默认位置
                    children.forEach((child, index) => {
                        newPositions[child.id] = {
                            x: index * 150,
                            y: baseY + levelHeight
                        };
                    });
                }
            });
        }
        
        // 记录节点 - 按父节点分组分布
        if (nodesByLevel[2].length > 0) {
            const recordNodes = nodesByLevel[2];
            const recordNodesByParent = new Map();
            
            // 按父节点分组
            recordNodes.forEach(node => {
                const parentId = this.nodeRelations.parents.get(node.id);
                if (!recordNodesByParent.has(parentId)) {
                    recordNodesByParent.set(parentId, []);
                }
                recordNodesByParent.get(parentId).push(node);
            });
            
            // 为每组计算位置
            recordNodesByParent.forEach((children, parentId) => {
                const parentPos = newPositions[parentId];
                if (parentPos) {
                    children.forEach((child, index) => {
                        let childX = parentPos.x;
                        if (children.length > 1) {
                            const childSpacing = 80;
                            const childTotalWidth = (children.length - 1) * childSpacing;
                            childX = parentPos.x - childTotalWidth / 2 + index * childSpacing;
                        }
                        newPositions[child.id] = {
                            x: childX,
                            y: baseY + levelHeight * 2
                        };
                    });
                    console.log(`Positioned ${children.length} record nodes under parent ${parentId}`);
                } else {
                    console.warn(`Parent ${parentId} not found for record nodes:`, children.map(c => c.id));
                    // 为没有找到父节点的记录节点分配默认位置
                    children.forEach((child, index) => {
                        newPositions[child.id] = {
                            x: index * 100,
                            y: baseY + levelHeight * 2
                        };
                    });
                }
            });
        }
        
        // 应用新位置
        const positionedNodes = Object.keys(newPositions).length;
        console.log(`Applying positions to ${positionedNodes} nodes`);
        
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
                console.log(`Positions applied successfully to ${nodesToUpdate.length} nodes`);
                
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
            console.warn('No positions calculated - layout reset failed');
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
        console.log('NetworkVisualizationV2 cleaned up');
    }
}

// 全局函数入口
window.showNetworkVisualizationV2 = async function(intentTree, containerArea = null, mode = 'standalone', layout = 'force') {
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