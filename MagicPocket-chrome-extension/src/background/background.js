// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveData") {
        chrome.storage.local.get(["records"], (result) => {
            let records = result.records || [];
            // 添加唯一id字段
            const newRecord = {
                id: Date.now().toString(),
                ...request.data
            };

            console.log("newRecord start to save: ", newRecord);
            
            // 检查数据大小
            const recordSize = JSON.stringify(newRecord).length;
            if (recordSize > 10240) {
                console.warn("Record size exceeds limit:", recordSize);
                sendResponse({ status: "error", message: "Record size too large" });
                return;
            }
            
            records.push(newRecord);
            chrome.storage.local.set({ records: records }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving data:", chrome.runtime.lastError);
                    sendResponse({ status: "error", message: chrome.runtime.lastError.message });
                } else {
                    console.log("Data saved successfully");
                    sendResponse({ status: "success" });
                }
            });
        });
        return true; // 这表明我们会异步发送响应
    }
    
    // Handle IntentTree storage
    if (request.action === "saveIntentTree") {
        chrome.storage.local.set({ intentTree: request.intentTree }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving intent tree:", chrome.runtime.lastError);
                sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            } else {
                console.log("Intent tree saved successfully");
                // console.log("Intent tree: ", request.intentTree);
                sendResponse({ status: "success" });
            }
        });
        return true;
    }

    if (request.action === "getIntentTree") {
        chrome.storage.local.get(['intentTree'], (result) => {
            sendResponse({ intentTree: result.intentTree });
            console.log("Intent tree sent to content script: ", result.intentTree);
        });
        return true;
    }

    if (request.action === "fetchRAG") {
        chrome.storage.sync.get(['selectedHost'], async (result) => {
            const host = result.selectedHost || 'http://localhost:8000/';
            fetch(`${host}rag`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request.data)
            })
            .then(response => response.json())
            .then(result => {
                sendResponse({ result });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        });
        return true; // 保持消息通道开放
    }

    if (request.action === "openSidePanel") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.sidePanel.open({tabId: tabs[0].id}).catch(error => {
                console.error('Error opening side panel:', error);
            });
        });
        return true;
    }

    if (request.action === "closeSidePanel") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.sidePanel.setOptions({
                tabId: tabs[0].id,
                enabled: false
            }).then(() => {
                chrome.sidePanel.setOptions({
                    tabId: tabs[0].id,
                    enabled: true
                });
            }).catch(error => {
                console.error('Error closing side panel:', error);
            });
        });
        return true;
    }
    
    // Handle content analysis request
    if (request.action === "analyzeContent") {
        console.log('[Background] Received analyzeContent message:', request);
        
        (async () => {
            try {
                const tabId = sender.tab ? sender.tab.id : null;
                const url = request.url;
                const contentStats = request.contentStats;
                
                console.log('[Background] Processing content analysis for:', url);
                console.log('[Background] Content stats:', contentStats);
                
                // Log page content analysis with await
                await logToStorage('NAVIGATION', 'navigation_page_content_analyzed', {
                    url: url,
                    word_count: contentStats.wordCount,
                    chs_count: contentStats.chsCount,
                    language: contentStats.language,
                    total_chars: contentStats.totalChars,
                    tab_id: tabId
                });
                
                console.log('[Background] Content analysis logged successfully');
                sendResponse({ status: "success" });
            } catch (error) {
                console.error('[Background] Error processing content analysis:', error);
                sendResponse({ status: "error", message: error.message });
            }
        })();
        
        return true; // Keep message channel open for async response
    }
});

// Helper function to log to storage using the same format as Logger
async function logToStorage(category, action, data = {}) {
    try {
        console.log(`[Background Logger] Starting to log: ${category}.${action}`);
        
        const now = new Date();
        const logEntry = {
            localTime: getFormattedLocalTime(),
            timestamp: Math.floor(now.getTime() / 1000),
            category,
            action,
            data
        };

        console.log('[Background Logger] Log entry created:', logEntry);

        // Get existing logs
        const result = await chrome.storage.local.get('user_behavior_logs');
        const logs = result.user_behavior_logs || [];
        
        console.log(`[Background Logger] Current logs count: ${logs.length}`);
        
        // Ensure logs don't exceed limit
        const MAX_LOGS = 10000;
        if (logs.length >= MAX_LOGS) {
            logs.shift();
            console.log('[Background Logger] Removed oldest log due to limit');
        }
        
        logs.push(logEntry);
        
        // Store updated logs
        await chrome.storage.local.set({ user_behavior_logs: logs });
        console.log(`[Background Logger] ${category}.${action} logged successfully. Total logs: ${logs.length}`);
    } catch (error) {
        console.error('[Background Logger] Error logging:', error);
        throw error; // Re-throw to allow caller to handle
    }
}

// Helper function to get formatted local time
function getFormattedLocalTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Function to check if URL should be analyzed
function shouldAnalyzeUrl(url) {
    if (!url) return false;
    
    // Skip system and extension URLs
    const skipPrefixes = [
        'chrome://',
        'chrome-extension://',
        'moz-extension://',
        'edge://',
        'about:',
        'data:',
        'blob:',
        'javascript:'
    ];
    
    return !skipPrefixes.some(prefix => url.startsWith(prefix));
}

// Tab event listeners for page navigation tracking

// Listen for new tab creation
chrome.tabs.onCreated.addListener((tab) => {
    if (shouldAnalyzeUrl(tab.url)) {
        logToStorage('NAVIGATION', 'navigation_page_opened', {
            url: tab.url || '',
            title: tab.title || '',
            timestamp: Date.now(),
            tab_id: tab.id
        });
    }
});

// Listen for tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only log when page is completely loaded and URL is available
    if (changeInfo.status === 'complete' && tab.url && shouldAnalyzeUrl(tab.url)) {
        // Log page opened event
        logToStorage('NAVIGATION', 'navigation_page_opened', {
            url: tab.url,
            title: tab.title || '',
            timestamp: Date.now(),
            tab_id: tabId
        });
        
        // Content analysis is now handled automatically by content script
        console.log(`[Background] Page loaded: ${tab.url}`);
    }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (shouldAnalyzeUrl(tab.url)) {
            logToStorage('NAVIGATION', 'navigation_tab_activated', {
                url: tab.url,
                title: tab.title || '',
                tab_id: activeInfo.tabId,
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.log('[Background] Error getting tab info:', error);
    }
});

