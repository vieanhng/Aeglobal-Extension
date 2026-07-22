// LotusLMS Folder Structure Exporter script.js
document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let isRunning = false;
    let allResults = []; // Flat list of all nodes (folders & files)
    let treeResult = null; // Hierarchical root node
    let currentPage = 1;
    let itemsPerPage = 20;
    let stats = { folders: 0, files: 0, maxDepth: 0 };
    let currentUid = '';
    let currentToken = '';

    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');

    const cfgDomainInput = document.getElementById('cfg-domain');
    const cfgParentIdInput = document.getElementById('cfg-parentId');
    const cfgFilterInput = document.getElementById('cfg-filter');

    const btnStart = document.getElementById('btn-start');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnDownloadJson = document.getElementById('btn-download-json');
    const btnDownloadExcel = document.getElementById('btn-download-excel');

    const iconPlay = document.getElementById('icon-play');
    const iconLoading = document.getElementById('icon-loading');
    const textStart = document.getElementById('text-start');

    const statFolders = document.getElementById('stat-folders');
    const statFiles = document.getElementById('stat-files');
    const statDepth = document.getElementById('stat-depth');

    const logContainer = document.getElementById('log-container');
    const resultsCard = document.getElementById('results-card');
    const resultTbody = document.getElementById('result-tbody');
    const totalBadge = document.getElementById('total-badge');

    const itemsPerPageSelect = document.getElementById('items-per-page');
    const pageNavWrapper = document.getElementById('page-nav-wrapper');

    // Tab switching elements
    const tabTreeBtn = document.getElementById('tab-tree-btn');
    const tabTableBtn = document.getElementById('tab-table-btn');
    const tabTreeContent = document.getElementById('tab-tree-content');
    const tabTableContent = document.getElementById('tab-table-content');
    const treeContainer = document.getElementById('tree-container');

    // Load credentials and inputs from storage
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Load previously saved inputs if any
        chrome.storage.local.get(['exporterDomain', 'exporterParentId', 'exporterFilter'], (data) => {
            if (data.exporterDomain) cfgDomainInput.value = data.exporterDomain;
            if (data.exporterParentId) cfgParentIdInput.value = data.exporterParentId;
            if (data.exporterFilter) cfgFilterInput.value = data.exporterFilter;
        });
    });

    // Helper: Generate UUID for device
    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Helper: Map target item type to Vietnamese name
    function getItemTypeName(type, targetType) {
        if (type === 'folder') return 'Thư mục';
        
        switch (targetType) {
            case 'question_bank': return 'Ngân hàng câu hỏi';
            case 'syllabus': return 'Syllabus (Khung CT)';
            case 'document': return 'Tài liệu / File';
            case 'scorm': return 'Bài giảng SCORM';
            case 'assignment': return 'Bài tự luận';
            case 'exercise': return 'Bài luyện tập';
            case 'exam': return 'Đề thi';
            default: return targetType || 'Tập tin';
        }
    }

    // Helper: Escape HTML for text rendering
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Build Form Data for LotusLMS APIs
    function buildFormData(url, config) {
        const fd = new FormData();
        fd.append("_sand_web_url", url);
        fd.append("_sand_device_uuid", generateUUID());
        fd.append("_sand_token", currentToken);
        fd.append("_sand_uiid", currentUid);
        return fd;
    }

    // Fetch folder content
    async function fetchFolderContent(folderId, config) {
        const url = `https://cloud-beta-api.lotuslms.com/content/api/search-content?_sand_get_total=0&parent_id=${folderId}&items_per_page=-1&depth=1&submit=1&page=1&_sand_ajax=1&_sand_platform=3&_sand_readmin=1&_sand_is_wan=false&_sand_domain=${config.domain}&allow_cache_api_cdn=1`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: buildFormData(`https://${config.domain}.lotuslms.com/admin/content-manager/folder/${folderId}`, config)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.result || [];
        } catch (error) {
            addLog(`Lỗi khi đọc thư mục ${folderId}: ${error.message}`, 'error');
            return [];
        }
    }

    // UI State Helpers
    function updateStatsUI() {
        statFolders.innerText = stats.folders;
        statFiles.innerText = stats.files;
        statDepth.innerText = stats.maxDepth;
    }

    function setRunningState(running) {
        isRunning = running;
        if (running) {
            btnStart.classList.replace('bg-gray-900', 'bg-gray-400');
            btnStart.classList.replace('hover:bg-gray-800', 'cursor-not-allowed');
            btnStart.disabled = true;
            iconPlay.style.display = 'none';
            iconLoading.style.display = 'block';
            textStart.innerText = 'Đang quét cấu trúc...';
            btnDownloadJson.style.display = 'none';
            btnDownloadExcel.style.display = 'none';
            resultsCard.classList.add('hidden');
        } else {
            btnStart.classList.replace('bg-gray-400', 'bg-gray-900');
            btnStart.classList.replace('cursor-not-allowed', 'hover:bg-gray-800');
            btnStart.disabled = false;
            iconPlay.style.display = 'block';
            iconLoading.style.display = 'none';
            textStart.innerText = 'Bắt đầu quét cấu trúc';
            if (allResults.length > 0) {
                btnDownloadJson.style.display = 'flex';
                btnDownloadExcel.style.display = 'flex';
                resultsCard.classList.remove('hidden');
                renderResults();
            }
        }
    }

    function addLog(message, type = 'info') {
        const placeholder = logContainer.querySelector('.log-placeholder');
        if (placeholder) placeholder.remove();

        const div = document.createElement('div');
        div.className = 'flex gap-3 break-all py-0.5 border-b border-gray-800';

        const time = new Date().toLocaleTimeString();
        let colorClass = 'text-blue-300';
        let prefix = '•';

        if (type === 'error') {
            colorClass = 'text-red-400';
            prefix = '✗';
        } else if (type === 'success') {
            colorClass = 'text-green-400';
            prefix = '✓';
        } else if (type === 'warning') {
            colorClass = 'text-yellow-400';
            prefix = '⚠';
        }

        div.innerHTML = `
            <span class="text-gray-500 shrink-0 font-mono">[${time}]</span>
            <span class="${colorClass} shrink-0">${prefix}</span>
            <span class="${colorClass} font-mono">${escapeHtml(message)}</span>
        `;

        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Recursive crawler
    async function processFolderRecursively(node, currentLevel, parentPath, config) {
        if (currentLevel > stats.maxDepth) {
            stats.maxDepth = currentLevel;
            updateStatsUI();
        }

        addLog(`Đang quét thư mục: ${node.name} (Level ${currentLevel})...`, 'info');
        const items = await fetchFolderContent(node.id, config);

        for (const item of items) {
            const itemPath = parentPath ? `${parentPath} > ${item.name}` : item.name;
            
            if (item.type === 'folder') {
                stats.folders++;
                updateStatsUI();
                addLog(`Phát hiện thư mục con: ${item.name} (${item.id})`, 'info');

                const childNode = {
                    id: item.id,
                    name: item.name,
                    type: 'folder',
                    level: currentLevel + 1,
                    parentId: node.id,
                    path: itemPath,
                    children: []
                };

                node.children.push(childNode);
                allResults.push(childNode);

                // Recurse into children
                await processFolderRecursively(childNode, currentLevel + 1, itemPath, config);

            } else if (item.type === 'file') {
                stats.files++;
                updateStatsUI();
                addLog(`Phát hiện file [${getItemTypeName(item.type, item.target_item_type)}]: ${item.name}`, 'success');

                const fileNode = {
                    id: item.id,
                    name: item.name,
                    type: 'file',
                    target_item_type: item.target_item_type,
                    target_item_iid: item.target_item_iid,
                    level: currentLevel + 1,
                    parentId: node.id,
                    path: itemPath
                };

                node.children.push(fileNode);
                allResults.push(fileNode);
            }
        }
    }

    // Trigger crawling
    async function startCrawling() {
        const domain = cfgDomainInput.value.trim();
        const parentId = cfgParentIdInput.value.trim();
        const filterKeyword = cfgFilterInput.value.trim();

        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            addLog('Lỗi: Chưa có thông tin xác thực (UID và Token trống). Vui lòng đồng bộ từ popup extension.', 'error');
            alert('Vui lòng đồng bộ thông tin xác thực từ extension popup trước!');
            return;
        }

        if (!parentId) {
            addLog('Lỗi: Vui lòng nhập ID thư mục gốc cần quét.', 'error');
            alert('Vui lòng nhập ID thư mục gốc cần quét!');
            return;
        }

        // Save inputs to storage for convenience
        chrome.storage.local.set({
            exporterDomain: domain,
            exporterParentId: parentId,
            exporterFilter: filterKeyword
        });

        const config = { domain, parentId, filterKeyword };

        // Reset UI & State
        setRunningState(true);
        logContainer.innerHTML = '';
        allResults = [];
        stats = { folders: 0, files: 0, maxDepth: 0 };
        updateStatsUI();

        addLog(`Bắt đầu duyệt đệ quy thư mục gốc: ${parentId}`, 'info');

        try {
            // Setup Root Node
            treeResult = {
                id: parentId,
                name: `Thư mục gốc [ID: ${parentId}]`,
                type: 'folder',
                level: 0,
                path: 'Root',
                children: []
            };

            // Add root to flat list as first item
            allResults.push(treeResult);

            await processFolderRecursively(treeResult, 0, '', config);
            addLog(`Quét hoàn tất! Tìm thấy ${stats.folders} thư mục và ${stats.files} tập tin.`, 'success');
        } catch (error) {
            addLog(`Lỗi hệ thống trong lúc quét: ${error.message}`, 'error');
        } finally {
            setRunningState(false);
        }
    }

    // Get SVG Icons for tree elements
    function getChevronIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    }

    function getFolderIcon() {
        return `<svg class="text-amber-500 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-1.25a.75.75 0 0 1-.75-.75V8.25A3 3 0 0 0 14.5 5.25h-5a3 3 0 0 0-3 3v.75a.75.75 0 0 1-.75.75H4.5a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15Z" /></svg>`;
    }

    function getFileIcon(targetType) {
        if (targetType === 'question_bank') {
            // Database/Bank icon
            return `<svg class="text-blue-500 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25c-5.385 0-9.75 2.015-9.75 4.5v10.5c0 2.485 4.365 4.5 9.75 4.5s9.75-2.015 9.75-4.5V6.75c0-2.485-4.365-4.5-9.75-4.5ZM12 6c-3.136 0-5.75-.75-5.75-1.5S8.864 3 12 3s5.75.75 5.75 1.5S15.136 6 12 6Zm-7.25 5.513c-.157-.042-.31-.088-.455-.138A8.825 8.825 0 0 1 3.5 10.5v-2.25c0 .35.158.683.454.992.593.618 1.944 1.144 3.796 1.488A9.76 9.76 0 0 1 12 11.25c1.472 0 2.87-.246 3.992-.68.614-.237 1.134-.51 1.554-.808.204-.145.367-.294.492-.44.135-.157.212-.313.212-.477v2.25c0 .164-.077.32-.212.477a2.658 2.658 0 0 1-.492.44 9.176 9.176 0 0 1-1.554.808c-1.121.434-2.52.68-3.992.68-1.472 0-2.87-.246-3.992-.68A9.76 9.76 0 0 1 4.75 11.513Zm0 5.25c-.157-.042-.31-.088-.455-.138A8.825 8.825 0 0 1 3.5 15.75V13.5c0 .35.158.683.454.992.593.618 1.944 1.144 3.796 1.488a9.76 9.76 0 0 0 8.5 0c1.852-.344 3.203-.87 3.796-1.488.296-.31.454-.642.454-.992v2.25c0 .164-.077.32-.212.477a2.658 2.658 0 0 1-.492.44c-.42.298-.94.57-1.554.808-1.121.434-2.52.68-3.992.68-1.472 0-2.87-.246-3.992-.68a9.76 9.76 0 0 1-3.5-.737Z" /></svg>`;
        }
        if (targetType === 'syllabus') {
            return `<svg class="text-rose-500 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" /><path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .345.28.625.625.625H16.75a5.23 5.23 0 0 1 3.434 1.279 9.72 9.72 0 0 0-7.213-7.338Z" /></svg>`;
        }
        // Document icon
        return `<svg class="text-gray-400 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm-6-3a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" /><path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 4.713 4.713 5.23 5.23 0 0 0-3.434-1.279Z" /></svg>`;
    }

    // Filter results based on quick search keyword
    function getFilteredNodes() {
        const filterKeyword = cfgFilterInput.value.trim().toLowerCase();
        if (!filterKeyword) {
            return {
                flat: allResults,
                tree: treeResult
            };
        }

        // Filter flat list
        const filteredFlat = allResults.filter(node => 
            node.name.toLowerCase().includes(filterKeyword) || 
            node.id.toString().includes(filterKeyword) ||
            (node.target_item_iid && node.target_item_iid.toString().includes(filterKeyword))
        );

        // For the tree: we only want branches that lead to matching items.
        // Let's copy the tree and prune nodes that don't match or have matching descendants.
        function cloneAndFilterTree(node) {
            const matchesSelf = node.name.toLowerCase().includes(filterKeyword) || 
                                node.id.toString().includes(filterKeyword) ||
                                (node.target_item_iid && node.target_item_iid.toString().includes(filterKeyword));

            if (node.type === 'file') {
                return matchesSelf ? { ...node } : null;
            }

            // Folder node
            const filteredChildren = [];
            if (node.children) {
                for (const child of node.children) {
                    const clonedChild = cloneAndFilterTree(child);
                    if (clonedChild) {
                        filteredChildren.push(clonedChild);
                    }
                }
            }

            if (matchesSelf || filteredChildren.length > 0) {
                return {
                    ...node,
                    children: filteredChildren
                };
            }

            return null;
        }

        const filteredTree = cloneAndFilterTree(treeResult);

        return {
            flat: filteredFlat,
            tree: filteredTree
        };
    }

    // Render both Tree and Table Views
    function renderResults() {
        const { flat, tree } = getFilteredNodes();
        
        // Update badge
        totalBadge.textContent = `Tổng ${flat.length} mục`;

        // Render Tree
        renderTree(tree);

        // Render Table
        currentPage = 1;
        renderTable(flat);
    }

    // Recursive Tree builder in HTML
    function buildTreeNodeHTML(node) {
        if (!node) return '';

        const hasChildren = node.children && node.children.length > 0;
        
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'tree-node';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'tree-node-content';
        
        // Add ID attribute for click highlight
        contentDiv.dataset.nodeId = node.id;

        // Toggle button (only for folders with items)
        let toggleBtnHTML = '';
        if (node.type === 'folder') {
            if (hasChildren) {
                toggleBtnHTML = `<span class="tree-toggle-btn">${getChevronIcon()}</span>`;
            } else {
                toggleBtnHTML = `<span class="w-[1.15rem] h-[1.15rem]"></span>`; // Empty spacer
            }
        } else {
            toggleBtnHTML = `<span class="w-[1.15rem] h-[1.15rem]"></span>`; // Empty spacer
        }

        // Icon
        const iconHTML = `<span class="tree-icon">${node.type === 'folder' ? getFolderIcon() : getFileIcon(node.target_item_type)}</span>`;

        // Title and meta
        let textHTML = '';
        if (node.type === 'folder') {
            textHTML = `
                <span class="font-bold text-gray-700">${escapeHtml(node.name)}</span>
                <span class="text-[9px] text-gray-400 font-mono select-all">(${node.id})</span>
            `;
        } else {
            const iidBadge = node.target_item_type === 'question_bank' 
                ? `<span class="ml-1 inline-block bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border border-blue-100 select-all">IID: ${node.target_item_iid}</span>`
                : `<span class="ml-1 inline-block bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border border-gray-150 select-all">${node.target_item_type}</span>`;
            
            textHTML = `
                <span class="text-gray-600 font-medium">${escapeHtml(node.name)}</span>
                <span class="text-[9px] text-gray-400 font-mono select-all">(${node.id})</span>
                ${iidBadge}
            `;
        }

        contentDiv.innerHTML = `${toggleBtnHTML}${iconHTML}${textHTML}`;
        nodeDiv.appendChild(contentDiv);

        // Children container
        if (hasChildren) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            
            node.children.forEach(child => {
                const childHTML = buildTreeNodeHTML(child);
                if (childHTML) childrenDiv.appendChild(childHTML);
            });

            nodeDiv.appendChild(childrenDiv);

            // Add toggle event
            const toggleBtn = contentDiv.querySelector('.tree-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    childrenDiv.classList.toggle('collapsed');
                    toggleBtn.classList.toggle('collapsed-icon');
                });
            }
        }

        // Node click selection highlight
        contentDiv.addEventListener('click', (e) => {
            document.querySelectorAll('.tree-node-content').forEach(el => el.classList.remove('active'));
            contentDiv.classList.add('active');
        });

        return nodeDiv;
    }

    // Render tree container
    function renderTree(tree) {
        treeContainer.innerHTML = '';
        if (!tree) {
            treeContainer.innerHTML = `<div class="text-gray-500 italic p-4 text-center">Không có cấu trúc cây phù hợp bộ lọc.</div>`;
            return;
        }

        const rootHTML = buildTreeNodeHTML(tree);
        treeContainer.appendChild(rootHTML);
    }

    // Render table rows
    function renderTable(flatList) {
        resultTbody.innerHTML = '';

        if (flatList.length === 0) {
            resultTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-8 text-center text-red-500 font-medium">
                        Không tìm thấy dữ liệu cấu trúc nào.
                    </td>
                </tr>
            `;
            return;
        }

        const totalItems = flatList.length;
        const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        let startIndex = 0;
        let endIndex = totalItems;

        if (itemsPerPage !== 'all') {
            startIndex = (currentPage - 1) * itemsPerPage;
            endIndex = startIndex + itemsPerPage;
        }

        const currentItems = flatList.slice(startIndex, endIndex);

        currentItems.forEach((node, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50/40 transition-colors";

            const actualIndex = startIndex + index + 1;
            const typeLabel = getItemTypeName(node.type, node.target_item_type);
            const levelText = node.level === 0 ? 'Thư mục gốc' : `Cấp ${node.level}`;

            let nameHTML = `<span class="font-medium text-gray-800">${escapeHtml(node.name)}</span>`;
            if (node.type === 'folder') {
                nameHTML = `<span class="font-bold text-indigo-700">📁 ${escapeHtml(node.name)}</span>`;
            } else if (node.target_item_type === 'question_bank') {
                nameHTML = `<span class="font-medium text-blue-600">🗄️ ${escapeHtml(node.name)}</span>`;
            }

            tr.innerHTML = `
                <td class="px-4 py-3 border-b text-center text-gray-400 align-middle font-semibold">${actualIndex}</td>
                <td class="px-4 py-3 border-b align-middle">${nameHTML}</td>
                <td class="px-4 py-3 border-b align-middle">
                    <span class="inline-block bg-gray-100 text-gray-700 py-0.5 px-2 rounded text-[10px] font-bold border border-gray-200">${typeLabel}</span>
                </td>
                <td class="px-4 py-3 border-b align-middle text-center font-semibold text-gray-600">${levelText}</td>
                <td class="px-4 py-3 border-b align-middle font-mono font-medium text-gray-500">${node.id || 'N/A'}</td>
                <td class="px-4 py-3 border-b align-middle font-mono font-medium text-indigo-500">${node.target_item_iid || 'N/A'}</td>
                <td class="px-4 py-3 border-b align-middle font-mono text-gray-400">${node.parentId || 'N/A'}</td>
                <td class="px-4 py-3 border-b align-middle text-gray-500 whitespace-normal break-all font-mono text-[10px] leading-relaxed max-w-xs">${escapeHtml(node.path || 'Root')}</td>
            `;
            resultTbody.appendChild(tr);
        });

        renderPaginationControls(totalPages, startIndex + 1, Math.min(endIndex, totalItems), totalItems, flatList);
    }

    // Render pagination buttons and labels
    function renderPaginationControls(totalPages, startItem, endItem, totalItems, flatList) {
        if (itemsPerPage === 'all' || totalItems === 0) {
            pageNavWrapper.innerHTML = `<span class="text-gray-500 font-medium">Đang hiển thị tất cả ${totalItems} kết quả</span>`;
            return;
        }

        let html = `<span class="text-gray-400 mr-2 font-medium">Hiển thị ${startItem} - ${endItem} của ${totalItems}</span>`;

        // Prev button
        html += `
            <button id="btn-page-prev" ${currentPage === 1 ? 'disabled' : ''} 
                class="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
        `;

        // Page index text
        html += `<span class="px-2.5 font-bold text-blue-600">Trang ${currentPage} / ${totalPages}</span>`;

        // Next button
        html += `
            <button id="btn-page-next" ${currentPage === totalPages ? 'disabled' : ''} 
                class="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        `;

        pageNavWrapper.innerHTML = html;

        // Add event listeners to the generated buttons
        const btnPagePrev = document.getElementById('btn-page-prev');
        const btnPageNext = document.getElementById('btn-page-next');

        if (btnPagePrev) {
            btnPagePrev.addEventListener('click', () => {
                currentPage--;
                renderTable(flatList);
            });
        }
        if (btnPageNext) {
            btnPageNext.addEventListener('click', () => {
                currentPage++;
                renderTable(flatList);
            });
        }
    }

    // Export to JSON file (contains hierarchical nested children)
    function downloadJSON() {
        const parentId = cfgParentIdInput.value.trim();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeResult, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `folder_structure_${parentId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addLog(`Đã xuất và tải tệp cấu trúc JSON.`, 'success');
    }

    // Export to Excel file
    function downloadExcel() {
        const parentId = cfgParentIdInput.value.trim();
        const { flat } = getFilteredNodes();
        
        if (flat.length === 0) {
            addLog('Không có dữ liệu để xuất Excel.', 'error');
            return;
        }

        addLog('Đang chuẩn bị dữ liệu xuất Excel...', 'info');

        const rows = flat.map((node, idx) => {
            return {
                "STT": idx + 1,
                "Tên": node.name,
                "Loại": getItemTypeName(node.type, node.target_item_type),
                "Cấp độ (Level)": node.level,
                "Mã ID": node.id,
                "IID Ngân hàng": node.target_item_iid || 'N/A',
                "Mã ID Cha": node.parentId || 'N/A',
                "Đường dẫn (Path)": node.path || 'Root'
            };
        });

        try {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Cấu trúc thư mục");

            // Adjust column widths automatically
            const colWidths = [
                { wch: 6 },  // STT
                { wch: 35 }, // Tên
                { wch: 20 }, // Loại
                { wch: 15 }, // Level
                { wch: 25 }, // Mã ID
                { wch: 25 }, // IID Ngân hàng
                { wch: 25 }, // Mã ID Cha
                { wch: 60 }  // Path
            ];
            ws['!cols'] = colWidths;

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

            function s2ab(s) {
                const buf = new ArrayBuffer(s.length);
                const view = new Uint8Array(buf);
                for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
                return buf;
            }

            const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);

            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", `folder_structure_${parentId}.xlsx`);
            document.body.appendChild(downloadAnchorNode);

            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);

            addLog(`Đã xuất và tải tệp Excel thành công (${flat.length} dòng).`, 'success');
        } catch (error) {
            addLog(`Lỗi xuất Excel: ${error.message}`, 'error');
            console.error(error);
        }
    }

    // Event Listeners
    btnStart.addEventListener('click', startCrawling);

    btnClearLog.addEventListener('click', () => {
        logContainer.innerHTML = '<p class="text-gray-500 italic log-placeholder">Đã xóa sạch console log.</p>';
    });

    btnDownloadJson.addEventListener('click', downloadJSON);
    btnDownloadExcel.addEventListener('click', downloadExcel);

    // Filter quick search listeners
    cfgFilterInput.addEventListener('input', () => {
        if (allResults.length > 0) {
            renderResults();
        }
    });

    // Change number of items per page in Table View
    itemsPerPageSelect.addEventListener('change', () => {
        const val = itemsPerPageSelect.value;
        itemsPerPage = val === 'all' ? 'all' : parseInt(val, 10);
        currentPage = 1;
        const { flat } = getFilteredNodes();
        renderTable(flat);
    });

    // Tab Switching Handlers
    tabTreeBtn.addEventListener('click', () => {
        tabTreeBtn.classList.add('active');
        tabTableBtn.classList.remove('active');
        tabTreeContent.classList.remove('hidden');
        tabTableContent.classList.add('hidden');
    });

    tabTableBtn.addEventListener('click', () => {
        tabTableBtn.classList.add('active');
        tabTreeBtn.classList.remove('active');
        tabTableContent.classList.remove('hidden');
        tabTreeContent.classList.add('hidden');
        const { flat } = getFilteredNodes();
        renderTable(flat);
    });
});
