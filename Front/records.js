document.addEventListener("DOMContentLoaded", async () => {
    // 确保 imageStorage 已经初始化
    await new Promise(resolve => {
        const checkStorage = () => {
            if (imageStorage && imageStorage.db) {
                resolve();
            } else {
                setTimeout(checkStorage, 100);
            }
        };
        checkStorage();
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    const index = parseInt(urlParams.get("index"));

    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];
        const recordsList = document.getElementById("recordsList");
        const recordDetails = document.getElementById("recordDetails");

        recordsList.innerHTML = "";
        records.forEach((record, i) => {
            const item = document.createElement("li");
            const date = new Date(record.timestamp);
            const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            item.textContent = `${record.type === "text" ? "Text" : "Image"} - ${formattedDate}`;
            // print if exist image
            if (record.type === "image") {
                console.log("left listrecord image id:", record.content);
            }

            item.addEventListener("click", () => {
                displayRecordDetails(record, item);
            });
            recordsList.appendChild(item);
        });

        if (index >= 0 && index < records.length) {
            displayRecordDetails(records[index], recordsList.children[index]);
        }
    });

    function displayRecordDetails(record, selectedItem) {
        const items = document.querySelectorAll("#recordsList li");
        items.forEach(item => item.classList.remove("selected"));
        selectedItem.classList.add("selected");

        document.getElementById("recordTime").textContent = new Date(record.timestamp).toLocaleString();
        
        const recordTextElement = document.getElementById("recordText");
        const imageElement = document.getElementById("recordImage");
        
        if (record.type === "text") {
            recordTextElement.textContent = record.content;
            recordTextElement.style.display = "inline";
            imageElement.style.display = "none";
        } else if (record.type === "image") {
            console.log("record image id:", record.content);
            recordTextElement.style.display = "none";
            imageElement.style.display = "block";
            
            // 添加错误处理事件监听器
            imageElement.onerror = function(error) {
                console.error("图片加载失败:", error);
                imageElement.style.display = "none";
            };

            if (!window.indexedDB) {
                console.log("browser not support indexedDB");
            }

            // 使用 imageStorage 获取图片数据
            imageStorage.getImage(record.content)
                .then(imageData => {
                    if (imageData) {
                        console.log("成功获取图片数据");
                        imageElement.src = imageData;
                    } else {
                        console.warn("未找到图片数据，ID:", record.content);
                        imageElement.style.display = "none";
                    }
                })
                .catch(error => {
                    console.error("获取图片数据失败:", error);
                    imageElement.style.display = "none";
                });
        }

        document.getElementById("recordParagraph").textContent = record.paragraph || "--";
        document.getElementById("recordComment").textContent = record.comment || "--";
        document.getElementById("recordUrl").textContent = record.url;
        document.getElementById("recordId").textContent = record.id;
        document.getElementById("placeFormattedAddress").textContent = record.extraGMLocationContext?.PlaceFormattedAddress || "--";
        document.getElementById("placeEditorialSummary").textContent = record.extraGMLocationContext?.PlaceEditorialSummary || "--";
        
    }


    // 添加地图相关功能
    const showRouteButton = document.getElementById("showRoute");
    const mapFrame = document.getElementById("mapFrame");

    // 获取Google API密钥
    const apiKey = await getGoogleAPIKey();

    // 初始化地图
    if (apiKey) {
        updateMapSrc();
    } else {
        console.log('Google API Key is not set');
    }

    if (showRouteButton) {
        showRouteButton.addEventListener("click", () => {
        if (apiKey) {
            updateMapSrc();
        } else {
            console.log('Google API Key is not set');
            }
        });
    }

    function updateMapSrc() {
        // DOC: https://developers.google.com/maps/documentation/embed/embedding-map?hl=zh_CN
        const originElement = document.getElementById("origin");
        const origin = originElement ? encodeURIComponent(originElement.value) : '';
        // const destination = encodeURIComponent(document.getElementById("destination").value);
        const destinationElement = document.getElementById("destination");
        const destination = destinationElement ? encodeURIComponent(destinationElement.value) : '';
        // const waypoints = encodeURIComponent(document.getElementById("waypoints").value);
        const waypointsElement = document.getElementById("waypoints");
        const waypoints = waypointsElement ? encodeURIComponent(waypointsElement.value) : '';

        const baseUrl = "https://www.google.com/maps/embed/v1/directions";

        const newSrc = `${baseUrl}?key=${apiKey}&origin=${origin}&destination=${destination}&waypoints=${waypoints}&avoid=tolls|highways`;

        if (mapFrame) {
            mapFrame.src = newSrc;
        } else {
            console.warn('Map frame element not found');
        }
    }

    function getGoogleAPIKey() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('googleApiKey', (data) => {
                if (data.googleApiKey) {
                    resolve(data.googleApiKey);
                } else {
                    console.log('Google API Key is not set');
                    resolve(null);
                }
            });
        });
    }
});
