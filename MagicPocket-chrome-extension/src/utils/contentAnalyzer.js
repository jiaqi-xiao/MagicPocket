/**
 * Content Analyzer - 网页内容分析工具
 * 用于统计网页文本内容的字数、词数和语言类型
 */

/**
 * 统计中文字符数量
 * @param {string} text - 文本内容
 * @returns {number} 中文字符数
 */
function countChineseCharacters(text) {
    const chineseRegex = /[\u4e00-\u9fa5]/g;
    const matches = text.match(chineseRegex);
    return matches ? matches.length : 0;
}

/**
 * 统计英文单词数量
 * @param {string} text - 文本内容
 * @returns {number} 英文单词数
 */
function countEnglishWords(text) {
    // 移除中文字符，只保留英文文本
    const englishText = text.replace(/[\u4e00-\u9fa5]/g, ' ');
    // 按空格和标点符号分割单词
    const words = englishText
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 0);
    return words.length;
}

/**
 * 检测文本主要语言类型
 * @param {string} text - 文本内容
 * @returns {string} 语言类型: 'zh' | 'en' | 'mixed'
 */
function detectLanguage(text) {
    const chineseCount = countChineseCharacters(text);
    const englishWords = countEnglishWords(text);
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 'unknown';
    
    const chineseRatio = chineseCount / totalChars;
    
    if (chineseRatio > 0.3) {
        return englishWords > chineseCount * 0.5 ? 'mixed' : 'zh';
    } else {
        return englishWords > 10 ? 'en' : 'mixed';
    }
}

/**
 * 获取页面主要文本内容
 * @returns {string} 页面文本内容
 */
function getPageTextContent() {
    // 获取主要内容区域的文本，排除脚本、样式等
    const elementsToExclude = ['script', 'style', 'nav', 'header', 'footer', 'aside'];
    const selector = elementsToExclude.map(tag => `:not(${tag})`).join('');
    
    // 优先获取 main、article、.content 等主要内容区域
    let contentElement = document.querySelector('main, article, [role="main"], .content, .main-content');
    
    if (!contentElement) {
        // 如果没有明确的内容区域，获取 body 内容但排除不需要的元素
        contentElement = document.body;
    }
    
    if (!contentElement) {
        return '';
    }
    
    // 克隆元素以避免影响原始 DOM
    const clonedElement = contentElement.cloneNode(true);
    
    // 移除不需要的元素
    elementsToExclude.forEach(tag => {
        const elements = clonedElement.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    });
    
    // 移除隐藏元素
    const hiddenElements = clonedElement.querySelectorAll('[style*="display:none"], [style*="display: none"], .hidden');
    hiddenElements.forEach(el => el.remove());
    
    return clonedElement.textContent || clonedElement.innerText || '';
}

/**
 * 分析页面内容统计信息
 * @returns {Object} 内容统计结果
 */
function analyzePageContent() {
    try {
        const textContent = getPageTextContent();
        const cleanText = textContent.trim();
        
        if (!cleanText) {
            return {
                wordCount: 0,
                chsCount: 0,
                totalChars: 0,
                language: 'unknown',
                error: null
            };
        }
        
        const chineseCount = countChineseCharacters(cleanText);
        const englishWords = countEnglishWords(cleanText);
        const language = detectLanguage(cleanText);
        const totalChars = cleanText.length;
        
        return {
            wordCount: englishWords,      // 英文单词数
            chsCount: chineseCount,       // 中文字符数
            totalChars: totalChars,       // 总字符数
            language: language,           // 主要语言
            error: null
        };
    } catch (error) {
        console.error('Error analyzing page content:', error);
        return {
            wordCount: 0,
            chsCount: 0,
            totalChars: 0,
            language: 'unknown',
            error: error.message
        };
    }
}

/**
 * 异步分析页面内容（用于避免阻塞主线程）
 * @returns {Promise<Object>} 内容统计结果
 */
async function analyzePageContentAsync() {
    return new Promise((resolve) => {
        // 使用 setTimeout 让分析在下一个事件循环中执行
        setTimeout(() => {
            const result = analyzePageContent();
            resolve(result);
        }, 0);
    });
}

// 将工具函数挂载到全局对象，供其他脚本使用
window.ContentAnalyzer = {
    analyzePageContent,
    analyzePageContentAsync,
    countChineseCharacters,
    countEnglishWords,
    detectLanguage,
    getPageTextContent
};

// 如果在 background script 中使用，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyzePageContent,
        analyzePageContentAsync,
        countChineseCharacters,
        countEnglishWords,
        detectLanguage,
        getPageTextContent
    };
}