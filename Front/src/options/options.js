document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const status = document.getElementById('status');

    // 加载保存的API Key
    chrome.storage.sync.get('googleApiKey', (data) => {
        if (data.googleApiKey) {
            apiKeyInput.value = data.googleApiKey;
        }
    });

    // 保存API Key
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value;
        chrome.storage.sync.set({ googleApiKey: apiKey }, () => {
            status.textContent = 'Settings saved';
            setTimeout(() => {
                status.textContent = '';
            }, 1000);
        });
    });
});