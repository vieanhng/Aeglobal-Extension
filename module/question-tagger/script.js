// Question Tagger - Quản lý thẻ câu hỏi hàng loạt (Append, Remove, Replace)
document.addEventListener('DOMContentLoaded', () => {
    // ── DOM Elements ──────────────────────────────────────────
    const displayUid         = document.getElementById('displayUid');
    const displayToken       = document.getElementById('displayToken');
    const displaySavedDate   = document.getElementById('displaySavedDate');
    const statusResultDiv    = document.getElementById('statusResult');
    const messageP           = document.getElementById('message');

    // Inputs
    const questionIdsInput   = document.getElementById('question-ids');
    const questionCount      = document.getElementById('questionCount');
    const clearIdsBtn        = document.getElementById('clearIdsBtn');
    const tagInput           = document.getElementById('tagInput');
    const tagsInputLabel     = document.getElementById('tagsInputLabel');
    const tagCountBadge      = document.getElementById('tagCountBadge');
    const tagHelperText      = document.getElementById('tagHelperText');
    const tagsPreviewContainer = document.getElementById('tagsPreviewContainer');
    const tagsPreviewList    = document.getElementById('tagsPreviewList');
    const batchSizeInput     = document.getElementById('batchSize');
    const delayMsInput       = document.getElementById('delayMs');

    // Mode Radios & Cards
    const modeRadios         = document.querySelectorAll('input[name="tagMode"]');
    const modeCardAppend     = document.getElementById('modeCardAppend');
    const modeCardRemove     = document.getElementById('modeCardRemove');
    const modeCardReplace    = document.getElementById('modeCardReplace');

    // Buttons
    const startProcessBtn    = document.getElementById('startProcessBtn');
    const stopProcessBtn     = document.getElementById('stopProcessBtn');
    const btnSpinner         = document.getElementById('btnSpinner');
    const btnText            = document.getElementById('btnText');

    // Progress Card
    const progressCard       = document.getElementById('progressCard');
    const progressBar        = document.getElementById('progressBar');
    const progressPercent    = document.getElementById('progressPercent');
    const progressStatusText = document.getElementById('progressStatusText');
    const statTotal          = document.getElementById('statTotal');
    const statSuccess        = document.getElementById('statSuccess');
    const statSkipped        = document.getElementById('statSkipped');
    const statFailed         = document.getElementById('statFailed');
    const statRemaining      = document.getElementById('statRemaining');

    // Log Card
    const logCard            = document.getElementById('logCard');
    const logContainer       = document.getElementById('logContainer');
    const clearLogBtn        = document.getElementById('clearLogBtn');

    // Results Card
    const resultsCard        = document.getElementById('resultsCard');
    const resultsSummary     = document.getElementById('resultsSummary');
    const resultsTableBody   = document.getElementById('resultsTableBody');
    const copyFailedBtn      = document.getElementById('copyFailedBtn');
    const exportCsvBtn       = document.getElementById('exportCsvBtn');

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
            'taggerMode',
            'taggerBatchSize',
            'taggerDelayMs'
        ], (data) => {
            if (data.taggerQuestionIds) questionIdsInput.value = data.taggerQuestionIds;
            if (data.taggerTagsInput)   tagInput.value = data.taggerTagsInput;
            if (data.taggerBatchSize)   batchSizeInput.value = data.taggerBatchSize;
            if (data.taggerDelayMs)     delayMsInput.value = data.taggerDelayMs;

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
            const inputTags = (Array.isArray(tags) ? tags : [tags])
                .map(t => typeof t === 'string' ? t.trim() : String(t).trim())
                .filter(t => t.length > 0);

            const currentTags = Array.isArray(questionData.tags) ? [...questionData.tags] : [];
            let finalTags = [];

            if (mode === 'append') {
                finalTags = [...new Set([...currentTags, ...inputTags])];
            } else if (mode === 'replace') {
                finalTags = [...new Set(inputTags)];
            } else if (mode === 'remove') {
                const tagsToRemoveSet = new Set(inputTags.map(t => t.toLowerCase()));
                const matchedTags = currentTags.filter(t => tagsToRemoveSet.has(t.toLowerCase()));

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

                finalTags = currentTags.filter(t => !tagsToRemoveSet.has(t.toLowerCase()));
            } else {
                finalTags = [...new Set([...currentTags, ...inputTags])];
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
        modeCardAppend.className = 'mode-card rounded-lg p-3 relative';
        modeCardRemove.className = 'mode-card rounded-lg p-3 relative';
        modeCardReplace.className = 'mode-card rounded-lg p-3 relative';

        if (mode === 'append') {
            modeCardAppend.classList.add('selected-append');
            tagsInputLabel.innerHTML = 'Danh sách thẻ cần thêm <span class="text-red-500">*</span>';
            tagHelperText.textContent = '💡 Thẻ mới sẽ được gộp vào danh sách thẻ hiện tại của câu hỏi (không trùng lặp).';
            btnText.textContent = '🚀 Bắt đầu thêm thẻ';
        } else if (mode === 'remove') {
            modeCardRemove.classList.add('selected-remove');
            tagsInputLabel.innerHTML = 'Danh sách thẻ cần xóa <span class="text-red-500">*</span>';
            tagHelperText.textContent = '💡 Hệ thống sẽ tìm câu hỏi và gỡ bỏ các thẻ này nếu có trong câu hỏi.';
            btnText.textContent = '🗑️ Bắt đầu xóa thẻ';
        } else if (mode === 'replace') {
            modeCardReplace.classList.add('selected-replace');
            tagsInputLabel.innerHTML = 'Danh sách thẻ mới thay thế <span class="text-red-500">*</span>';
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

    // ── Realtime Count & Preview ──────────────────────────────
    function updateQuestionCount() {
        const ids = SharedUI.parseMultilineInput(questionIdsInput.value);
        questionCount.textContent = `${ids.length} câu hỏi`;
        questionCount.className = ids.length > 0
            ? 'text-xs font-semibold text-orange-600 font-medium'
            : 'text-xs text-gray-400 font-medium';
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
        const tags = [...new Set(parseTags(tagInput.value))];

        tagCountBadge.textContent = `${tags.length} thẻ`;
        tagCountBadge.className = tags.length > 0
            ? 'text-xs font-semibold text-orange-600 font-medium'
            : 'text-xs text-gray-400 font-medium';

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
            info:    'text-blue-400',
            success: 'text-green-400',
            warning: 'text-amber-400',
            error:   'text-red-400',
            header:  'text-gray-100 font-bold',
            dim:     'text-gray-500'
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

        statTotal.textContent     = total;
        statSuccess.textContent   = success;
        statSkipped.textContent   = skipped;
        statFailed.textContent    = failed;
        statRemaining.textContent = Math.max(0, total - done);
    }

    // ── Render Tag Pills in Table ─────────────────────────────
    function renderTagsCell(tags, type = 'neutral') {
        if (!tags || tags.length === 0) {
            return '<span class="text-gray-400 italic text-[11px]">(Trống)</span>';
        }

        return tags.map(tag => {
            let cls = 'tag-pill tag-pill-neutral';
            if (type === 'added')   cls = 'tag-pill tag-pill-added';
            if (type === 'removed') cls = 'tag-pill tag-pill-removed';
            if (type === 'new')     cls = 'tag-pill tag-pill-new';

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
        } else {
            modeLabel = '<span class="font-medium text-indigo-700">Replace</span>';
        }

        // Render old tags and new tags
        const oldTagsHtml = renderTagsCell(oldTags, 'neutral');
        const newTagsHtml = renderTagsCell(finalTags, mode === 'append' ? 'added' : (mode === 'remove' ? 'neutral' : 'new'));

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
        const targetTags = [...new Set(parseTags(tagInput.value))];
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

        // Validate tags
        if (targetTags.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng nhập ít nhất một thẻ thao tác.', 'error');
            return;
        }

        // Save settings to local storage
        chrome.storage.local.set({
            taggerQuestionIds: questionIdsInput.value,
            taggerTagsInput:   tagInput.value,
            taggerMode:        mode,
            taggerBatchSize:   batchSize,
            taggerDelayMs:     delayMs
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

        const modeDescription = mode === 'append' ? 'Thêm thẻ (Append)' : (mode === 'remove' ? 'Xóa thẻ (Remove)' : 'Thay thế thẻ (Replace)');
        addLog(`═══ Bắt đầu xử lý ${questionIds.length} câu hỏi ═══`, 'header');
        addLog(`Chế độ: ${modeDescription} | Thẻ thao tác: [${targetTags.join(', ')}]`, 'info');
        addLog(`Cấu hình: Batch=${batchSize}, Delay=${delayMs}ms`, 'dim');

        let successCount = 0;
        let skippedCount = 0;
        let failedCount  = 0;
        let doneCount    = 0;
        let rowIndex     = 1;

        // Process in batches
        for (let i = 0; i < questionIds.length; i += batchSize) {
            if (!isRunning) {
                addLog('⏹ Quá trình đã dừng theo yêu cầu của bạn.', 'warning');
                break;
            }

            const batch = questionIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (qid) => {
                try {
                    // Thử gửi qua background service worker trước
                    const bgResponse = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({
                            action: "updateQuestionTags",
                            uid: currentUid,
                            token: currentToken,
                            questionId: qid,
                            tags: targetTags,
                            mode: mode
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                // Background port có thể bị đóng nếu extension chưa được reload
                                resolve(null);
                            } else {
                                resolve(response);
                            }
                        });
                    });

                    if (bgResponse) {
                        return bgResponse;
                    }

                    // Tự động fallback gọi trực tiếp API từ trang extension
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
                        note = res.message || 'Không chứa thẻ cần xóa';
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
