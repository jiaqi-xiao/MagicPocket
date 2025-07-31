/**
 * Logger - 用户行为日志记录工具
 * 用于记录用户在扩展中的各类行为，包括UI交互、页面访问、网络请求等
 */

// 日志类别常量
const LogCategory = {
    UI: 'UI',                   // UI交互相关
    NAVIGATION: 'NAVIGATION',   // 页面访问相关
    NETWORK: 'NETWORK',         // 网络请求相关
    SYSTEM: 'SYSTEM'           // 系统相关
};

// 存储键名常量
const STORAGE_KEY = 'user_behavior_logs';
const MAX_LOGS = 1000;  // 最大日志条数

/**
 * 获取格式化的本地时间字符串
 * @returns {string} 格式化的时间字符串，例如：2025-01-01 18:11:47
 */
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

/**
 * 将日志数据转换为 CSV 格式
 * @param {Array} logs - 日志数组
 * @returns {string} CSV 格式的日志数据
 */
function convertLogsToCSV(logs) {
    // CSV 头部
    const headers = ['Local Time', 'Timestamp', 'Category', 'Action', 'URL', 'Details'];
    
    // 将日志转换为 CSV 行
    const rows = logs.map(log => {
        const url = log.data.url || '';
        // 移除 url 后将其他数据转换为 JSON 字符串
        const { url: _, ...otherData } = log.data;
        const details = JSON.stringify(otherData).replace(/"/g, '""'); // 转义双引号

        return [
            log.localTime,
            log.timestamp,
            log.category,
            log.action,
            url,
            details
        ].map(value => `"${value}"`).join(',');
    });

    // 组合头部和数据行
    return [headers.join(','), ...rows].join('\n');
}

/**
 * Logger - 用户行为日志记录工具
 * 用于记录用户在扩展中的各类行为，包括UI交互、页面访问、网络请求等
 */
const Logger = {
    // 日志队列
    _queue: [],
    // 是否正在处理队列
    _isProcessing: false,

    /**
     * 处理日志队列
     * @private
     */
    async _processQueue() {
        if (this._isProcessing || this._queue.length === 0) {
            return;
        }

        this._isProcessing = true;
        console.log(`[Logger] Processing queue, ${this._queue.length} items remaining`);

        try {
            while (this._queue.length > 0) {
                const logEntry = this._queue[0];
                await this._saveLog(logEntry);
                this._queue.shift(); // 移除已处理的日志
            }
        } finally {
            this._isProcessing = false;
            console.log('[Logger] Queue processing complete');
        }
    },

    /**
     * 保存单条日志
     * @private
     */
    async _saveLog(logEntry) {
        console.log(`[Logger] Saving log: ${logEntry.category}.${logEntry.action}`);
        
        // 获取现有日志
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const logs = result[STORAGE_KEY] || [];
        
        // 确保日志数量不超过限制
        if (logs.length >= MAX_LOGS) {
            console.log(`[Logger] Logs reached max limit (${MAX_LOGS}), removing oldest log`);
            logs.shift();
        }
        
        logs.push(logEntry);
        
        // 存储更新后的日志
        await chrome.storage.local.set({ [STORAGE_KEY]: logs });
        console.log(`[Logger] Log saved successfully. Total logs: ${logs.length}`);
    },

    /**
     * 记录日志
     * @param {string} category - 日志类别，使用 LogCategory 常量
     * @param {string} action - 具体行为
     * @param {Object} data - 相关数据
     * @returns {Promise<void>}
     */
    log: async function(category, action, data = {}) {
        const now = new Date();
        const logEntry = {
            localTime: getFormattedLocalTime(),
            timestamp: Math.floor(now.getTime() / 1000),
            category,
            action,
            data
        };

        // 添加到队列
        this._queue.push(logEntry);
        console.log(`[Logger] Added to queue: ${category}.${action}`);

        // 触发队列处理
        this._processQueue();
    },

    /**
     * 获取所有日志
     * @returns {Promise<Array>} 日志数组
     */
    getLogs: async function() {
        // 确保队列中的日志都已处理
        if (this._queue.length > 0) {
            console.log('[Logger] Processing remaining logs before retrieval');
            await this._processQueue();
        }

        const result = await chrome.storage.local.get(STORAGE_KEY);
        const logs = result[STORAGE_KEY] || [];
        console.log(`[Logger] Retrieved ${logs.length} logs from storage`);
        return logs;
    },

    /**
     * 导出日志为CSV文件
     * @returns {Promise<void>}
     */
    exportLogs: async function() {
        // 确保所有日志都已处理
        if (this._queue.length > 0) {
            console.log('[Logger] Processing remaining logs before export');
            await this._processQueue();
        }

        const logs = await this.getLogs();
        console.log(`[Logger] Preparing to export ${logs.length} logs`);
        
        // 按时间戳排序
        logs.sort((a, b) => a.timestamp - b.timestamp);
        
        // 转换为 CSV 格式
        const csvContent = convertLogsToCSV(logs);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const timestamp = getFormattedLocalTime().replace(/[: ]/g, '-');
        const filename = `user-behavior-logs-${timestamp}.csv`;

        // 创建下载链接
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        
        // 添加到文档并触发点击
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // 清理
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
        
        console.log(`[Logger] Exported ${logs.length} logs to ${filename}`);
    },

    /**
     * 清除所有日志
     * @returns {Promise<void>}
     */
    clearLogs: async function() {
        // 清空队列
        this._queue = [];
        this._isProcessing = false;

        await chrome.storage.local.remove(STORAGE_KEY);
        console.log('[Logger] All logs cleared');
    }
};

// 将 Logger 和 LogCategory 挂载到全局对象
window.Logger = Logger;
window.LogCategory = LogCategory;
