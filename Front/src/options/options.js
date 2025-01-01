document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const hostSelect = document.getElementById('hostSelect');
    const newHostInput = document.getElementById('newHost');
    const addHostButton = document.getElementById('addHostButton');
    const saveButton = document.getElementById('saveButton');
    const status = document.getElementById('status');

    // Default host
    const DEFAULT_HOST = 'http://localhost:8000/';

    // Load saved hosts and API Key
    chrome.storage.sync.get(['hosts', 'selectedHost', 'googleApiKey'], (data) => {
        if (data.googleApiKey) {
            apiKeyInput.value = data.googleApiKey;
        }

        // Initialize hosts array with default if none exists
        const hosts = data.hosts || [DEFAULT_HOST];
        updateHostSelect(hosts);

        // Select the previously selected host or default
        if (data.selectedHost && hosts.includes(data.selectedHost)) {
            hostSelect.value = data.selectedHost;
        } else {
            hostSelect.value = hosts[0];
            // Save the default selection
            chrome.storage.sync.set({ selectedHost: hosts[0] });
        }
    });

    // Update select dropdown with hosts
    function updateHostSelect(hosts) {
        hostSelect.innerHTML = '';
        hosts.forEach(host => {
            const option = document.createElement('option');
            option.value = host;
            option.textContent = host;
            hostSelect.appendChild(option);
        });
    }

    // Add new host
    addHostButton.addEventListener('click', () => {
        const newHost = newHostInput.value.trim();
        if (!newHost) return;

        // Ensure URL has protocol and trailing slash
        let formattedHost = newHost;
        if (!formattedHost.startsWith('http://') && !formattedHost.startsWith('https://')) {
            formattedHost = 'http://' + formattedHost;
        }
        if (!formattedHost.endsWith('/')) {
            formattedHost += '/';
        }

        chrome.storage.sync.get('hosts', (data) => {
            const hosts = data.hosts || [DEFAULT_HOST];
            if (!hosts.includes(formattedHost)) {
                if (hosts.length >= 5) {
                    // Remove the oldest host (first item in the array)
                    hosts.shift();
                }
                // Add new host to the end
                hosts.push(formattedHost);
                chrome.storage.sync.set({ hosts }, () => {
                    updateHostSelect(hosts);
                    newHostInput.value = '';
                    status.textContent = 'New host added';
                    setTimeout(() => {
                        status.textContent = '';
                    }, 1000);
                });
            } else {
                status.textContent = 'Host already exists';
                setTimeout(() => {
                    status.textContent = '';
                }, 1000);
            }
        });
    });

    // Save the selected host when it changes
    hostSelect.addEventListener('change', () => {
        chrome.storage.sync.set({ selectedHost: hostSelect.value }, () => {
            status.textContent = 'Host selection saved';
            setTimeout(() => {
                status.textContent = '';
            }, 1000);
        });
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value;
        chrome.storage.sync.set({ 
            googleApiKey: apiKey,
            selectedHost: hostSelect.value
        }, () => {
            status.textContent = 'Settings saved';
            setTimeout(() => {
                status.textContent = '';
            }, 1000);
        });
    });
});