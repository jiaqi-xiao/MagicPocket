// popup.js


function displayRecords() {
    chrome.storage.local.get("records", async (data) => {
        const records = data.records || [];
        const recordsList = document.getElementById("recordsList");
        recordsList.innerHTML = "";

        if (records.length === 0) {
            recordsList.innerHTML = "<p>No items saved yet.</p>";
        } else {
            for (const record of records) {
                const item = document.createElement("div");
                item.className = "record-item";
                
                let contentHtml = '';
                if (record.type === "text") {
                    contentHtml = `<p>${record.content.substring(0, 50)}${record.content.length > 50 ? "..." : ""}</p>`;
                } else if (record.type === "image") {
                    try {
                        const imageData = await imageStorage.getImage(record.content);
                        contentHtml = `
                            <div class="image-preview">
                                <img src="${imageData}" alt="Screenshot" style="max-width: 100%; max-height: 150px; object-fit: contain;">
                            </div>
                        `;
                    } catch (error) {
                        console.warn('Error loading image:', error);
                        contentHtml = '<p>Error loading image</p>';
                    }
                }

                item.innerHTML = `
                    <strong>${record.type === "text" ? "Text" : "Screenshot"}</strong>
                    ${contentHtml}
                    <small>${new Date(record.timestamp).toLocaleString()}</small>
                    <button class="delete-btn" data-index="${records.indexOf(record)}">Delete</button>
                `;
                recordsList.appendChild(item);
            }
        }
    });
}

function deleteRecord(index) {
    chrome.storage.local.get("records", (data) => {
        const records = data.records || [];
        records.splice(index, 1);
        chrome.storage.local.set({ records: records }, () => {
            displayRecords();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('[Popup] DOM loaded, initializing event listeners');
    
    // Initialize mode toggle
    initializeModeToggle();
    
    // New Task button
    try {
        const newTaskBtn = document.getElementById("mp-popup-new-task-btn");
        if (newTaskBtn) {
            console.log('[Popup] Binding New Task button event');
            newTaskBtn.addEventListener("click", () => {
                window.Logger.log(window.LogCategory.UI, 'popup_new_task_btn_clicked', {});
                if (confirm("Are you sure you want to start a new task? This will clear all current records.")) {
                    window.Logger.log(window.LogCategory.UI, 'popup_new_task_confirmed', {});
                    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/new_task/new_task.html') });
                    window.close();
                } else {
                    window.Logger.log(window.LogCategory.UI, 'popup_new_task_cancelled', {});
                }
            });
        } else {
            console.error('[Popup] New Task button not found');
        }
    } catch (error) {
        console.error('[Popup] Error binding New Task button:', error);
    }

    document.getElementById("mp-popup-side-panel-btn").addEventListener("click", () => {
        window.Logger.log(window.LogCategory.UI, 'popup_side_panel_btn_clicked', {});
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.sidePanel.open({tabId: tabs[0].id}).catch(error => {
                console.error('Error opening side panel:', error);
                window.Logger.log(window.LogCategory.UI, 'popup_side_panel_open_failed', {
                    error: error.message
                });
            });
        });
        window.close();
    });

    // V2多层网络可视化按钮
    // document.getElementById("mp-popup-dev-multilevel-btn").addEventListener("click", () => {
    //     window.Logger.log(window.LogCategory.UI, 'popup_dev_multilevel_btn_clicked', {});
    //     chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    //         console.log('Sending V2 visualization message to tab:', tabs[0].id);
    //         chrome.tabs.sendMessage(tabs[0].id, {
    //             action: "showNetworkVisualizationV2"
    //         }, (response) => {
    //             if (chrome.runtime.lastError) {
    //                 console.error('Error sending message:', chrome.runtime.lastError);
    //                 window.Logger.log(window.LogCategory.UI, 'popup_dev_multilevel_failed', {
    //                     error: chrome.runtime.lastError.message
    //                 });
    //             } else {
    //                 console.log('V2 visualization message sent successfully:', response);
    //                 window.Logger.log(window.LogCategory.UI, 'popup_dev_multilevel_success', {
    //                     response: response
    //                 });
    //             }
    //         });
    //     });
    //     window.close();
    // });

    // 日志导出功能
    try {
        const exportLogsBtn = document.getElementById('mp-popup-export-logs-btn');
        if (exportLogsBtn) {
            console.log('[Popup] Binding Export Logs button event');
            exportLogsBtn.addEventListener('click', async () => {
                window.Logger.log(window.LogCategory.UI, 'popup_export_logs_btn_clicked', {});
                try {
                    await window.Logger.exportLogs();
                    window.Logger.log(window.LogCategory.UI, 'popup_logs_exported', {});
                } catch (error) {
                    window.Logger.log(window.LogCategory.UI, 'popup_logs_export_failed', {
                        error: error.message
                    });
                }
                window.close();
            });
        } else {
            console.error('[Popup] Export Logs button not found');
        }
    } catch (error) {
        console.error('[Popup] Error binding Export Logs button:', error);
    }

    // 日志清空功能
    try {
        const clearLogsBtn = document.getElementById('mp-popup-clear-logs-btn');
        if (clearLogsBtn) {
            console.log('[Popup] Binding Clear Logs button event');
            clearLogsBtn.addEventListener('click', async () => {
                console.log('[Popup] Clear Logs button clicked');
                if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
                    // Log the action before clearing (this will be the last log before clear)
                    window.Logger.log(window.LogCategory.UI, 'popup_clear_logs_confirmed', {});
                    
                    try {
                        console.log('[Popup] Clearing logs...');
                        await window.Logger.clearLogs();
                        alert('Logs cleared successfully');
                        console.log('[Popup] Logs cleared successfully');
                    } catch (error) {
                        console.error('[Popup] Error clearing logs:', error);
                        alert('Failed to clear logs: ' + error.message);
                    }
                    window.close();
                } else {
                    window.Logger.log(window.LogCategory.UI, 'popup_clear_logs_cancelled', {});
                }
            });
        } else {
            console.error('[Popup] Clear Logs button not found');
        }
    } catch (error) {
        console.error('[Popup] Error binding Clear Logs button:', error);
    }
});

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateList") {
        console.log("updateList message received in popup.js");
        displayRecords();
    }
});

