function handleMouseUp(e) {
    e.stopPropagation();
    const selection = window.getSelection();
    
    // 检查是否有选中的内容
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    
    const range = selection.getRangeAt(0);
    
    // 获取选中内容的容器元素
    const container = range.commonAncestorContainer;
    let selectedContent = '';
    
    // 如果选中的内容包含HTML元素
    if (container.nodeType === Node.ELEMENT_NODE) {
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(range.cloneContents());
        
        // 处理选中内容中的链接
        const links = tempDiv.getElementsByTagName('a');
        if (links.length > 0) {
            // 将所有链接转换为markdown格式
            Array.from(links).forEach(link => {
                const linkText = link.textContent;
                const linkUrl = link.href;
                const markdownLink = `[${linkText}](${linkUrl})`;
                link.outerHTML = markdownLink;
            });
        }
        selectedContent = tempDiv.textContent;
    } else {
        selectedContent = selection.toString();
    }
    
    selectedText = selectedContent.trim();
    
    if (selectedText) {
        console.log("Text selected:", selectedText);
        window.Logger.log(window.LogCategory.UI, 'text_selected', {
            text_length: selectedText.length,
            text_preview: selectedText,
            url: window.location.href
        });
        const rect = range.getBoundingClientRect();

        const x = rect.left + window.scrollX;
        const y = rect.top + window.scrollY - 50;

        setTimeout(() => showContextMenu(x, y), 0);
    } else {
        removeContextMenu();
    }
}

function showContextMenu(x, y) {
    console.log("Showing context menu");
    window.Logger.log(window.LogCategory.UI, 'show_context_menu', {
        url: window.location.href
    });
    removeContextMenu();

    contextMenu = document.createElement("div");
    contextMenu.className = "wcr-context-menu";
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.position = "absolute";
    contextMenu.style.zIndex = "9999";

    const saveButton = document.createElement("button");
    saveButton.className = "wcr-save-button";
    saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';
    saveButton.title = "Save Selection";

    const commentButton = document.createElement("button");
    commentButton.className = "wcr-comment-button";
    commentButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    commentButton.title = "Add Comment to Selection";

    contextMenu.appendChild(saveButton);
    contextMenu.appendChild(commentButton);
    document.body.appendChild(contextMenu);

    console.log("Context menu created and added to DOM");

    saveButton.addEventListener("click", () => {
        window.Logger.log(window.LogCategory.UI, 'context_menu_save_btn_clicked', {
            url: window.location.href
        });
        saveSelection();
    });

    commentButton.addEventListener("click", () => {
        window.Logger.log(window.LogCategory.UI, 'context_menu_comment_btn_clicked', {
            url: window.location.href
        });
        const comment = prompt("Enter your comment:");
        if (comment !== null) {
            window.Logger.log(window.LogCategory.UI, 'context_menu_add_comment', {
                has_comment: true,
                comment_length: comment.length
            });
            saveSelectionWithComment(comment);
        } else {
            window.Logger.log(window.LogCategory.UI, 'context_menu_add_comment_cancelled', {
                has_comment: false
            });
        }
    });
}

function saveSelectionWithComment(comment) {
    console.log("Saving selection with comment:", selectedText, comment);
    const paragraph = window.getSelection().anchorNode.parentElement;
    let data = {
        type: "text",
        content: selectedText,
        comment: comment,
        paragraph: paragraph.textContent,
        context: paragraph.textContent,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };

    loadExtraContextFromGoogleMaps(data)
    .then(data => {
        console.log("Data to save:", data);
        chrome.runtime.sendMessage({ action: "saveData", data: data }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError);
            } else {
                console.log("Save response:", response);
                removeContextMenu();
                // 清除选中状态
                window.getSelection().removeAllRanges();
            }
        });
    });
}

function handleGlobalMouseDown(e) {
    // 检查点击目标是否是视频播放器或其相关元素
    if (e.target.closest('.xgplayer') || // 视频播放器容器
        e.target.closest('video') ||      // 视频元素
        e.target.closest('.xgplayer-controls') // 控制栏
    ) {
        // 如果是视频播放器相关元素，不处理事件
        return;
    }

    console.log("Global mousedown detected", e.target);
    if (contextMenu) {
        if (contextMenu.contains(e.target)) {
            console.log("Mousedown inside context menu");
            if (e.target.closest('.wcr-save-button')) {
                console.log("Save button clicked");
                saveSelection();
            }
        } else {
            console.log("Mousedown outside context menu");
            removeContextMenu();
        }
    }
}

