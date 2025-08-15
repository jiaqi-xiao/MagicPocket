const TOP_K_HIGHLIGHT_CLASS = 'mp-text-highlight-top';
const BOTTOM_K_HIGHLIGHT_CLASS = 'mp-text-highlight-bottom';
let isHighlightActive = false;
let highlightConfig = {
    topK: {
        enabled: true,
        color: '#FFEB3B50'  // yellow with 50% opacity
    },
    bottomK: {
        enabled: true,
        color: '#F4433650'  // red with 50% opacity
    }
};

// Add styles to document if not already added
function updateStyles() {
    let styleElement = document.getElementById('mp-highlight-styles');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'mp-highlight-styles';
        document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
        .${TOP_K_HIGHLIGHT_CLASS} {
            background-color: ${highlightConfig.topK.color};
            border-radius: 3px;
            padding: 2px;
        }
        .${BOTTOM_K_HIGHLIGHT_CLASS} {
            background-color: ${highlightConfig.bottomK.color};
            border-radius: 3px;
            padding: 2px;
        }
        .mp-loading-overlay {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(255, 255, 255, 0.9);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        .mp-loading-spinner {
            width: 24px;
            height: 24px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: mp-spin 1s linear infinite;
        }
        @keyframes mp-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
}

// Initialize styles
updateStyles();

function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'mp-loading-overlay';
    overlay.id = 'mp-loading-overlay';
    
    const spinner = document.createElement('div');
    spinner.className = 'mp-loading-spinner';
    
    const text = document.createElement('div');
    text.textContent = 'Processing Highlight...';
    text.style.color = '#666';
    text.style.fontSize = '14px';
    
    overlay.appendChild(spinner);
    overlay.appendChild(text);
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('mp-loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

window.toggleHighlight = async function() {
    console.log("Toggle highlight called");
    isHighlightActive = !isHighlightActive;
    const highlightBtn = document.getElementById('highlightTextBtn');
    
    // 获取当前所有页面的高亮状态
    const { pageHighlightStates = {} } = await chrome.storage.local.get('pageHighlightStates');
    
    // 更新当前页面的状态
    pageHighlightStates[window.location.href] = isHighlightActive;
    
    // 保存所有页面的状态
    await chrome.storage.local.set({ pageHighlightStates });
    
    // 通知sidePanel状态变化
    chrome.runtime.sendMessage({
        action: 'highlightStateChanged',
        isActive: isHighlightActive,
        url: window.location.href
    });
    
    if (isHighlightActive) {
        // 只在按钮存在时更新按钮样式
        if (highlightBtn) {
            highlightBtn.style.backgroundColor = '#4CAF50';
            highlightBtn.textContent = 'Remove Highlight';
        }
        showLoadingOverlay();
        try {
            await processPageContent();
        } finally {
            hideLoadingOverlay();
        }
    } else {
        // 只在按钮存在时更新按钮样式
        if (highlightBtn) {
            highlightBtn.style.backgroundColor = '#f5f5f5';
            highlightBtn.textContent = 'Highlight Text';
        }
        removeHighlights();
    }
}

function formatIntentTree(rawIntentTree) {
    const generateId = () => Math.floor(Math.random() * 1000000);

    const formatItems = (items) => {
        return Object.entries(items).map(([intentName, intentData]) => {
            const processedRecords = intentData.group || [];
            
            return {
                id: generateId(),
                intent: intentName,
                description: intentData.description || '',  
                isLeafNode: false,
                immutable: false,
                priority: 5,
                child: processedRecords.map(record => ({
                    id: record.id || generateId(),
                    comment: record.comment || '',
                    content: record.content || record.text || '',
                    context: record.context || '',
                    isLeafNode: true
                })),
                child_num: processedRecords.length
            };
        });
    };

    if (rawIntentTree.item) {
        return {
            scenario: rawIntentTree.scenario,
            child: formatItems(rawIntentTree.item)
        };
    }

    return {
        scenario: rawIntentTree.scenario,
        child: rawIntentTree.child?.map(formatChild).filter(Boolean) || []
    };
}

async function processPageContent() {
    const textContent = document.body.innerText;
    const response = await chrome.runtime.sendMessage({ action: "getIntentTree" });
    const intentTree = response.intentTree;
    
    if (!intentTree) {
        console.error('No intent tree found');
        return;
    }

    const formattedIntentTree = formatIntentTree(intentTree);
    
    const ragRequest = {
        scenario: formattedIntentTree.scenario,
        k: 3,
        top_threshold: 0.5,
        bottom_threshold: 0.5,
        intentTree: intentTree,
        webContent: textContent
    };

    try {
        // validateRAGRequest(ragRequest);
        const response = await chrome.runtime.sendMessage({
            action: "fetchRAG",
            data: ragRequest
        });

        if (response.error) {
            throw new Error(response.error);
        }

        highlightMatchingText(response.result);
    } catch (error) {
        console.error('Error calling RAG API:', error);
    }
}

function highlightMatchingText(ragResult) {
    removeHighlights();
    console.log("ragResult: ", ragResult);
    const { top_k, bottom_k } = ragResult;

    // 测试代码：将top_k中的第一个intent的第一个句子添加到bottom_k中
    // TODO: 测试后删除这段代码
    // const firstTopIntent = Object.keys(top_k)[0];
    // if (firstTopIntent && top_k[firstTopIntent].length > 0) {
    //     const testSentence = top_k[firstTopIntent][0];
    //     if (!bottom_k["Test_Overlap_Intent"]) {
    //         bottom_k["Test_Overlap_Intent"] = [];
    //     }
    //     bottom_k["Test_Overlap_Intent"].push(testSentence);
    //     console.log("Added test overlap:", testSentence);
    // }
    const highlightStats = {
        top_k_texts: new Set(),
        bottom_k_texts: new Set(),
        highlighted_top_k_texts: new Set(),
        highlighted_bottom_k_texts: new Set()
    };

    const sentencesToHighlight = new Map();

    const processSentence = (sentence, className, intents) => {
        if (className === TOP_K_HIGHLIGHT_CLASS) {
            highlightStats.top_k_texts.add(sentence);
        } else if (className === BOTTOM_K_HIGHLIGHT_CLASS) {
            highlightStats.bottom_k_texts.add(sentence);
        }

        const cleanedSentences = sentence
            .split(/[\n\r\t]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0 && /[a-zA-Z\u4e00-\u9fa5]/.test(s));

        cleanedSentences.forEach(cleanedSentence => {
            const existingEntry = sentencesToHighlight.get(cleanedSentence) || {
                classes: new Set(),  
                intents: new Set()   
            };
            
            existingEntry.classes.add(className);
            
            intents.forEach(intentInfo => {
                existingEntry.intents.add(JSON.stringify(intentInfo));
            });
            
            if (className === TOP_K_HIGHLIGHT_CLASS) {
                highlightStats.highlighted_top_k_texts.add(cleanedSentence);
            } else if (className === BOTTOM_K_HIGHLIGHT_CLASS) {
                highlightStats.highlighted_bottom_k_texts.add(cleanedSentence);
            }
            
            sentencesToHighlight.set(cleanedSentence, existingEntry);
        });
    };

    if (highlightConfig.topK.enabled) {
        const sentenceIntents = new Map(); // Map<sentence, Set<intentInfo>>
        
        Object.entries(top_k).forEach(([intent, sentences]) => {
            sentences.forEach(sentence => {
                const intentInfo = {
                    intent,
                    type: 'top_k',
                    color: highlightConfig.topK.color
                };
                
                if (!sentenceIntents.has(sentence)) {
                    sentenceIntents.set(sentence, new Set());
                }
                sentenceIntents.get(sentence).add(JSON.stringify(intentInfo));
            });
        });

        sentenceIntents.forEach((intents, sentence) => {
            processSentence(sentence, TOP_K_HIGHLIGHT_CLASS, Array.from(intents).map(i => JSON.parse(i)));
        });
    }

    if (highlightConfig.bottomK.enabled) {
        const sentenceIntents = new Map();
        
        Object.entries(bottom_k).forEach(([intent, sentences]) => {
            sentences.forEach(sentence => {
                const intentInfo = {
                    intent,
                    type: 'bottom_k',
                    color: highlightConfig.bottomK.color
                };
                
                if (!sentenceIntents.has(sentence)) {
                    sentenceIntents.set(sentence, new Set());
                }
                sentenceIntents.get(sentence).add(JSON.stringify(intentInfo));
            });
        });

        sentenceIntents.forEach((intents, sentence) => {
            processSentence(sentence, BOTTOM_K_HIGHLIGHT_CLASS, Array.from(intents).map(i => JSON.parse(i)));
        });
    }

    sentencesToHighlight.forEach((highlightInfo, text) => {
        const range = createRangeFromMatch(text);
        if (range) {
            highlightRange(range, {
                classes: Array.from(highlightInfo.classes),
                intents: Array.from(highlightInfo.intents).map(intentKey => {
                    try {
                        return JSON.parse(intentKey);
                    } catch (e) {
                        console.warn('Failed to parse intent:', e);
                        const type = highlightInfo.classes.has(TOP_K_HIGHLIGHT_CLASS) ? 'top_k' : 'bottom_k';
                        return {
                            intent: intentKey,
                            type: type,
                            color: type === 'top_k' 
                                ? highlightConfig.topK.color 
                                : highlightConfig.bottomK.color
                        };
                    }
                })
            });
        }
    });

    // 在完成所有高亮后记录日志
    window.Logger.log(window.LogCategory.UI, 'text_highlight_updated', {
        url: window.location.href,
        // 接口返回的文本统计
        top_k_count: highlightStats.top_k_texts.size,
        bottom_k_count: highlightStats.bottom_k_texts.size,
        top_k_texts: Array.from(highlightStats.top_k_texts),
        bottom_k_texts: Array.from(highlightStats.bottom_k_texts),
        // 实际高亮的文本统计
        highlighted_top_k_count: highlightStats.highlighted_top_k_texts.size,
        highlighted_bottom_k_count: highlightStats.highlighted_bottom_k_texts.size,
        highlighted_top_k_texts: Array.from(highlightStats.highlighted_top_k_texts),
        highlighted_bottom_k_texts: Array.from(highlightStats.highlighted_bottom_k_texts),
        // 添加更多调试信息
        sentencesToHighlight: Array.from(sentencesToHighlight.entries()).map(([text, info]) => ({
            text,
            classes: Array.from(info.classes),
            intents: Array.from(info.intents).map(i => {
                try {
                    return JSON.parse(i);
                } catch (e) {
                    return i;
                }
            })
        }))
    });
    updateHighlightStats(highlightStats.top_k_texts.size, highlightStats.bottom_k_texts.size);
}

/**
 * 创建带有事件监听器的高亮span元素
 * @param {Object} highlightInfo - 包含高亮信息的对象
 * @param {Array<string>} highlightInfo.classes - 要应用的CSS类名数组
 * @param {Array<Object>} highlightInfo.intents - 意图信息数组
 * @returns {HTMLSpanElement} 配置好的span元素
 */
const createHighlightSpan = (highlightInfo) => {
    const span = document.createElement('span');
    span.className = highlightInfo.classes.join(' ');
    span.dataset.intents = JSON.stringify(highlightInfo.intents);
    
    span.addEventListener('mouseenter', function() {
        if (window.tooltipManager) {
            const intents = JSON.parse(this.dataset.intents);
            window.tooltipManager.showMultiple(intents, this);
        }
    });
    
    span.addEventListener('mouseleave', function() {
        if (window.tooltipManager) {
            window.tooltipManager.hide();
        }
    });

    return span;
};

/**
 * 处理文本高亮，支持跨节点的复杂情况
 * 实现了三层处理策略：
 * 1. 纯文本节点使用surroundContents
 * 2. 混合节点使用extractContents和递归处理
 * 3. 失败时使用基础的提取和插入方法
 * 
 * @param {Range} range - DOM范围对象，表示要高亮的文本范围
 * @param {Object} highlightInfo - 高亮配置信息
 */
const highlightRange = (range, highlightInfo) => {
    if (!range) return;

    try {
        let ancestor = range.commonAncestorContainer;
        let containsNonText = false;
        let node = range.startContainer;
        
        while (node && node !== range.endContainer) {
            if (node.nodeType !== Node.TEXT_NODE && node !== ancestor) {
                containsNonText = true;
                break;
            }
            node = getNextNode(node);
        }

        if (!containsNonText) {
            const span = createHighlightSpan(highlightInfo);
            range.surroundContents(span);
        } else {
            const fragment = range.extractContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);
            
            const processTextNodes = (node) => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    const span = createHighlightSpan(highlightInfo);
                    span.textContent = node.textContent;
                    node.parentNode.replaceChild(span, node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    Array.from(node.childNodes).forEach(processTextNodes);
                }
            };
            
            processTextNodes(tempDiv);
            range.insertNode(tempDiv);
            
            while (tempDiv.firstChild) {
                tempDiv.parentNode.insertBefore(tempDiv.firstChild, tempDiv);
            }
            tempDiv.parentNode.removeChild(tempDiv);
        }
    } catch (error) {
        window.Logger.log(window.LogCategory.SYSTEM, 'highlight_range_failed', { error: error.message, highlightInfo: highlightInfo, url: window.location.href });
        try {
            const fragment = range.extractContents();
            const span = createHighlightSpan(highlightInfo);
            span.appendChild(fragment);
            range.insertNode(span);
        } catch (extractError) {
            console.error('Failed to handle highlight:', extractError);
        }
    }
};

