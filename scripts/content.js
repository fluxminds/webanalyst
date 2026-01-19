// Content script - runs in Isolated World

let techData = null;

// Load technology data
async function loadData() {
    const url = chrome.runtime.getURL('data/technologies.json');
    const response = await fetch(url);
    techData = await response.json();
}

// Inject the detector script
function injectDetector() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/detector.js');
    script.onload = function () {
        this.remove();
        // Once loaded, send the keys to check
        initiateCheck();
    };
    (document.head || document.documentElement).appendChild(script);
}

function initiateCheck() {
    if (!techData) return;

    // 1. DOM/Meta checks (Isolated World can see DOM)
    const detectedTechnologies = [];

    // Check technologies
    for (const [name, rules] of Object.entries(techData)) {
        let match = false;

        // Check Selectors
        if (rules.selector) {
            rules.selector.forEach(selector => {
                if (document.querySelector(selector)) match = true;
            });
        }

        // Check Meta Tags
        if (rules.meta) {
            for (const [metaName, metaContent] of Object.entries(rules.meta)) {
                const metaTag = document.querySelector(`meta[name="${metaName}"]`);
                if (metaTag && metaTag.content.includes(metaContent)) match = true;
            }
        }

        // Check Script Src
        if (rules.scriptSrc) {
            // Prepare to check scripts
            const scripts = Array.from(document.scripts);
            rules.scriptSrc.forEach(srcFragment => {
                if (scripts.some(s => s.src && s.src.includes(srcFragment))) {
                    match = true;
                }
            });
        }

        if (match) {
            detectedTechnologies.push({ name, categories: rules.categories });
        }
    }

    // 2. Prepare Window variable checks
    const windowKeysToCheck = [];
    const keyToTechMap = {}; // key -> techName

    for (const [name, rules] of Object.entries(techData)) {
        if (rules.window) {
            rules.window.forEach(key => {
                windowKeysToCheck.push(key);
                if (!keyToTechMap[key]) keyToTechMap[key] = [];
                keyToTechMap[key].push(name);
            });
        }
    }

    // Send keys to Main World
    window.dispatchEvent(new CustomEvent('WebAnalyst_Check', { detail: windowKeysToCheck }));

    // Listen for results from Main World
    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        if (event.data.type && event.data.type === 'WebAnalyst_Result') {
            const detectedKeys = event.data.detected;

            detectedKeys.forEach(key => {
                const techNames = keyToTechMap[key];
                if (techNames) {
                    techNames.forEach(techName => {
                        // Avoid duplicates
                        if (!detectedTechnologies.find(t => t.name === techName)) {
                            detectedTechnologies.push({
                                name: techName,
                                categories: techData[techName].categories
                            });
                        }
                    });
                }
            });

            // Notify background
            chrome.runtime.sendMessage({ type: 'analysis_complete', data: detectedTechnologies });
        }
    });

    // Save preliminary DOM results while waiting for Window results
    if (detectedTechnologies.length > 0) {
        chrome.runtime.sendMessage({ type: 'analysis_complete', data: detectedTechnologies });
    }
}


// Initialize
loadData().then(() => {
    // If document is already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        injectDetector();
    } else {
        window.addEventListener('DOMContentLoaded', injectDetector);
    }
});