function saveSelection() {
    console.log("Saving selection:", selectedText);
    const paragraph = window.getSelection().anchorNode.parentElement;
    let data = {
        type: "text",
        content: selectedText,
        paragraph: paragraph.textContent,
        context: paragraph.textContent,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };

    loadExtraContextFromGoogleMaps(data) 
    .then(data => {
        console.log("Data to save:", data);

        chrome.runtime.sendMessage({ action: "saveData", data: data }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError);
            } else {
                console.log("Save response:", response);
                removeContextMenu();
                // 清除选中状态
                window.getSelection().removeAllRanges();
            }
        });
    });

    // console.log("Data to save:", data);

    // chrome.runtime.sendMessage({ action: "saveData", data: data }, (response) => {
    //     if (chrome.runtime.lastError) {
    //         console.error("Error sending message:", chrome.runtime.lastError);
    //     } else {
    //         console.log("Save response:", response);
    //         removeContextMenu();
    //         // 清除选中状态
    //         window.getSelection().removeAllRanges();
    //         // 输出当前已经保存的记录数
    //         chrome.storage.local.get("records", (data) => {
    //             if (data && data.records) {
    //                 console.log("[After save]Current records number:", data.records.length);
    //             } else {
    //                 console.log("[After save]No records");
    //             }
    //         });
    //     }
    // });

}

function removeContextMenu() {
    if (contextMenu) {
        console.log("Removing context menu");
        contextMenu.remove();
        contextMenu = null;
    }
}

async function loadExtraContextFromGoogleMaps(data) {
    const url = window.location.href;

    if (!url.startsWith("https://www.google.com/maps/place/")) {
        return data;
    }

    // https://www.google.com/maps/place/Bas%C3%ADlica+de+la+Sagrada+Fam%C3%ADlia/@41.3909016,2.1316527,14z/data=!4m6!3m5!1s0x12a4a2dcd83dfb93:0x9bd8aac21bc3c950!8m2!3d41.4036299!4d2.1743558!16zL20vMGc2bjM?entry=ttu&g_ep=EgoyMDI0MTAwOS4wIKXMDSoASAFQAw%3D%3D
    const textQuery = decodeURIComponent(url.match(/place\/([^/@]+)/)?.[1] || '');
    const [latitude, longitude] = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/i)?.slice(1).map(Number) || [null, null];

    // console.log("textQuery: ", textQuery);
    // console.log("latitude: ", latitude);
    // console.log("longitude: ", longitude);  

    const res = await placeInfoWithLocation(textQuery, latitude, longitude)

    if (res) {
        data.extraGMLocationContext = {
            PlaceDisplayName: res.PlaceDisplayName,
            PlaceFormattedAddress: res.PlaceFormattedAddress,
            PlaceID: res.PlaceID,
            PlaceEditorialSummary: res.PlaceEditorialSummary
        };
    }   
    return data;

}

async function placeInfoWithLocation(textQuery, longitude, latitude) {
    try {
        const apiKey = await getGoogleAPIKey();
        // console.log("Google API Key: ", apiKey);

        let res = {};
        
        if (!apiKey) {
            throw new Error("Google API Key 未设置");
        }
        // DOC: https://developers.google.com/maps/documentation/places/web-service/text-search
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.id,places.editorialSummary'
                // 'X-Goog-FieldMask': '*'
            },
            body: JSON.stringify({
                textQuery: textQuery,
                openNow: true,
                pageSize: 1,
                languageCode: 'en',
                locationBias: {
                    circle: {
                        center: {latitude: latitude, longitude: longitude},
                        radius: 500.0
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Google Maps API Return Info:", data);

        if (data.places && data.places.length > 0) {
            // data.places.forEach((place, index) => {
            //     console.log(`地点 ${index + 1}:`);
            //     console.log(`名称: ${place.displayName}`);
            //     console.log(`地址: ${place.formattedAddress}`);
            //     console.log("ID: ", place.id);
            //     console.log('---');
            // });

            res.PlaceDisplayName = data.places[0].displayName.text;
            res.PlaceFormattedAddress = data.places[0].formattedAddress;
            res.PlaceID = data.places[0].placeID;
            res.PlaceEditorialSummary = data.places[0].editorialSummary.text;

            console.log(`Name: ${res.PlaceDisplayName}`);
            console.log(`Address: ${res.PlaceFormattedAddress}`);
            console.log("PlaceID: ", res.PlaceID);
            console.log("PlaceEditorialSummary: ", res.PlaceEditorialSummary);
            console.log('---');

        } else {
            console.log("没有找到符合条件的地点");
        }
        return res;
    } catch (error) {
        console.error("获取地点信息时出错:", error);
        return null;
    }
}