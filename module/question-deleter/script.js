// Question Deleter — Xóa câu hỏi hàng loạt theo batch
document.addEventListener('DOMContentLoaded', () => {
    // ── DOM Elements ──────────────────────────────────────────
    const displayUid        = document.getElementById('displayUid');
    const displayToken      = document.getElementById('displayToken');
    const displaySavedDate  = document.getElementById('displaySavedDate');
    const questionIdsInput  = document.getElementById('question-ids');
    const questionCount     = document.getElementById('questionCount');
    const batchSizeInput    = document.getElementById('batchSize');
    const delayMsInput      = document.getElementById('delayMs');
    const startDeleteBtn    = document.getElementById('startDeleteBtn');
    const deleteSpinner     = document.getElementById('deleteSpinner');
    const deleteButtonText  = document.getElementById('deleteButtonText');
    const statusResultDiv   = document.getElementById('statusResult');
    const messageP          = document.getElementById('message');

    // Progress
    const progressCard      = document.getElementById('progressCard');
    const progressBar       = document.getElementById('progressBar');
    const progressText      = document.getElementById('progressText');
    const progressStats     = document.getElementById('progressStats');
    const statSuccess       = document.getElementById('statSuccess');
    const statFailed        = document.getElementById('statFailed');
    const statRemaining     = document.getElementById('statRemaining');

    // Log
    const logCard           = document.getElementById('logCard');
    const logContainer      = document.getElementById('logContainer');
    const clearLogBtn       = document.getElementById('clearLogBtn');

    // Results
    const resultsCard       = document.getElementById('resultsCard');
    const resultsTableBody  = document.getElementById('resultsTableBody');
    const resultsSummary    = document.getElementById('resultsSummary');
    const copyFailedBtn     = document.getElementById('copyFailedBtn');

    let currentUid   = '';
    let currentToken = '';
    let isRunning    = false;
    let failedIds    = [];

    // ── Auth ───────────────────────────────────────────────────
    SharedAuth.loadAuthData((authData) => {
        currentUid   = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Khôi phục inputs đã lưu
        chrome.storage.local.get(['questionDeleterIds', 'questionDeleterBatch', 'questionDeleterDelay'], (data) => {
            if (data.questionDeleterIds)  questionIdsInput.value = data.questionDeleterIds;
            if (data.questionDeleterBatch) batchSizeInput.value  = data.questionDeleterBatch;
            if (data.questionDeleterDelay) delayMsInput.value    = data.questionDeleterDelay;
            updateCount();
        });
    });

    // ── Count câu hỏi ─────────────────────────────────────────
    function updateCount() {
        const ids = SharedUI.parseMultilineInput(questionIdsInput.value);
        questionCount.textContent = `${ids.length} câu hỏi`;
        questionCount.className = ids.length > 0
            ? 'mt-1.5 text-xs font-semibold text-red-500'
            : 'mt-1.5 text-xs text-gray-400';
    }

    questionIdsInput.addEventListener('input', updateCount);

    // ── Log helper ────────────────────────────────────────────
    function addLog(message, type = 'info') {
        const colors = {
            info:    'text-blue-400',
            success: 'text-green-400',
            error:   'text-red-400',
            warning: 'text-yellow-400',
            header:  'text-gray-100 font-semibold',
            dim:     'text-gray-500',
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
        logContainer.innerHTML = '<p class="text-gray-500 italic">Log sẽ xuất hiện tại đây khi bắt đầu xử lý...</p>';
    });

    // ── Progress helper ───────────────────────────────────────
    function updateProgress(done, success, failed, total) {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressStats.textContent = `${done} / ${total}`;
        progressText.textContent  = `Đã xử lý: ${done}/${total} (${pct}%)`;
        statSuccess.textContent   = success;
        statFailed.textContent    = failed;
        statRemaining.textContent = total - done;
    }

    // ── Result row ────────────────────────────────────────────
    function addResultRow(index, questionId, success, note = '') {
        const row = document.createElement('tr');
        row.className = 'result-row';

        const badge = success
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ Đã xóa</span>`
            : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">✗ Thất bại</span>`;

        row.innerHTML = `
            <td class="px-3 py-2 text-xs text-gray-400">${index}</td>
            <td class="px-3 py-2 text-xs font-mono text-blue-600 font-semibold">${questionId}</td>
            <td class="px-3 py-2">${badge}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${note || (success ? 'Xóa thành công' : 'Lỗi không xác định')}</td>
        `;

        resultsTableBody.appendChild(row);
    }

    // ── Sleep helper ──────────────────────────────────────────
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ── Copy failed IDs ───────────────────────────────────────
    copyFailedBtn.addEventListener('click', () => {
        if (failedIds.length === 0) return;
        navigator.clipboard.writeText(failedIds.join('\n')).then(() => {
            const orig = copyFailedBtn.textContent;
            copyFailedBtn.textContent = '✅ Đã copy!';
            setTimeout(() => { copyFailedBtn.textContent = orig; }, 1500);
        });
    });

    // ── Main delete logic ─────────────────────────────────────
    startDeleteBtn.addEventListener('click', async () => {
        if (isRunning) return;

        // Reset UI
        SharedUI.resetUI({ messageP, statusResultDiv });
        resultsTableBody.innerHTML = '';
        failedIds = [];
        copyFailedBtn.classList.add('hidden');

        const questionIds = SharedUI.parseMultilineInput(questionIdsInput.value);
        const batchSize   = Math.max(1, parseInt(batchSizeInput.value) || 5);
        const delayMs     = Math.max(0, parseInt(delayMsInput.value)   || 300);

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng lấy thông tin xác thực từ Popup trước khi thực hiện.', 'error');
            return;
        }

        // Validate input
        if (questionIds.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng nhập ít nhất một ID câu hỏi.', 'error');
            return;
        }

        // Lưu settings
        chrome.storage.local.set({
            questionDeleterIds:   questionIdsInput.value,
            questionDeleterBatch: batchSize,
            questionDeleterDelay: delayMs,
        });

        // Khởi động
        isRunning = true;
        startDeleteBtn.disabled = true;
        deleteSpinner.classList.remove('hidden');
        deleteButtonText.textContent = 'Đang xóa...';

        progressCard.classList.remove('hidden');
        logCard.classList.remove('hidden');
        resultsCard.classList.remove('hidden');
        progressBar.classList.add('progress-active');
        updateProgress(0, 0, 0, questionIds.length);

        addLog(`═══ Bắt đầu xóa ${questionIds.length} câu hỏi ═══`, 'header');
        addLog(`Cấu hình: Batch=${batchSize}, Delay=${delayMs}ms`, 'dim');

        let successCount = 0;
        let failedCount  = 0;
        let doneCount    = 0;
        let rowIndex     = 1;

        // Chia thành các batch
        for (let i = 0; i < questionIds.length; i += batchSize) {
            const batch = questionIds.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(questionIds.length / batchSize);

            addLog(`── Đợt ${batchNum}/${totalBatches}: ${batch.length} câu hỏi ──`, 'header');

            // Xử lý từng câu trong batch song song
            const batchPromises = batch.map(async (questionId) => {
                addLog(`  Đang xóa: ${questionId}`, 'info');

                const result = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action:  'deleteQuestion',
                        uid:     currentUid,
                        token:   currentToken,
                        questionId: questionId,
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                        } else {
                            resolve(response || { success: false, error: 'Không có phản hồi' });
                        }
                    });
                });

                return { questionId, ...result };
            });

            // Chờ tất cả câu trong batch hoàn thành
            const batchResults = await Promise.all(batchPromises);

            // Ghi kết quả từng câu
            batchResults.forEach(({ questionId, success, error, message }) => {
                doneCount++;
                if (success) {
                    successCount++;
                    addLog(`  ✓ ${questionId} — Xóa thành công`, 'success');
                    addResultRow(rowIndex++, questionId, true);
                } else {
                    failedCount++;
                    failedIds.push(questionId);
                    const errMsg = error || message || 'Lỗi không xác định';
                    addLog(`  ✗ ${questionId} — ${errMsg}`, 'error');
                    addResultRow(rowIndex++, questionId, false, errMsg);
                }
                updateProgress(doneCount, successCount, failedCount, questionIds.length);
            });

            addLog(`  Đợt ${batchNum} hoàn thành: ✓${batchResults.filter(r => r.success).length} ✗${batchResults.filter(r => !r.success).length}`, 'dim');

            // Delay giữa các batch (trừ batch cuối)
            if (i + batchSize < questionIds.length && delayMs > 0) {
                addLog(`  Chờ ${delayMs}ms trước đợt tiếp theo...`, 'dim');
                await sleep(delayMs);
            }
        }

        // Kết thúc
        progressBar.classList.remove('progress-active');
        addLog(`═══ Hoàn tất: ✓${successCount} thành công, ✗${failedCount} thất bại ═══`, 'header');

        resultsSummary.textContent = `Tổng: ${questionIds.length} | Thành công: ${successCount} | Thất bại: ${failedCount}`;

        if (failedIds.length > 0) {
            copyFailedBtn.classList.remove('hidden');
        }

        if (failedCount === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                `✅ Hoàn tất! Đã xóa thành công ${successCount}/${questionIds.length} câu hỏi.`, 'success');
        } else if (successCount === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                `❌ Thất bại! Không xóa được câu hỏi nào. Kiểm tra lại token hoặc quyền truy cập.`, 'error');
        } else {
            SharedUI.showMessage(statusResultDiv, messageP,
                `⚠️ Xóa ${successCount} thành công, ${failedCount} thất bại. Xem chi tiết bên trên.`, 'info');
        }

        // Reset button
        isRunning = false;
        startDeleteBtn.disabled = false;
        deleteSpinner.classList.add('hidden');
        deleteButtonText.textContent = '🗑️ Bắt đầu xóa';
    });
});
