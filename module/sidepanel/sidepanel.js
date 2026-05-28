function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Đã sao chép!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// ── State ────────────────────────────────────────
let allHistory = [];
let currentIndex = 0;

// ── Render one node ──────────────────────────────
function renderNode(filter = '') {
    const container = document.getElementById('nodes-container');
    const nav       = document.getElementById('node-nav');
    const indicator = document.getElementById('node-indicator');
    const prevBtn   = document.getElementById('prev-btn');
    const nextBtn   = document.getElementById('next-btn');

    if (allHistory.length === 0) {
        nav.hidden = true;
        container.innerHTML = '<div class="empty-state"><p>Chưa có dữ liệu. Mở một phiếu để bắt đầu.</p></div>';
        return;
    }

    // Clamp index
    currentIndex = Math.max(0, Math.min(currentIndex, allHistory.length - 1));

    nav.hidden = false;
    indicator.textContent = `${currentIndex + 1} / ${allHistory.length}`;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === allHistory.length - 1;

    const item   = allHistory[currentIndex];
    const result = item.result;

    const nodeTemplate = document.getElementById('node-template');
    const qTemplate    = document.getElementById('question-template');

    const card = nodeTemplate.content.cloneNode(true);

    card.querySelector('.node-iid').textContent  = `ID: ${result.iid}`;
    card.querySelector('.node-name').textContent = result.name || 'Untitled';
    card.querySelector('.node-time').textContent =
        new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const copyNodeIidBtn = card.querySelector('.copy-node-iid');
    copyNodeIidBtn.addEventListener('click', () => {
        copyToClipboard(String(result.iid), copyNodeIidBtn);
    });

    const questionsContainer = card.querySelector('.questions-list');
    const questions = result.children || [];
    const qIds = questions.map(q => q.iid);

    const copyAllBtn = card.querySelector('.copy-all-btn');
    copyAllBtn.addEventListener('click', () => {
        copyToClipboard(qIds.join('\n'), copyAllBtn);
    });
    if (qIds.length === 0) copyAllBtn.style.display = 'none';

    const searchStr = filter.toLowerCase();

    questions.forEach(q => {
        const qIdMatch      = String(q.iid).includes(searchStr);
        const qContentMatch = (q.content || '').toLowerCase().includes(searchStr);
        if (filter && !qIdMatch && !qContentMatch) return;

        const qItem = qTemplate.content.cloneNode(true);
        qItem.querySelector('.q-iid').textContent = q.iid;

        const copyQBtn = qItem.querySelector('.copy-q-id');
        copyQBtn.addEventListener('click', () => {
            copyToClipboard(q.iid.toString(), copyQBtn);
        });

        const temp = document.createElement('div');
        temp.innerHTML = q.content || 'N/A';
        qItem.querySelector('.q-content').textContent = temp.textContent || temp.innerText;
        qItem.querySelector('.q-clone-from-id').textContent = q.clone_from || '';

        questionsContainer.appendChild(qItem);
    });

    container.innerHTML = '';
    container.appendChild(card);
}

// ── Load all data then render ────────────────────
function displayData(filter = '') {
    chrome.storage.local.get({ history: [] }, (data) => {
        const countEl = document.getElementById('total-nodes');
        allHistory = data.history;
        console.log('[SidePanel] history loaded:', allHistory.length, 'entries');
        countEl.textContent = allHistory.length;
        renderNode(filter);
    });
}

// ── Navigation ───────────────────────────────────
document.getElementById('prev-btn').addEventListener('click', () => {
    currentIndex--;
    renderNode(document.getElementById('search-input').value);
});

document.getElementById('next-btn').addEventListener('click', () => {
    currentIndex++;
    renderNode(document.getElementById('search-input').value);
});

// ── Search ───────────────────────────────────────
document.getElementById('search-input').addEventListener('input', (e) => {
    displayData(e.target.value);
});

// ── Clear ────────────────────────────────────────
document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Bạn chắc chắn muốn xóa tất cả dữ liệu đã lưu?')) {
        chrome.storage.local.set({ history: [] }, () => {
            currentIndex = 0;
            displayData();
        });
    }
});

// ── Clear on open, then load ──────────────────────
chrome.storage.local.set({ history: [] }, () => {
    currentIndex = 0;
    displayData();
});

// ── Listen for storage updates ───────────────────
chrome.storage.onChanged.addListener((changes) => {
    if (changes.history) {
        // background.js dùng unshift() → entry mới nhất luôn ở index 0
        currentIndex = 0;
        displayData(document.getElementById('search-input').value);
    }
});
