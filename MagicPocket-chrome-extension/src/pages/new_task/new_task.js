document.getElementById('createTaskBtn').addEventListener('click', () => {
    const taskDescription = document.getElementById('taskDescription').value.trim();
    
    if (!taskDescription) {
        alert('Please enter a task description');
        return;
    }

    window.Logger.log(window.LogCategory.UI, 'new_task_description_create_btn_clicked', {
        task_description: taskDescription
    });

    // 重置 NetworkManager 的静态属性
    NetworkManager.activeNodeMenu = false;
    NetworkManager.immutableIntents = new Set();

    // 清除现有记录并保存新任务
    chrome.storage.local.set({
        records: [],
        intentTree: null,
        currentTask: {
            description: taskDescription,
            createdAt: new Date().toISOString()
        }
    }, () => {
        // 关闭当前窗口
        window.close();
    });
}); 