// Question Tagger - Quản lý thẻ câu hỏi hàng loạt (Append, Remove, Replace)
document.addEventListener('DOMContentLoaded', () => {
    // ── DOM Elements ──────────────────────────────────────────
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const statusResultDiv = document.getElementById('statusResult');
    const messageP = document.getElementById('message');

    // Inputs
    const questionIdsInput = document.getElementById('question-ids');
    const questionCount = document.getElementById('questionCount');
    const clearIdsBtn = document.getElementById('clearIdsBtn');
    const tagInput = document.getElementById('tagInput');
    const tagsInputLabel = document.getElementById('tagsInputLabel');
    const tagCountBadge = document.getElementById('tagCountBadge');
    const tagHelperText = document.getElementById('tagHelperText');
    const tagsPreviewContainer = document.getElementById('tagsPreviewContainer');
    const tagsPreviewList = document.getElementById('tagsPreviewList');
    const batchSizeInput = document.getElementById('batchSize');
    const delayMsInput = document.getElementById('delayMs');

    // Input Containers for Overwrite Mode (Multiple A -> B pairs)
    const standardTagInputContainer = document.getElementById('standardTagInputContainer');
    const overwriteTagInputContainer = document.getElementById('overwriteTagInputContainer');
    const pairsListModeContainer = document.getElementById('pairsListModeContainer');
    const pairsListContainer = document.getElementById('pairsListContainer');
    const addPairRowBtn = document.getElementById('addPairRowBtn');
    const pairCountBadge = document.getElementById('pairCountBadge');
    const toggleBulkPairModeBtn = document.getElementById('toggleBulkPairModeBtn');
    const bulkTextareaModeContainer = document.getElementById('bulkTextareaModeContainer');
    const bulkPairsTextarea = document.getElementById('bulkPairsTextarea');
    const applyBulkPairsBtn = document.getElementById('applyBulkPairsBtn');

    // Mode Radios & Cards
    const modeRadios = document.querySelectorAll('input[name="tagMode"]');
    const modeCardAppend = document.getElementById('modeCardAppend');
    const modeCardRemove = document.getElementById('modeCardRemove');
    const modeCardOverwrite = document.getElementById('modeCardOverwrite');
    const modeCardReplace = document.getElementById('modeCardReplace');

    // Buttons
    const startProcessBtn = document.getElementById('startProcessBtn');
    const stopProcessBtn = document.getElementById('stopProcessBtn');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');

    // Progress Card
    const progressCard = document.getElementById('progressCard');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatusText = document.getElementById('progressStatusText');
    const statTotal = document.getElementById('statTotal');
    const statSuccess = document.getElementById('statSuccess');
    const statSkipped = document.getElementById('statSkipped');
    const statFailed = document.getElementById('statFailed');
    const statRemaining = document.getElementById('statRemaining');

    // Log Card
    const logCard = document.getElementById('logCard');
    const logContainer = document.getElementById('logContainer');
    const clearLogBtn = document.getElementById('clearLogBtn');

    // Results Card
    const resultsCard = document.getElementById('resultsCard');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const copyFailedBtn = document.getElementById('copyFailedBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');

    // State Variables
    let currentUid = '';
    let currentToken = '';
    let isRunning = false;
    let failedIds = [];
    let processedResults = [];

    // ── Auth Data ─────────────────────────────────────────────
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Khôi phục dữ liệu đã lưu trong storage
        chrome.storage.local.get([
            'taggerQuestionIds',
            'taggerTagsInput',
            'taggerPairs',
            'taggerTagFrom',
            'taggerTagTo',
            'taggerMode',
            'taggerBatchSize',
            'taggerDelayMs'
        ], (data) => {
            if (data.taggerQuestionIds) questionIdsInput.value = data.taggerQuestionIds;
            if (data.taggerTagsInput) tagInput.value = data.taggerTagsInput;
            if (data.taggerBatchSize) batchSizeInput.value = data.taggerBatchSize;
            if (data.taggerDelayMs) delayMsInput.value = data.taggerDelayMs;

            if (Array.isArray(data.taggerPairs) && data.taggerPairs.length > 0) {
                setPairsToUI(data.taggerPairs);
            } else if (data.taggerTagFrom) {
                setPairsToUI([{ from: data.taggerTagFrom, to: data.taggerTagTo || '' }]);
            } else {
                setPairsToUI([]);
            }

            if (data.taggerMode) {
                const radio = document.querySelector(`input[name="tagMode"][value="${data.taggerMode}"]`);
                if (radio) radio.checked = true;
            }

            updateModeUI();
            updateQuestionCount();
            updateTagPreview();
        });
    });

    // ── Helper: Parse tags input (split by comma or newline) ──
    function parseTags(text) {
        if (!text) return [];
        return text
            .split(/[\n,]+/)
            .map(t => t.trim())
            .filter(t => t.length > 0);
    }

    // ── Helper: Multiple A -> B Replacement Pairs Management ──
    function parsePairsFromText(text) {
        if (!text) return [];
        const lines = text.split(/\r?\n/);
        const pairs = [];
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            let from = '';
            let to = '';
            if (line.includes('\t')) {
                const parts = line.split('\t');
                from = parts[0].trim();
                to = parts.slice(1).join('\t').trim();
            } else if (line.includes('->')) {
                const parts = line.split('->');
                from = parts[0].trim();
                to = parts.slice(1).join('->').trim();
            } else if (line.includes('➔') || line.includes('→')) {
                const parts = line.split(/[➔→]/);
                from = parts[0].trim();
                to = parts.slice(1).join('➔').trim();
            } else if (line.includes('|')) {
                const parts = line.split('|');
                from = parts[0].trim();
                to = parts.slice(1).join('|').trim();
            } else if (line.includes('>')) {
                const parts = line.split('>');
                from = parts[0].trim();
                to = parts.slice(1).join('>').trim();
            } else if (line.includes(',')) {
                const parts = line.split(',');
                from = parts[0].trim();
                to = parts.slice(1).join(',').trim();
            }
            if (from.length > 0) {
                pairs.push({ from, to });
            }
        }
        return pairs;
    }

    function formatPairsToText(pairs) {
        return pairs.map(p => `${p.from} -> ${p.to}`).join('\n');
    }

    function createPairRow(fromVal = '', toVal = '') {
        if (!pairsListContainer) return null;
        const row = document.createElement('div');
        row.className = 'pair-row flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-purple-400 focus-within:bg-white transition-colors';
        row.innerHTML = `
            <div class="flex-1 relative">
                <input type="text" class="tag-from-input w-full text-xs bg-transparent border-0 px-2 py-1 text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium" placeholder="Thẻ A (cần đổi)" value="${fromVal.replace(/"/g, '&quot;')}">
            </div>
            <span class="text-purple-600 font-bold text-xs select-none px-0.5">➔</span>
            <div class="flex-1 relative">
                <input type="text" class="tag-to-input w-full text-xs bg-transparent border-0 px-2 py-1 text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium" placeholder="Thẻ B (thay thế)" value="${toVal.replace(/"/g, '&quot;')}">
            </div>
            <button type="button" class="remove-pair-btn p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa dòng này">
                <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;

        const fromInput = row.querySelector('.tag-from-input');
        const toInput = row.querySelector('.tag-to-input');
        const removeBtn = row.querySelector('.remove-pair-btn');

        const onInputChange = () => {
            updateTagPreview();
            savePairsToStorage();
        };

        fromInput.addEventListener('input', onInputChange);
        toInput.addEventListener('input', onInputChange);

        removeBtn.addEventListener('click', () => {
            row.remove();
            if (pairsListContainer.querySelectorAll('.pair-row').length === 0) {
                createPairRow('', '');
            }
            updateTagPreview();
            savePairsToStorage();
        });

        pairsListContainer.appendChild(row);
        return row;
    }

    function getPairsFromUI() {
        if (!pairsListContainer) return [];
        const rows = pairsListContainer.querySelectorAll('.pair-row');
        const pairs = [];
        rows.forEach(row => {
            const from = row.querySelector('.tag-from-input')?.value.trim() || '';
            const to = row.querySelector('.tag-to-input')?.value.trim() || '';
            if (from.length > 0 || to.length > 0) {
                pairs.push({ from, to });
            }
        });
        return pairs;
    }

    function setPairsToUI(pairs) {
        if (!pairsListContainer) return;
        pairsListContainer.innerHTML = '';
        if (Array.isArray(pairs) && pairs.length > 0) {
            pairs.forEach(p => createPairRow(p.from, p.to));
        } else {
            createPairRow('', '');
        }
        updateTagPreview();
    }

    function savePairsToStorage() {
        const pairs = getPairsFromUI();
        chrome.storage.local.set({ taggerPairs: pairs });
    }

    let isBulkPairMode = false;

    function toggleBulkMode(forceBulk) {
        isBulkPairMode = typeof forceBulk === 'boolean' ? forceBulk : !isBulkPairMode;
        if (!pairsListModeContainer || !bulkTextareaModeContainer) return;
        if (isBulkPairMode) {
            const currentPairs = getPairsFromUI();
            bulkPairsTextarea.value = formatPairsToText(currentPairs);
            pairsListModeContainer.classList.add('hidden');
            bulkTextareaModeContainer.classList.remove('hidden');
            if (toggleBulkPairModeBtn) {
                toggleBulkPairModeBtn.textContent = '📋 Chuyển dạng bảng';
                toggleBulkPairModeBtn.className = 'text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors';
            }
        } else {
            const parsed = parsePairsFromText(bulkPairsTextarea.value);
            setPairsToUI(parsed);
            savePairsToStorage();
            bulkTextareaModeContainer.classList.add('hidden');
            pairsListModeContainer.classList.remove('hidden');
            if (toggleBulkPairModeBtn) {
                toggleBulkPairModeBtn.textContent = '📋 Dán nhiều cặp / Excel';
                toggleBulkPairModeBtn.className = 'text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors';
            }
        }
        updateTagPreview();
    }

    if (toggleBulkPairModeBtn) {
        toggleBulkPairModeBtn.addEventListener('click', () => toggleBulkMode());
    }

    if (applyBulkPairsBtn) {
        applyBulkPairsBtn.addEventListener('click', () => toggleBulkMode(false));
    }

    if (addPairRowBtn) {
        addPairRowBtn.addEventListener('click', () => {
            const newRow = createPairRow('', '');
            if (newRow) {
                const input = newRow.querySelector('.tag-from-input');
                if (input) input.focus();
            }
            updateTagPreview();
            savePairsToStorage();
        });
    }

    if (bulkPairsTextarea) {
        bulkPairsTextarea.addEventListener('input', () => {
            updateTagPreview();
        });
    }

    // ── Helper: Sleep ─────────────────────────────────────────
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const API_BASE = "https://cloud-beta-api.lotuslms.com";
    const DOMAIN = "aeglobal";

    // ── Direct API Fallback (chạy trực tiếp nếu background service worker chưa reload hoặc port đóng) ──
    async function executeTagUpdateDirectly(questionId, tags, mode, uid, token) {
        try {
            // 1. Tìm câu hỏi qua API search
            const searchUrl = `${API_BASE}/question/index/search?_sand_get_total=0&search_from_bank=1&ntype=question&q=${encodeURIComponent(questionId)}&submit=1&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;
            const searchResponse = await fetch(searchUrl, { method: "POST" });
            const searchData = await searchResponse.json();

            if (!searchData.success || !searchData.result || searchData.result.length === 0) {
                return { success: false, questionId, error: "Không tìm thấy câu hỏi" };
            }

            const qIdLower = String(questionId).toLowerCase().trim();
            const questionData = (Array.isArray(searchData.result) ? searchData.result : []).find(q =>
                (q.id && String(q.id).toLowerCase() === qIdLower) ||
                (q.iid && String(q.iid).toLowerCase() === qIdLower) ||
                (q._id && String(q._id).toLowerCase() === qIdLower)
            ) || (searchData.result.length === 1 ? searchData.result[0] : null);

            if (!questionData) {
                return { success: false, questionId, error: "Không tìm thấy câu hỏi khớp với ID" };
            }

            const qId = questionData.id || questionData.iid || questionData._id || questionId;

            const currentTags = (Array.isArray(questionData.tags) ? [...questionData.tags] : [])
                .map(t => String(t).trim());

            let finalTags = [];
            let appliedChanges = [];

            if (mode === 'overwrite') {
                let cleanPairs = [];
                if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
                    if (Array.isArray(tags.pairs)) {
                        cleanPairs = tags.pairs
                            .map(p => ({
                                from: String(p.from || '').trim(),
                                to: String(p.to || '').trim()
                            }))
                            .filter(p => p.from.length > 0);
                    } else if (tags.from !== undefined) {
                        const fromArr = (Array.isArray(tags.from) ? tags.from : [tags.from])
                            .map(t => String(t).trim());
                        const toArr = (Array.isArray(tags.to) ? tags.to : [tags.to])
                            .map(t => String(t).trim())
                            .filter(t => t.length > 0);
                        fromArr.forEach((fromTag, idx) => {
                            cleanPairs.push({ from: fromTag, to: toArr[idx] || toArr[0] || '' });
                        });
                    }
                }

                // Map tra cứu thẻ thay thế (phân biệt hoa thường)
                const replacementMap = new Map();
                for (const pair of cleanPairs) {
                    if (!replacementMap.has(pair.from)) {
                        replacementMap.set(pair.from, pair.to);
                    }
                }

                const matchedFromTags = new Set();
                for (const tag of currentTags) {
                    if (replacementMap.has(tag)) {
                        matchedFromTags.add(tag);
                        const toVal = replacementMap.get(tag);
                        const changeStr = `[${tag}] ➔ [${toVal || '(xóa)'}]`;
                        if (!appliedChanges.includes(changeStr)) {
                            appliedChanges.push(changeStr);
                        }
                    }
                }

                if (matchedFromTags.size === 0) {
                    const fromListNames = cleanPairs.map(p => p.from);
                    return {
                        success: true,
                        skipped: true,
                        message: `Không chứa thẻ nào khớp trong danh sách [${fromListNames.join(', ')}] để ghi đè`,
                        questionId: qId,
                        oldTags: currentTags,
                        finalTags: currentTags
                    };
                }

                // Duyệt qua currentTags, nếu gặp tag nằm trong replacementMap thì thay thế bằng toVal
                let newTagsList = [];
                for (const tag of currentTags) {
                    if (replacementMap.has(tag)) {
                        const toVal = replacementMap.get(tag);
                        if (toVal && toVal.length > 0) {
                            const subTags = toVal.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
                            newTagsList.push(...subTags);
                        }
                    } else {
                        newTagsList.push(tag);
                    }
                }

                // Loại bỏ trùng lặp và tag rác
                const seen = new Set();
                finalTags = [];
                for (const t of newTagsList) {
                    if (!seen.has(t) && t.length > 0) {
                        seen.add(t);
                        finalTags.push(t);
                    }
                }
            } else {
                let inputTags = [];
                if (Array.isArray(tags)) {
                    inputTags = tags.map(t => String(t).trim()).filter(t => t.length > 0);
                } else if (typeof tags === 'string') {
                    inputTags = [tags.trim()].filter(t => t.length > 0);
                }

                if (mode === 'append') {
                    const seen = new Set();
                    finalTags = [];
                    for (const t of [...currentTags, ...inputTags]) {
                        if (!seen.has(t) && t.length > 0) {
                            seen.add(t);
                            finalTags.push(t);
                        }
                    }
                } else if (mode === 'replace') {
                    const seen = new Set();
                    finalTags = [];
                    for (const t of inputTags) {
                        if (!seen.has(t) && t.length > 0) {
                            seen.add(t);
                            finalTags.push(t);
                        }
                    }
                } else if (mode === 'remove') {
                    const tagsToRemoveSet = new Set(inputTags);
                    const matchedTags = currentTags.filter(t => tagsToRemoveSet.has(t));

                    if (matchedTags.length === 0) {
                        return {
                            success: true,
                            skipped: true,
                            message: "Không chứa thẻ cần xóa",
                            questionId: qId,
                            oldTags: currentTags,
                            finalTags: currentTags
                        };
                    }

                    finalTags = currentTags.filter(t => !tagsToRemoveSet.has(t));
                }
            }

            // Gửi request cập nhật
            const formData = new FormData();
            formData.append('iid', String(qId));
            formData.append('id', String(qId));
            formData.append('ntype', 'question');
            formData.append('rootNode[ntype]', 'question-bank');
            formData.append('_sand_step', 'tags');
            formData.append('_sand_domain', DOMAIN);
            formData.append('_sand_token', token);
            formData.append('_sand_uiid', uid);

            finalTags.forEach((tag, index) => {
                formData.append(`questionData[tags][${index}]`, tag);
            });

            const response = await fetch(`${API_BASE}/exercise/editor/update-question`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    skipped: false,
                    questionId: qId,
                    oldTags: currentTags,
                    finalTags: finalTags,
                    appliedChanges: appliedChanges,
                    mode
                };
            } else {
                return {
                    success: false,
                    questionId: qId,
                    error: data.message || "Lỗi cập nhật từ server",
                    oldTags: currentTags
                };
            }
        } catch (err) {
            return {
                success: false,
                questionId,
                error: err.message
            };
        }
    }

    // ── Mode Switching Logic ──────────────────────────────────
    function getSelectedMode() {
        const selected = document.querySelector('input[name="tagMode"]:checked');
        return selected ? selected.value : 'append';
    }

    function updateModeUI() {
        const mode = getSelectedMode();

        // Cập nhật viền & nền của các thẻ card
        modeCardAppend.className = 'mode-card rounded-xl p-2.5';
        modeCardRemove.className = 'mode-card rounded-xl p-2.5';
        if (modeCardOverwrite) modeCardOverwrite.className = 'mode-card rounded-xl p-2.5';
        modeCardReplace.className = 'mode-card rounded-xl p-2.5';

        if (mode === 'append') {
            modeCardAppend.classList.add('selected-append');
            if (standardTagInputContainer) standardTagInputContainer.classList.remove('hidden');
            if (overwriteTagInputContainer) overwriteTagInputContainer.classList.add('hidden');
            tagsInputLabel.innerHTML = '3. Danh sách thẻ cần thêm <span class="text-rose-500">*</span>';
            tagHelperText.textContent = '💡 Thẻ mới sẽ được gộp vào danh sách thẻ hiện tại của câu hỏi (không trùng lặp).';
            btnText.textContent = '🚀 Bắt đầu thêm thẻ';
        } else if (mode === 'remove') {
            modeCardRemove.classList.add('selected-remove');
            if (standardTagInputContainer) standardTagInputContainer.classList.remove('hidden');
            if (overwriteTagInputContainer) overwriteTagInputContainer.classList.add('hidden');
            tagsInputLabel.innerHTML = '3. Danh sách thẻ cần xóa <span class="text-rose-500">*</span>';
            tagHelperText.textContent = '💡 Hệ thống sẽ tìm câu hỏi và gỡ bỏ các thẻ này nếu có trong câu hỏi.';
            btnText.textContent = '🗑️ Bắt đầu xóa thẻ';
        } else if (mode === 'overwrite') {
            if (modeCardOverwrite) modeCardOverwrite.classList.add('selected-overwrite');
            if (standardTagInputContainer) standardTagInputContainer.classList.add('hidden');
            if (overwriteTagInputContainer) overwriteTagInputContainer.classList.remove('hidden');
            btnText.textContent = '🔁 Bắt đầu đổi thẻ A → B';
        } else if (mode === 'replace') {
            modeCardReplace.classList.add('selected-replace');
            if (standardTagInputContainer) standardTagInputContainer.classList.remove('hidden');
            if (overwriteTagInputContainer) overwriteTagInputContainer.classList.add('hidden');
            tagsInputLabel.innerHTML = '3. Danh sách thẻ mới thay thế <span class="text-rose-500">*</span>';
            tagHelperText.textContent = '💡 Toàn bộ thẻ hiện có của câu hỏi sẽ bị thay thế bằng danh sách này.';
            btnText.textContent = '🔄 Bắt đầu thay thế thẻ';
        }

        updateTagPreview();
    }

    modeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            updateModeUI();
            chrome.storage.local.set({ taggerMode: getSelectedMode() });
        });
    });

    // Cho phép click vào bất kỳ vùng nào trên card để chọn chế độ
    const modeCards = [
        { card: modeCardAppend, value: 'append' },
        { card: modeCardRemove, value: 'remove' },
        { card: modeCardOverwrite, value: 'overwrite' },
        { card: modeCardReplace, value: 'replace' }
    ];

    modeCards.forEach(({ card, value }) => {
        if (!card) return;
        card.addEventListener('click', () => {
            const radio = card.querySelector(`input[name="tagMode"][value="${value}"]`);
            if (radio && !radio.checked) {
                radio.checked = true;
                updateModeUI();
                chrome.storage.local.set({ taggerMode: value });
            }
        });
    });

    // ── Realtime Count & Preview ──────────────────────────────
    function updateQuestionCount() {
        const ids = SharedUI.parseMultilineInput(questionIdsInput.value);
        questionCount.textContent = `${ids.length} câu hỏi`;
        questionCount.className = ids.length > 0
            ? 'text-xs font-semibold text-orange-600 font-medium'
            : 'text-xs text-slate-400 font-medium';
    }

    questionIdsInput.addEventListener('input', () => {
        updateQuestionCount();
        chrome.storage.local.set({ taggerQuestionIds: questionIdsInput.value });
    });

    clearIdsBtn.addEventListener('click', () => {
        questionIdsInput.value = '';
        updateQuestionCount();
        chrome.storage.local.set({ taggerQuestionIds: '' });
    });

    function updateTagPreview() {
        const mode = getSelectedMode();

        if (mode === 'overwrite') {
            const rawPairs = isBulkPairMode
                ? parsePairsFromText(bulkPairsTextarea ? bulkPairsTextarea.value : '')
                : getPairsFromUI();
            const validPairs = rawPairs.filter(p => p.from && p.from.trim().length > 0);

            if (pairCountBadge) {
                pairCountBadge.textContent = `${validPairs.length} cặp`;
                pairCountBadge.className = validPairs.length > 0
                    ? 'text-xs font-semibold text-purple-600 font-medium'
                    : 'text-[11px] text-slate-400 font-medium';
            }

            if (validPairs.length === 0) {
                tagsPreviewContainer.classList.add('hidden');
                tagsPreviewList.innerHTML = '';
                return;
            }

            tagsPreviewContainer.classList.remove('hidden');
            tagsPreviewList.innerHTML = '';

            validPairs.forEach(p => {
                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-center gap-1.5 text-xs bg-purple-50/80 border border-purple-200 rounded-lg px-2 py-0.5 shadow-sm';

                const fromPill = document.createElement('span');
                fromPill.className = 'font-semibold text-rose-700 font-mono text-[11px]';
                fromPill.textContent = p.from;

                const arrow = document.createElement('span');
                arrow.className = 'text-purple-600 font-bold text-[11px] select-none';
                arrow.textContent = '➔';

                const toPill = document.createElement('span');
                toPill.className = 'font-semibold text-emerald-700 font-mono text-[11px]';
                toPill.textContent = p.to || '(Xóa thẻ)';

                wrapper.appendChild(fromPill);
                wrapper.appendChild(arrow);
                wrapper.appendChild(toPill);
                tagsPreviewList.appendChild(wrapper);
            });
            return;
        }

        const tags = [...new Set(parseTags(tagInput.value))];

        tagCountBadge.textContent = `${tags.length} thẻ`;
        tagCountBadge.className = tags.length > 0
            ? 'text-xs font-semibold text-orange-600 font-medium'
            : 'text-xs text-slate-400 font-medium';

        if (tags.length === 0) {
            tagsPreviewContainer.classList.add('hidden');
            tagsPreviewList.innerHTML = '';
            return;
        }

        tagsPreviewContainer.classList.remove('hidden');
        tagsPreviewList.innerHTML = '';

        tags.forEach(tag => {
            const span = document.createElement('span');
            span.title = tag;

            if (mode === 'append') {
                span.className = 'tag-pill tag-pill-added';
                span.textContent = `+ ${tag}`;
            } else if (mode === 'remove') {
                span.className = 'tag-pill tag-pill-removed';
                span.textContent = `- ${tag}`;
            } else {
                span.className = 'tag-pill tag-pill-new';
                span.textContent = tag;
            }

            tagsPreviewList.appendChild(span);
        });
    }

    tagInput.addEventListener('input', () => {
        updateTagPreview();
        chrome.storage.local.set({ taggerTagsInput: tagInput.value });
    });


    // ── Log Helper ────────────────────────────────────────────
    function addLog(message, type = 'info') {
        const colors = {
            info: 'text-blue-400',
            success: 'text-green-400',
            warning: 'text-amber-400',
            error: 'text-red-400',
            header: 'text-gray-100 font-bold',
            dim: 'text-gray-500'
        };

        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        const p = document.createElement('p');
        p.className = `log-entry ${colors[type] || colors.info}`;
        p.textContent = `[${timeStr}] ${message}`;

        // Xóa placeholder nếu còn
        if (logContainer.children.length === 1 && logContainer.children[0].tagName === 'P'
            && logContainer.children[0].classList.contains('italic')) {
            logContainer.innerHTML = '';
        }

        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    clearLogBtn.addEventListener('click', () => {
        logContainer.innerHTML = '<p class="text-gray-500 italic">Log tiến trình sẽ xuất hiện tại đây khi chạy...</p>';
    });

    // ── Progress UI Helper ────────────────────────────────────
    function updateProgress(done, success, skipped, failed, total) {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
        progressStatusText.textContent = isRunning
            ? `Đang xử lý: ${done}/${total} câu hỏi...`
            : `Đã xử lý: ${done}/${total} câu hỏi`;

        statTotal.textContent = total;
        statSuccess.textContent = success;
        statSkipped.textContent = skipped;
        statFailed.textContent = failed;
        statRemaining.textContent = Math.max(0, total - done);
    }

    // ── Render Tag Pills in Table ─────────────────────────────
    function renderTagsCell(tags, type = 'neutral') {
        if (!tags || tags.length === 0) {
            return '<span class="text-slate-400 italic text-[11px]">(Trống)</span>';
        }

        return tags.map(tag => {
            let cls = 'tag-pill tag-pill-neutral';
            if (type === 'added') cls = 'tag-pill tag-pill-added';
            if (type === 'removed') cls = 'tag-pill tag-pill-removed';
            if (type === 'new') cls = 'tag-pill tag-pill-new';
            if (type === 'overwrite') cls = 'tag-pill tag-pill-overwrite';

            // Escape HTML
            const safe = String(tag).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return `<span class="${cls}" title="${safe}">${safe}</span>`;
        }).join('');
    }

    // ── Add Result Row ────────────────────────────────────────
    function addResultRow(index, questionId, status, mode, oldTags = [], finalTags = [], note = '') {
        const row = document.createElement('tr');
        row.className = 'result-row transition-colors';

        // Badge trạng thái
        let statusBadge = '';
        if (status === 'success') {
            statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Thành công</span>`;
        } else if (status === 'skipped') {
            statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">ℹ Bỏ qua</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">✗ Thất bại</span>`;
        }

        // Chế độ label
        let modeLabel = '';
        if (mode === 'append') {
            modeLabel = '<span class="font-medium text-emerald-700">Append</span>';
        } else if (mode === 'remove') {
            modeLabel = '<span class="font-medium text-rose-700">Remove</span>';
        } else if (mode === 'overwrite') {
            modeLabel = '<span class="font-medium text-purple-700">A → B</span>';
        } else {
            modeLabel = '<span class="font-medium text-indigo-700">Replace</span>';
        }

        // Render old tags and new tags
        const oldTagsHtml = renderTagsCell(oldTags, 'neutral');
        const newTagsHtml = renderTagsCell(finalTags, mode === 'append' ? 'added' : (mode === 'remove' ? 'neutral' : (mode === 'overwrite' ? 'overwrite' : 'new')));

        row.innerHTML = `
            <td class="px-3 py-2.5 text-slate-400 font-mono text-[11px]">${index}</td>
            <td class="px-3 py-2.5 font-mono font-semibold text-indigo-600">${questionId}</td>
            <td class="px-3 py-2.5">${statusBadge}</td>
            <td class="px-3 py-2.5">${modeLabel}</td>
            <td class="px-3 py-2.5">${oldTagsHtml}</td>
            <td class="px-3 py-2.5">${newTagsHtml}</td>
            <td class="px-3 py-2.5 text-slate-600 text-[11px]">${note}</td>
        `;

        resultsTableBody.appendChild(row);
    }

    // ── Copy Failed IDs ───────────────────────────────────────
    copyFailedBtn.addEventListener('click', () => {
        if (failedIds.length === 0) return;
        navigator.clipboard.writeText(failedIds.join('\n')).then(() => {
            const original = copyFailedBtn.textContent;
            copyFailedBtn.textContent = '✅ Đã copy!';
            setTimeout(() => { copyFailedBtn.textContent = original; }, 1500);
        });
    });

    // ── Export CSV ────────────────────────────────────────────
    exportCsvBtn.addEventListener('click', () => {
        if (processedResults.length === 0) {
            alert('Chưa có kết quả để xuất.');
            return;
        }

        const headers = ["STT", "ID Câu hỏi", "Trạng thái", "Chế độ", "Tags trước", "Tags sau", "Ghi chú"];
        const rows = processedResults.map((r, i) => [
            i + 1,
            r.questionId,
            r.statusText,
            r.mode,
            `"${(r.oldTags || []).join(', ').replace(/"/g, '""')}"`,
            `"${(r.finalTags || []).join(', ').replace(/"/g, '""')}"`,
            `"${(r.note || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ket_qua_cap_nhat_the_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // ── Stop Button Handler ───────────────────────────────────
    stopProcessBtn.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false;
            stopProcessBtn.disabled = true;
            stopProcessBtn.textContent = 'Đang dừng...';
            addLog('⚠ Người dùng đã bấm dừng. Đang hoàn tất batch hiện tại...', 'warning');
        }
    });

    // ── Main Process Execution ────────────────────────────────
    startProcessBtn.addEventListener('click', async () => {
        if (isRunning) return;

        // Reset UI
        SharedUI.resetUI({ messageP, statusResultDiv });
        resultsTableBody.innerHTML = '';
        failedIds = [];
        processedResults = [];
        copyFailedBtn.classList.add('hidden');

        const questionIds = SharedUI.parseMultilineInput(questionIdsInput.value);
        const mode = getSelectedMode();
        const batchSize = Math.max(1, parseInt(batchSizeInput.value) || 5);
        const delayMs = Math.max(0, parseInt(delayMsInput.value) || 200);

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng mở Popup để lấy UID và Token trước khi thực hiện.', 'error');
            return;
        }

        // Validate question IDs
        if (questionIds.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng nhập ít nhất một ID câu hỏi.', 'error');
            return;
        }

        let targetTags;
        let modeDescription = '';

        if (mode === 'overwrite') {
            const rawPairs = isBulkPairMode
                ? parsePairsFromText(bulkPairsTextarea ? bulkPairsTextarea.value : '')
                : getPairsFromUI();
            const validPairs = rawPairs.filter(p => p.from && p.from.trim().length > 0);

            if (validPairs.length === 0) {
                SharedUI.showMessage(statusResultDiv, messageP,
                    'Vui lòng nhập ít nhất một cặp thẻ A ➔ B (Thẻ A không được để trống).', 'error');
                return;
            }

            // Đồng bộ lại vào UI bảng nếu đang mở Bulk Textarea
            if (isBulkPairMode) {
                setPairsToUI(validPairs);
            }

            targetTags = { pairs: validPairs };
            const previewPairs = validPairs.slice(0, 3).map(p => `[${p.from} ➔ ${p.to || '(xóa)'}]`).join(', ');
            modeDescription = `Đổi ${validPairs.length} cặp thẻ: ${previewPairs}${validPairs.length > 3 ? '...' : ''}`;
        } else {
            targetTags = [...new Set(parseTags(tagInput.value))];
            if (targetTags.length === 0) {
                SharedUI.showMessage(statusResultDiv, messageP,
                    'Vui lòng nhập ít nhất một thẻ thao tác.', 'error');
                return;
            }
            modeDescription = mode === 'append' ? 'Thêm thẻ (Append)' : (mode === 'remove' ? 'Xóa thẻ (Remove)' : 'Thay thế thẻ (Replace)');
        }

        // Save settings to local storage
        chrome.storage.local.set({
            taggerQuestionIds: questionIdsInput.value,
            taggerTagsInput: tagInput.value,
            taggerPairs: getPairsFromUI(),
            taggerMode: mode,
            taggerBatchSize: batchSize,
            taggerDelayMs: delayMs
        });

        // Set running state
        isRunning = true;
        startProcessBtn.disabled = true;
        btnSpinner.classList.remove('hidden');
        btnText.textContent = 'Đang xử lý...';
        stopProcessBtn.disabled = false;
        stopProcessBtn.textContent = '⏹ Dừng lại';
        stopProcessBtn.classList.remove('hidden');

        progressCard.classList.remove('hidden');
        logCard.classList.remove('hidden');
        resultsCard.classList.remove('hidden');
        progressBar.classList.add('progress-active');
        updateProgress(0, 0, 0, 0, questionIds.length);

        addLog(`═══ Bắt đầu xử lý ${questionIds.length} câu hỏi ═══`, 'header');
        if (mode === 'overwrite') {
            addLog(`Chế độ: ${modeDescription}`, 'info');
        } else {
            addLog(`Chế độ: ${modeDescription} | Thẻ thao tác: [${targetTags.join(', ')}]`, 'info');
        }
        addLog(`Cấu hình: Batch=${batchSize}, Delay=${delayMs}ms`, 'dim');

        let successCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let doneCount = 0;
        let rowIndex = 1;

        // Process in batches
        for (let i = 0; i < questionIds.length; i += batchSize) {
            if (!isRunning) {
                addLog('⏹ Quá trình đã dừng theo yêu cầu của bạn.', 'warning');
                break;
            }

            const batch = questionIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (qid) => {
                try {
                    return await executeTagUpdateDirectly(qid, targetTags, mode, currentUid, currentToken);
                } catch (err) {
                    return {
                        success: false,
                        questionId: qid,
                        error: err.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);

            // Handle batch results
            for (const res of batchResults) {
                doneCount++;
                const qid = res.questionId;
                const oldTags = res.oldTags || [];
                const finalTags = res.finalTags || [];

                let status = 'failed';
                let statusText = 'Thất bại';
                let note = res.error || 'Lỗi không xác định';

                if (res.success) {
                    if (res.skipped) {
                        status = 'skipped';
                        statusText = 'Bỏ qua';
                        skippedCount++;
                        note = res.message || (mode === 'overwrite' ? 'Không chứa thẻ nào khớp để ghi đè' : 'Không chứa thẻ cần xóa');
                        addLog(`[${doneCount}/${questionIds.length}] ℹ ID ${qid}: ${note}`, 'warning');
                    } else {
                        status = 'success';
                        statusText = 'Thành công';
                        successCount++;
                        if (mode === 'append') {
                            const added = finalTags.filter(t => !oldTags.includes(t));
                            note = added.length > 0 ? `Đã thêm ${added.length} thẻ mới` : 'Các thẻ đã tồn tại đủ';
                        } else if (mode === 'remove') {
                            const removed = oldTags.filter(t => !finalTags.includes(t));
                            note = `Đã xóa ${removed.length} thẻ: [${removed.join(', ')}]`;
                        } else if (mode === 'overwrite') {
                            if (res.appliedChanges && res.appliedChanges.length > 0) {
                                note = `Đã đổi: ${res.appliedChanges.join(', ')}`;
                            } else {
                                note = 'Đã cập nhật thẻ';
                            }
                        } else {
                            note = `Đã thay thế bằng ${finalTags.length} thẻ`;
                        }
                        addLog(`[${doneCount}/${questionIds.length}] ✓ ID ${qid}: ${note}`, 'success');
                    }
                } else {
                    failedCount++;
                    failedIds.push(qid);
                    addLog(`[${doneCount}/${questionIds.length}] ✗ ID ${qid}: ${note}`, 'error');
                }

                addResultRow(rowIndex++, qid, status, mode, oldTags, finalTags, note);

                processedResults.push({
                    questionId: qid,
                    statusText,
                    mode,
                    oldTags,
                    finalTags,
                    note
                });

                updateProgress(doneCount, successCount, skippedCount, failedCount, questionIds.length);
            }

            // Summary text
            resultsSummary.textContent = `Tổng: ${questionIds.length} | Thành công: ${successCount} | Bỏ qua: ${skippedCount} | Thất bại: ${failedCount}`;

            // Delay between batches if not finished and not stopped
            if (i + batchSize < questionIds.length && isRunning && delayMs > 0) {
                await sleep(delayMs);
            }
        }

        // Hoàn tất
        isRunning = false;
        progressBar.classList.remove('progress-active');
        startProcessBtn.disabled = false;
        btnSpinner.classList.add('hidden');
        stopProcessBtn.classList.add('hidden');
        updateModeUI();

        // Show copy failed button if any
        if (failedIds.length > 0) {
            copyFailedBtn.classList.remove('hidden');
            copyFailedBtn.textContent = `📋 Copy ${failedIds.length} ID thất bại`;
        }

        const completionMsg = `Hoàn tất! Thành công: ${successCount}, Bỏ qua: ${skippedCount}, Thất bại: ${failedCount}/${questionIds.length}`;
        SharedUI.showMessage(statusResultDiv, messageP, completionMsg, failedCount === 0 ? 'success' : 'error');
        addLog(`═══ ${completionMsg} ═══`, failedCount === 0 ? 'success' : 'warning');
    });
});