/**
 * 获取DOM树中的下一个节点
 * 按照前序遍历的顺序：先子节点，然后兄弟节点，最后父节点的兄弟节点
 * @param {Node} node - 当前节点
 * @returns {Node|null} 下一个节点或null
 */
const getNextNode = (node) => {
    if (node.firstChild) return node.firstChild;
    while (node) {
        if (node.nextSibling) return node.nextSibling;
        node = node.parentNode;
    }
    return null;
};

const createRangeFromMatch = (text) => {
    if (!text || typeof text !== 'string' || text.length === 0) {
        return null;
    }

    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const range = document.createRange();
    const treeWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                const parent = node.parentElement;
                if (!parent || 
                    parent.tagName === 'SCRIPT' || 
                    parent.tagName === 'STYLE' ||
                    parent.classList.contains(TOP_K_HIGHLIGHT_CLASS) ||
                    parent.classList.contains(BOTTOM_K_HIGHLIGHT_CLASS)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node;
    let nodeCount = 0;
    let textBuffer = '';
    let nodeBuffer = [];

    while ((node = treeWalker.nextNode()) !== null) {
        nodeCount++;
        const nodeText = node.textContent || '';
        const normalizedNodeText = nodeText.replace(/\s+/g, ' ');
        
        textBuffer += normalizedNodeText;
        nodeBuffer.push({
            node,
            text: normalizedNodeText,
            startIndex: textBuffer.length - normalizedNodeText.length
        });

        while (textBuffer.length > normalizedText.length * 3 && nodeBuffer.length > 1) {
            const removed = nodeBuffer.shift();
            textBuffer = textBuffer.slice(removed.text.length);
            nodeBuffer.forEach(item => {
                item.startIndex -= removed.text.length;
            });
        }

        const matchIndex = textBuffer.indexOf(normalizedText);
        if (matchIndex !== -1) {
            let startNodeInfo = null;
            let endNodeInfo = null;
            let matchEnd = matchIndex + normalizedText.length;
            let startNodeIndex = -1;

            for (let i = 0; i < nodeBuffer.length; i++) {
                const nodeInfo = nodeBuffer[i];
                const nodeStartIndex = nodeInfo.startIndex;
                const nodeEndIndex = nodeStartIndex + nodeInfo.text.length;
                
                if (nodeStartIndex <= matchIndex && nodeEndIndex > matchIndex) {
                    const localOffset = matchIndex - nodeStartIndex;
                    if (localOffset <= nodeInfo.text.length) {
                        startNodeInfo = {
                            ...nodeInfo,
                            offset: localOffset
                        };
                        startNodeIndex = i;
                        break;
                    }
                }
            }

            if (startNodeInfo && startNodeIndex !== -1) {
                for (let i = startNodeIndex; i < nodeBuffer.length; i++) {
                    const nodeInfo = nodeBuffer[i];
                    const nodeStartIndex = nodeInfo.startIndex;
                    const nodeEndIndex = nodeStartIndex + nodeInfo.text.length;
                    
                    if (nodeStartIndex < matchEnd && nodeEndIndex >= matchEnd) {
                        const localOffset = matchEnd - nodeStartIndex;
                        if (localOffset <= nodeInfo.text.length) {
                            endNodeInfo = {
                                ...nodeInfo,
                                offset: localOffset
                            };
                            break;
                        }
                    }
                }
            }

            if (startNodeInfo && endNodeInfo) {
                try {
                    range.setStart(startNodeInfo.node, startNodeInfo.offset);
                    range.setEnd(endNodeInfo.node, endNodeInfo.offset);
                    return range;
                } catch (error) {
                    console.warn('Failed to set range:', error);
                    continue;
                }
            }
        }
    }
    return null;
};

function removeHighlights() {
    const highlights = document.querySelectorAll(`.${TOP_K_HIGHLIGHT_CLASS}, .${BOTTOM_K_HIGHLIGHT_CLASS}`);
    highlights.forEach(highlight => {
        const textNode = document.createTextNode(highlight.textContent);
        if (highlight.parentNode) {
            highlight.parentNode.replaceChild(textNode, highlight);
        }
    });
    // updateHighlightStats(0, 0); // Pass 0 for both counts since we're removing all highlights
    // Dispatch an event to hide the stats window
    window.dispatchEvent(new CustomEvent('hideHighlightStats'));
}

let UIhighlightStats = {
    topK: 0,
    bottomK: 0
};

function updateHighlightStats(topKSize, bottomKSize) {
    // Dispatch custom event with stats
    window.dispatchEvent(new CustomEvent('highlightStatsUpdated', {
        detail: {
            topK: topKSize,
            bottomK: bottomKSize
        }
    }));
}

window.setHighlightConfig = function(config) {
    highlightConfig = { ...highlightConfig, ...config };
    updateStyles();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleHighlight') {
        window.toggleHighlight();
    }
}); 

function validateRAGRequest(ragRequest) {
    if (!ragRequest.scenario) {
        throw new Error('Scenario is required');
    }
    if (!ragRequest.intentTree) {
        throw new Error('Intent tree is required');
    }
    if (ragRequest.k < 1) {
        throw new Error('k must be greater than 0');
    }
    if (ragRequest.top_threshold < 0 || ragRequest.top_threshold > 1) {
        throw new Error('top_threshold must be between 0 and 1');
    }
    if (ragRequest.bottom_threshold < 0 || ragRequest.bottom_threshold > 1) {
        throw new Error('bottom_threshold must be between 0 and 1');
    }
} 