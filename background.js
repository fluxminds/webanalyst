// Background script

let techData = {};
const detectedHeaders = {}; // tabId -> [technologies]

// Load technologies
fetch(chrome.runtime.getURL('data/technologies.json'))
    .then(res => res.json())
    .then(data => {
        techData = data;
    });

// Monitor headers
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (!techData || details.type !== 'main_frame') return;

        const tabId = details.tabId;
        if (tabId < 0) return;

        const headers = details.responseHeaders;
        const matches = [];

        for (const [name, rules] of Object.entries(techData)) {
            if (rules.headers) {
                for (const [headerName, headerValuePart] of Object.entries(rules.headers)) {
                    const header = headers.find(h => h.name.toLowerCase() === headerName.toLowerCase());
                    if (header) {
                        // If value check is required
                        if (headerValuePart) {
                            if (header.value.toLowerCase().includes(headerValuePart.toLowerCase())) {
                                matches.push({ name, categories: rules.categories });
                                break; // Found this tech, next tech
                            }
                        } else {
                            // Existence check only
                            matches.push({ name, categories: rules.categories });
                            break;
                        }
                    }
                }
            }
        }

        // Store unique matches for this tab
        if (matches.length > 0) {
            // Dedup
            const unique = [];
            matches.forEach(m => {
                if (!unique.find(u => u.name === m.name)) unique.push(m);
            });
            detectedHeaders[tabId] = unique;
        } else {
            detectedHeaders[tabId] = [];
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'analysis_complete') {
        if (sender.tab) {
            const tabId = sender.tab.id;
            const linkTechs = message.data || [];

            // Merge with header techs
            const headerTechs = detectedHeaders[tabId] || [];

            // Combine and dedup
            const allTechs = [...linkTechs];
            headerTechs.forEach(ht => {
                if (!allTechs.find(t => t.name === ht.name)) {
                    allTechs.push(ht);
                }
            });

            // Store final data
            chrome.storage.local.set({ [`tab_${tabId}`]: allTechs });

            // Update badge
            const count = allTechs.length;
            if (count > 0) {
                chrome.action.setBadgeText({ text: count.toString(), tabId: tabId });
                chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
            } else {
                chrome.action.setBadgeText({ text: '', tabId: tabId });
            }
        }
    }
});

// Clean up
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`tab_${tabId}`);
    delete detectedHeaders[tabId];
});
