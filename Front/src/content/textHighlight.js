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
    `;
}

// Initialize styles
updateStyles();

window.toggleHighlight = async function() {
    console.log("Toggle highlight called");
    isHighlightActive = !isHighlightActive;
    const highlightBtn = document.getElementById('highlightTextBtn');
    
    if (isHighlightActive) {
        highlightBtn.style.backgroundColor = '#4CAF50';
        highlightBtn.textContent = 'Remove Highlight';
        await processPageContent();
    } else {
        highlightBtn.style.backgroundColor = '#f5f5f5';
        highlightBtn.textContent = 'Highlight Text';
        removeHighlights();
    }
}

function formatIntentTree(rawIntentTree) {
    const generateId = () => Math.floor(Math.random() * 1000000);
    
    // 创建默认的空记录
    const createDefaultRecord = () => ({
        id: generateId(),
        comment: '',
        content: '',
        context: '',
        isLeafNode: true
    });
    
    const formatItems = (items) => {
        return Object.entries(items).map(([intentName, records]) => {
            // 如果records为空，使用默认记录
            const processedRecords = records.length ? records : [createDefaultRecord()];
            
            return {
                id: generateId(),
                intent: intentName,
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

    // 处理主要的转换逻辑
    if (rawIntentTree.item) {
        return {
            scenario: rawIntentTree.scenario,
            child: formatItems(rawIntentTree.item)
        };
    }

    // 如果已经是正确格式，使用原有的formatIntentTree逻辑
    return {
        scenario: rawIntentTree.scenario,
        child: rawIntentTree.child?.map(formatChild).filter(Boolean) || []
    };
}

async function processPageContent() {
    const textContent = document.body.innerText;
    const response = await chrome.runtime.sendMessage({ action: "getIntentTree" });
    const intentTree = response.intentTree;
    
    // 添加错误检查
    if (!intentTree) {
        console.error('No intent tree found');
        return;
    }

    // 确保格式化后的intentTree符合后端要求
    const formattedIntentTree = formatIntentTree(intentTree);
    
    // 构建符合RAGRequest模型的请求体
    const ragRequest = {
        scenario: formattedIntentTree.scenario,
        k: 3,
        top_threshold: 0.5,
        bottom_threshold: 0.5,
        intentTree: formattedIntentTree,
        webContent: textContent
    };

    // 添加调试日志
    // console.log("RAG request payload:", ragRequest);
    // console.log("Formatted intent tree:", formattedIntentTree);

    try {
        validateRAGRequest(ragRequest);
        // 改为通过 background script 发送请求
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
    const sentencesToHighlight = new Map();
    
    // 辅助函数：处理多行文本
    const processSentence = (sentence, className) => {
        // 分割多行文本并清理
        const cleanedSentences = sentence
            .split(/[\n\r\t]+/)  // 按换行符和制表符分割
            .map(s => s.trim())  // 去除首尾空格
            .filter(s => s.length > 0)  // 过滤空字符串
            .filter(s => /[a-zA-Z\u4e00-\u9fa5]/.test(s));  // 确保包含至少一个字母或中文字符
        
        // 为每个子句添加高亮类
        cleanedSentences.forEach(cleanedSentence => {
            const classes = sentencesToHighlight.get(cleanedSentence) || [];
            if (!classes.includes(className)) {
                classes.push(className);
            }
            sentencesToHighlight.set(cleanedSentence, classes);
        });
    };
    
    // 处理 top_k 结果
    if (highlightConfig.topK.enabled) {
        Object.values(top_k).flat().forEach(sentence => {
            processSentence(sentence, TOP_K_HIGHLIGHT_CLASS);
        });
    }
    
    // 处理 bottom_k 结果
    if (highlightConfig.bottomK.enabled) {
        Object.values(bottom_k).flat().forEach(sentence => {
            processSentence(sentence, BOTTOM_K_HIGHLIGHT_CLASS);
        });
    }

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (node.parentElement.tagName === 'SCRIPT' || 
                    node.parentElement.tagName === 'STYLE' ||
                    node.parentElement.classList.contains(TOP_K_HIGHLIGHT_CLASS) ||
                    node.parentElement.classList.contains(BOTTOM_K_HIGHLIGHT_CLASS)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    console.log(sentencesToHighlight);

    // 修改文本节点处理逻辑
    textNodes.forEach(textNode => {
        if (!textNode || !textNode.parentNode) {
            console.warn('Invalid text node encountered, skipping...');
            return;
        }
        
        // 只处理长度大于2的文本节点
        if (textNode.textContent.trim().length <= 2) {
            return;
        }
        // console.log("Current text node:", textNode.textContent);

        let text = textNode.textContent;
        let hasMatch = false;
        let fragments = [];
        let lastIndex = 0;

        sentencesToHighlight.forEach((classNames, sentence) => {
            let index = text.indexOf(sentence);
            while (index !== -1) {
                hasMatch = true;
                // 添加匹配前的文本
                if (index > lastIndex) {
                    fragments.push(document.createTextNode(text.substring(lastIndex, index)));
                }
                // 创建高亮span
                const span = document.createElement('span');
                span.className = classNames.join(' ');
                span.textContent = sentence;
                fragments.push(span);
                
                lastIndex = index + sentence.length;
                index = text.indexOf(sentence, lastIndex);
            }
        });

        // 如果有匹配，替换节点
        if (hasMatch) {
            // 添加剩余文本
            if (lastIndex < text.length) {
                fragments.push(document.createTextNode(text.substring(lastIndex)));
            }
            // 创建包含所有片段的容器
            const container = document.createDocumentFragment();
            fragments.forEach(fragment => container.appendChild(fragment));
            textNode.parentNode.replaceChild(container, textNode);
        }
    });
}

function removeHighlights() {
    // Remove all highlights
    [TOP_K_HIGHLIGHT_CLASS, BOTTOM_K_HIGHLIGHT_CLASS].forEach(className => {
        const highlights = document.getElementsByClassName(className);
        while (highlights.length > 0) {
            const highlight = highlights[0];
            const textNode = document.createTextNode(highlight.textContent);
            highlight.parentNode.replaceChild(textNode, highlight);
        }
    });
}

// Export configuration functions
window.setHighlightConfig = function(config) {
    highlightConfig = { ...highlightConfig, ...config };
    // Update styles
    updateStyles();
}

// 添加消息监听器
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
    // if (ragRequest.webContent.length > 1000) {
    //     throw new Error('Web content exceeds maximum length of 1000 characters');
    // }
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