document.addEventListener('DOMContentLoaded', async () => {
    const loadingView = document.getElementById('loading');
    const resultsView = document.getElementById('results');
    const emptyView = document.getElementById('empty');

    function showView(viewId) {
        [loadingView, resultsView, emptyView].forEach(view => {
            if (view.id === viewId) view.classList.remove('hidden');
            else view.classList.add('hidden');
        });
    }

    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    function renderResults(technologies) {
        if (!technologies || technologies.length === 0) {
            showView('empty');
            return;
        }

        resultsView.innerHTML = '';

        // Group by category
        const groups = {};
        technologies.forEach(tech => {
            const cat = (tech.categories && tech.categories[0]) || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(tech);
        });

        Object.keys(groups).sort().forEach(category => {
            const groupEl = document.createElement('div');
            groupEl.className = 'category-group';

            const titleEl = document.createElement('div');
            titleEl.className = 'category-title';
            titleEl.textContent = category;
            groupEl.appendChild(titleEl);

            groups[category].forEach(tech => {
                const card = document.createElement('div');
                card.className = 'tech-card';

                // Placeholder icon generation based on name letter
                const letter = tech.name.charAt(0).toUpperCase();

                card.innerHTML = `
                    <div class="tech-icon">${letter}</div>
                    <div class="tech-info">
                        <div class="tech-name">${tech.name}</div>
                        <!-- <div class="tech-desc">Detected via ${tech.method || 'analysis'}</div> -->
                    </div>
                `;
                groupEl.appendChild(card);
            });

            resultsView.appendChild(groupEl);
        });

        showView('results');
    }

    const tab = await getActiveTab();
    if (tab) {
        const storageKey = `tab_${tab.id}`;

        // Check storage first
        chrome.storage.local.get([storageKey], (result) => {
            const data = result[storageKey];
            if (data) {
                renderResults(data);
            } else {
                // If no data, maybe content script hasn't finished or page needs reload.
                // Or we can try to inject/re-ping.
                // For now, show empty or loading.
                // Let's listen for updates.
            }
        });
    }

    // Listen for live updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && tab) {
            const storageKey = `tab_${tab.id}`;
            if (changes[storageKey]) {
                renderResults(changes[storageKey].newValue);
            }
        }
    });

});
