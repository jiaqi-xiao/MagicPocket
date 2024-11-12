function showNetworkVisualization(records) {
    try {
        if (typeof vis === 'undefined') {
            console.error('Vis.js not loaded');
            alert('Network visualization library not loaded properly. Please try again.');
            return;
        }

        // 创建或获取网络可视化容器
        let networkContainer = document.getElementById("networkVisualizationContainer");
        if (!networkContainer) {
            networkContainer = document.createElement("div");
            networkContainer.id = "networkVisualizationContainer";
            networkContainer.style.position = "fixed";
            networkContainer.style.top = "50%";
            networkContainer.style.left = "50%";
            networkContainer.style.transform = "translate(-50%, -50%)";
            networkContainer.style.width = "80vw";
            networkContainer.style.height = "80vh";
            networkContainer.style.backgroundColor = "white";
            networkContainer.style.padding = "20px";
            networkContainer.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
            networkContainer.style.zIndex = "10000";
            networkContainer.style.borderRadius = "8px";
            
            // 添加关闭按钮
            const closeBtn = document.createElement("button");
            closeBtn.textContent = "×";
            closeBtn.style.position = "absolute";
            closeBtn.style.right = "10px";
            closeBtn.style.top = "10px";
            closeBtn.style.border = "1px solid #ccc";
            closeBtn.style.background = "#fff";
            closeBtn.style.color = "#333";
            closeBtn.style.fontSize = "24px";
            closeBtn.style.cursor = "pointer";
            closeBtn.style.width = "30px";
            closeBtn.style.height = "30px";
            closeBtn.style.borderRadius = "50%";
            closeBtn.style.display = "flex";
            closeBtn.style.alignItems = "center";
            closeBtn.style.justifyContent = "center";
            closeBtn.style.padding = "0";
            closeBtn.style.lineHeight = "1";
            closeBtn.style.textAlign = "center";
            closeBtn.style.userSelect = "none";
            closeBtn.style.transform = "translateY(-2px)";
            closeBtn.style.position = "relative";
            closeBtn.style.zIndex = "1";

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
                networkContainer.remove();
            };
            
            networkContainer.appendChild(closeBtn);
            
            // 创建网络图容器
            const visContainer = document.createElement("div");
            visContainer.style.width = "100%";
            visContainer.style.height = "calc(100% - 40px)";
            networkContainer.appendChild(visContainer);
            
            document.body.appendChild(networkContainer);

            // 准备节点和边的数据
            const nodes = new vis.DataSet();
            const edges = new vis.DataSet();

            // 节点状态管理
            const nodeStates = new Map(); // 存储节点状态，true 为确认，false 为待定

            // 添加中心节点（默认确认状态）
            nodes.add({
                id: 'center',
                label: 'Main Goal',
                color: '#ff7675',
                shape: 'dot',
                size: 20,
                opacity: 1
            });
            nodeStates.set('center', true);

            // 添加两层中间节点（默认待定状态）
            const middleLayer1 = ['Planning', 'Execution', 'Feedback'];
            const middleLayer2 = ['Task Analysis', 'Resource Prep', 'Progress', 'Quality Check'];

            // 添加第一层节点
            middleLayer1.forEach((label, index) => {
                const id = `l1_${index}`;
                nodes.add({
                    id: id,
                    label: label,
                    color: { background: 'rgba(116, 185, 255, 0.5)' },
                    shape: 'dot',
                    size: 15,
                    opacity: 0.3
                });
                nodeStates.set(id, false);
                
                edges.add({
                    id: `e_center_${id}`,
                    from: 'center',
                    to: id,
                    dashes: true
                });
            });

            // 添加第二层节点
            middleLayer2.forEach((label, index) => {
                const id = `l2_${index}`;
                const fromId = `l1_${Math.floor(index/2)}`;
                nodes.add({
                    id: id,
                    label: label,
                    color: { background: 'rgba(162, 155, 254, 0.5)' },
                    shape: 'dot',
                    size: 12,
                    opacity: 0.3
                });
                nodeStates.set(id, false);
                
                edges.add({
                    id: `e_${fromId}_${id}`,
                    from: fromId,
                    to: id,
                    dashes: true
                });
            });

            // 添加记录节点
            records.forEach((record, index) => {
                const id = `record_${index}`;
                const content = record.type === 'text' ? 
                    record.content.substring(0, 5) + '...' : 
                    'Image ' + (index + 1);
                const fromId = `l2_${index % 4}`;
                
                nodes.add({
                    id: id,
                    label: content,
                    color: '#81ecec',
                    shape: 'dot',
                    size: 10,
                    opacity: 0.3
                });
                nodeStates.set(id, false);
                
                edges.add({
                    id: `e_${fromId}_${id}`,
                    from: fromId,
                    to: id,
                    dashes: true
                });
            });

            // 更新节点状态的函数
            function updateNodeState(nodeId, confirmed) {
                nodeStates.set(nodeId, confirmed);
                const node = nodes.get(nodeId);
                nodes.update({
                    id: nodeId,
                    opacity: confirmed ? 1 : 0.3
                });

                // 更新相关边的样式
                edges.forEach(edge => {
                    if (edge.from === nodeId || edge.to === nodeId) {
                        const fromConfirmed = nodeStates.get(edge.from);
                        const toConfirmed = nodeStates.get(edge.to);
                        edges.update({
                            id: edge.id,
                            dashes: !(fromConfirmed && toConfirmed)
                        });
                    }
                });
            }

            // 将 createContextMenu 改名为 createNodeMenu，并调整菜单样式
            function createNodeMenu(nodeId, x, y) {
                const menu = document.createElement('div');
                menu.id = 'nodeMenu';
                menu.style.position = 'absolute';
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';
                menu.style.backgroundColor = 'white';
                menu.style.border = '1px solid #ccc';
                menu.style.borderRadius = '4px';
                menu.style.padding = '5px';
                menu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                menu.style.zIndex = '10001';

                const toggleBtn = document.createElement('div');
                toggleBtn.textContent = nodeStates.get(nodeId) ? 'Set as Pending' : 'Set as Confirmed';
                toggleBtn.style.padding = '5px 10px';
                toggleBtn.style.cursor = 'pointer';
                toggleBtn.style.color = '#2d3436';  // 深色文字，确保可读性
                toggleBtn.style.fontWeight = '500';  // 稍微加粗一点
                toggleBtn.style.borderBottom = '1px solid #eee';  // 添加分隔线

                const deleteBtn = document.createElement('div');
                deleteBtn.textContent = 'Delete Node';
                deleteBtn.style.padding = '5px 10px';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.color = '#e74c3c';  // 使用略微柔和的红色

                toggleBtn.addEventListener('mouseover', () => {
                    toggleBtn.style.backgroundColor = '#f0f0f0';
                    toggleBtn.style.color = '#0984e3';  // 悬停时变为蓝色
                });
                toggleBtn.addEventListener('mouseout', () => {
                    toggleBtn.style.backgroundColor = 'white';
                    toggleBtn.style.color = '#2d3436';  // 恢复原色
                });

                deleteBtn.addEventListener('mouseover', () => {
                    deleteBtn.style.backgroundColor = '#f0f0f0';
                    deleteBtn.style.color = '#d63031';  // 悬停时变为深红色
                });
                deleteBtn.addEventListener('mouseout', () => {
                    deleteBtn.style.backgroundColor = 'white';
                    deleteBtn.style.color = '#e74c3c';  // 恢复原色
                });

                toggleBtn.onclick = () => {
                    const newState = !nodeStates.get(nodeId);
                    updateNodeState(nodeId, newState);
                    menu.remove();
                };

                deleteBtn.onclick = () => {
                    if (nodeId !== 'center') {  // 防止删除中心节点
                        nodes.remove(nodeId);
                        // 删除相关的边
                        edges.forEach(edge => {
                            if (edge.from === nodeId || edge.to === nodeId) {
                                edges.remove(edge.id);
                            }
                        });
                    }
                    menu.remove();
                };

                menu.appendChild(toggleBtn);
                menu.appendChild(deleteBtn);
                document.body.appendChild(menu);

                // 点击其他地方关闭菜单
                const closeMenu = (e) => {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeMenu), 0);
            }

            // 配置网络图选项
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

            // 创建网络图
            const network = new vis.Network(visContainer, {nodes, edges}, options);

            // 修改点击事件中的函数名
            network.on('click', function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const canvasPosition = params.pointer.canvas;
                    const DOMPosition = network.canvasToDOM(canvasPosition);
                    createNodeMenu(nodeId, DOMPosition.x, DOMPosition.y);  // 改为新的函数名
                }
            });

        }
    } catch (error) {
        console.error('Error in network visualization:', error);
        alert('An error occurred while creating the network visualization.');
    }
} 