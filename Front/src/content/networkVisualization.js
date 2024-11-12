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

            // 添加中心节点
            nodes.add({
                id: 'center',
                label: 'Main Goal',
                color: '#ff7675',
                shape: 'dot',
                size: 20
            });

            // 添加两层中间节点
            const middleLayer1 = ['Planning', 'Execution', 'Feedback'];
            const middleLayer2 = ['Task Analysis', 'Resource Prep', 'Progress', 'Quality Check'];

            // 添加第一层节点
            middleLayer1.forEach((label, index) => {
                nodes.add({
                    id: `l1_${index}`,
                    label: label,
                    color: { background: 'rgba(116, 185, 255, 0.5)' },
                    shape: 'dot',
                    size: 15
                });
                edges.add({
                    from: 'center',
                    to: `l1_${index}`,
                    dashes: true
                });
            });

            // 添加第二层节点
            middleLayer2.forEach((label, index) => {
                nodes.add({
                    id: `l2_${index}`,
                    label: label,
                    color: { background: 'rgba(162, 155, 254, 0.5)' },
                    shape: 'dot',
                    size: 12
                });
                edges.add({
                    from: `l1_${Math.floor(index/2)}`,
                    to: `l2_${index}`,
                    dashes: true
                });
            });

            // 添加记录节点
            records.forEach((record, index) => {
                const content = record.type === 'text' ? 
                    record.content.substring(0, 5) + '...' : 
                    '图片' + (index + 1);
                
                nodes.add({
                    id: `record_${index}`,
                    label: content,
                    color: '#81ecec',
                    shape: 'dot',
                    size: 10
                });
                
                edges.add({
                    from: `l2_${index % 4}`,
                    to: `record_${index}`,
                    dashes: true
                });
            });

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
                }
            };

            // 创建网络图
            const network = new vis.Network(visContainer, {nodes, edges}, options);
        }
    } catch (error) {
        console.error('Error in network visualization:', error);
        alert('An error occurred while creating the network visualization.');
    }
} 