// document.getElementById("mp-popup-screenshot-btn").addEventListener("click", () => {
//     window.Logger.log(window.LogCategory.UI, 'popup_screenshot_btn_clicked', {});
//     chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
//         console.log("screenshotBtn clicked in popup.js");
//         chrome.tabs.sendMessage(tabs[0].id, {action: "startScreenshot"});
//     });
//     window.close();
// });

// Mode Toggle Functions
function initializeModeToggle() {
    const normalRadio = document.getElementById('mp-mode-normal');
    const ablationRadio = document.getElementById('mp-mode-ablation');
    
    // Load current mode from storage
    chrome.storage.local.get(['analysisMode'], (result) => {
        const currentMode = result.analysisMode || 'normal';
        
        if (currentMode === 'normal') {
            normalRadio.checked = true;
        } else {
            ablationRadio.checked = true;
        }
    });
    
    // Add event listeners for both radio buttons
    normalRadio.addEventListener('change', handleModeToggle);
    ablationRadio.addEventListener('change', handleModeToggle);
}

function handleModeToggle(event) {
    if (!event.target.checked) {
        // Only handle the checked radio button
        return;
    }
    
    const newMode = event.target.value;
    
    // Save new mode to storage
    chrome.storage.local.set({ analysisMode: newMode }, () => {
        window.Logger.log(window.LogCategory.UI, 'popup_mode_toggle_changed', {
            new_mode: newMode,
            is_ablation: newMode === 'ablation'
        });
        
        console.log(`Analysis mode changed to: ${newMode}`);
    });
}
