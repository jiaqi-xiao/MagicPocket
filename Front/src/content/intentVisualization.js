function clickUserIntentBtn() {
    // if current intentContainer is not null, then delete it
    if (document.getElementById("intentVisualizationContainer")) {
        document.getElementById("intentVisualizationContainer").remove();
        showIntentBtn.textContent = "Show Intent";
        console.log("disappear intentContainer");
        return;
    }
    console.log("show intentContainer");

    showUserIntentVisualization();

    // 修改showIntentBtn文字内容为 Hide Intent
    showIntentBtn.textContent = "Hide Intent";
    isIntentVisible = true;
}

function showUserIntentVisualization() {
    let intentContainer = document.getElementById("intentVisualizationContainer");
    if (intentContainer) {
        intentContainer.style.display = "block";
    } else {
        createUserIntentVisualization();
    }
}

function createUserIntentVisualization() {
    const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#97C8EB'];

    // 模拟的用户意图数据
    let intentData = [
        {
            id: 1,
            name: '文化体验',
            score: 9,
            children: [
                { id: 11, name: '打卡景点', score: 9 },
                { id: 12, name: '建筑欣赏', score: 9 },
                { id: 13, name: '历史探秘', score: 7 },
                { id: 14, name: '艺术鉴赏', score: 7 }
            ]
        },
        {
            id: 2,
            name: '自然探索',
            score: 8,
            children: [
                { id: 21, name: '观赏日落', score: 8 },
                { id: 22, name: '海滩日光浴', score: 6 }
            ]
        },
        {
            id: 3,
            name: '浪漫时光',
            score: 9,
            children: [
                { id: 31, name: '参加婚礼', score: 10 },
                { id: 32, name: '城市漫步', score: 8 }
            ]
        },
        {
            id: 4,
            name: '美食品尝',
            score: 7,
            children: [
                { id: 41, name: '品尝美酒', score: 6 }
            ]
        },
        {
            id: 5,
            name: '放松身心',
            score: 8,
            children: [
                { id: 51, name: '拍照留念', score: 9 },
                { id: 52, name: '悠闲午后', score: 6 }
            ]
        }
    ];

    // 获取 floatingRecordsContainer
    let floatingRecordsContainer = document.getElementById("floatingRecordsContainer");
    if (!floatingRecordsContainer) {
        console.log("浮动列表窗口不存在");
        return;
    }
    let floatingRecordsContainerHeight = floatingRecordsContainer.offsetHeight;

    // 创建或获取意图可视化容器
    let intentContainer = floatingWindow.querySelector("#intentVisualizationContainer");
    if (!intentContainer) {
        intentContainer = document.createElement("div");
        intentContainer.id = "intentVisualizationContainer";
        intentContainer.style.position = "absolute";
        intentContainer.style.left = "-300px";
        intentContainer.style.top = "0";
        intentContainer.style.width = "280px";
        intentContainer.style.backgroundColor = "#2A2A2A";
        intentContainer.style.color = "#E0E0E0";
        intentContainer.style.border = "1px solid #ccc";
        intentContainer.style.padding = "10px";
        intentContainer.style.borderRadius = "8px";
        intentContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
        intentContainer.style.height = floatingRecordsContainerHeight + "px";
        intentContainer.style.overflowY = "auto";
        floatingRecordsContainer.appendChild(intentContainer);
    }

    // 清空容器内容
    intentContainer.innerHTML = "<h2 style='text-align: center; color: #FFFFFF; margin-bottom: 20px;'>Itent Visualization</h2>";

    function createIntentBar(item, color, maxScore, level = 0) {
        const barContainer = document.createElement("div");
        barContainer.style.marginBottom = "15px";
        barContainer.style.paddingLeft = `${level * 20}px`;

        const barWrapper = document.createElement("div");
        barWrapper.style.display = "flex";
        barWrapper.style.alignItems = "center";
        barWrapper.style.marginBottom = "5px";

        const bar = document.createElement("div");
        const width = (item.score / maxScore) * 100;
        bar.style.width = `${width}%`;
        bar.style.height = "30px";
        bar.style.backgroundColor = color;
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.justifyContent = "space-between";
        bar.style.paddingLeft = "10px";
        bar.style.paddingRight = "10px";
        bar.style.color = "#1A1A1A";
        bar.style.fontWeight = "bold";
        bar.style.borderRadius = "4px";
        bar.style.transition = "width 0.3s ease-in-out";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${item.name} (${item.score})`;
        bar.appendChild(nameSpan);

        const controlsDiv = document.createElement("div");
        controlsDiv.style.display = "flex";
        controlsDiv.style.alignItems = "center";

        const increaseButton = document.createElement("button");
        increaseButton.innerHTML = "▲";
        increaseButton.style.marginLeft = "5px";
        increaseButton.style.background = "none";
        increaseButton.style.border = "none";
        increaseButton.style.cursor = "pointer";
        increaseButton.style.color = "#1A1A1A";
        increaseButton.onclick = () => updateScore(item.id, item.score + 1);

        const decreaseButton = document.createElement("button");
        decreaseButton.innerHTML = "▼";
        decreaseButton.style.background = "none";
        decreaseButton.style.border = "none";
        decreaseButton.style.cursor = "pointer";
        decreaseButton.style.color = "#1A1A1A";
        decreaseButton.onclick = () => updateScore(item.id, Math.max(0, item.score - 1));

        controlsDiv.appendChild(increaseButton);
        controlsDiv.appendChild(decreaseButton);
        bar.appendChild(controlsDiv);

        barWrapper.appendChild(bar);
        barContainer.appendChild(barWrapper);

        if (item.children) {
            item.children.forEach(child => {
                barContainer.appendChild(createIntentBar(child, "#4A4A4A", maxScore, level + 1));
            });
        }

        return barContainer;
    }

    function updateScore(id, newScore) {
        const updateItem = (items) => {
            return items.map(item => {
                if (item.id === id) {
                    return { ...item, score: newScore };
                }
                if (item.children) {
                    return { ...item, children: updateItem(item.children) };
                }
                return item;
            });
        };
        intentData = updateItem(intentData);
        renderIntentBars();
    }

    function renderIntentBars() {
        const maxScore = Math.max(
            ...intentData.map(item => item.score),
            ...intentData.flatMap(item => item.children.map(child => child.score))
        );

        intentContainer.innerHTML = "<h2 style='text-align: center; color: #FFFFFF; margin-bottom: 20px;'>User Intent Visualization</h2>";
        intentData.forEach((item, index) => {
            intentContainer.appendChild(createIntentBar(item, COLORS[index], maxScore));
        });
    }

    renderIntentBars();

    // 显示意图容器
    intentContainer.style.display = "block";
}

// export { clickUserIntentBtn, showUserIntentVisualization, createUserIntentVisualization };