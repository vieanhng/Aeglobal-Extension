// Hai cột được giữ dạng chuỗi để không làm tròn ID khi dán từ sheet.
function validateSheetRows(rows) {
    const seen = new Set();
    const tasks = [];
    const errors = [];
    rows.forEach((row, index) => {
        const questionId = String(row[0] ?? '').trim();
        const bank = String(row[1] ?? '').trim();
        if (!questionId && !bank) return;
        let error = '';
        if (!questionId || !bank) error = 'Thiếu Question ID hoặc ngân hàng đích';
        else if (seen.has(questionId)) error = 'Question ID bị trùng; chỉ giữ một dòng cho mỗi câu hỏi';
        if (error) errors.push({ index, error });
        else tasks.push({ index, questionId, bank });
        seen.add(questionId);
    });
    return { tasks, errors };
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('spreadsheet');
    const start = document.getElementById('startMove');
    const add = document.getElementById('addRows');
    const clear = document.getElementById('clearRows');
    const status = document.getElementById('status');
    const summary = document.getElementById('summary');
    const progress = document.getElementById('progress');
    const logToggle = document.getElementById('showApiLogs');
    const logPanel = document.getElementById('apiLogPanel');
    const logList = document.getElementById('apiLogs');
    const logCount = document.getElementById('logCount');
    let logSecrets = [];
    let logs = 0;
    const storageKey = 'questionMoveSheetRows';
    let busy = false;
    let sheet;

    function redactLog(value) {
        return JSON.stringify(value, (key, item) => {
            if (/token|authorization|password|secret/i.test(key)) return '[ĐÃ ẨN]';
            if (typeof item === 'string') {
                for (const secret of logSecrets) {
                    if (secret) item = item.split(secret).join('[ĐÃ ẨN]').split(encodeURIComponent(secret)).join('[ĐÃ ẨN]');
                }
            }
            return item;
        }, 2);
    }
    function appendLog(entry, existing = null) {
        if (!logToggle.checked) return;
        if (!logs) logList.replaceChildren();
        const sanitized = redactLog(entry);
        const safe = JSON.parse(sanitized);
        const details = existing && logList.contains(existing) ? existing : document.createElement('details');
        const isNew = !details.parentNode;
        const timestamp = details.dataset.timestamp || new Date().toLocaleTimeString('vi-VN');
        details.dataset.timestamp = timestamp;
        details.replaceChildren();
        details.className = 'log-entry';
        details.dataset.error = String(Boolean(entry.error) || Number(entry.status) >= 400 || entry.response?.success === false);
        const heading = document.createElement('summary');
        const values = [timestamp, safe.method || 'POST', safe.endpoint || 'API',
            entry.error ? `Lỗi${entry.status ? ` · ${entry.status}` : ''}`
                : `${entry.status || (entry.completed ? 'Thành công' : 'Đang gửi')}${entry.durationMs != null ? ` · ${entry.durationMs} ms` : ''}`];
        values.forEach((value, index) => {
            const span = document.createElement('span');
            span.textContent = value;
            if (index === 1) span.className = 'log-method';
            if (index === 3) span.className = 'log-outcome';
            heading.appendChild(span);
        });
        const pre = document.createElement('pre');
        pre.textContent = sanitized.length > 24000 ? sanitized.slice(0, 24000) + '\n… (đã rút gọn)' : sanitized;
        details.append(heading, pre);
        if (isNew) logList.prepend(details);
        if (logList.children.length > 200) logList.lastElementChild.remove();
        logs = logList.children.length;
        logCount.textContent = logs;
        return details;
    }
    logToggle.addEventListener('change', () => {
        logPanel.hidden = !logToggle.checked;
        chrome.storage.local.set({ questionMoveSheetShowApiLogs: logToggle.checked }, () => {});
    });
    document.getElementById('clearApiLogs').addEventListener('click', () => {
        logList.replaceChildren();
        const empty = document.createElement('p');
        empty.className = 'log-empty';
        empty.textContent = 'Đã xóa log. Nhật ký mới sẽ xuất hiện tại đây.';
        logList.appendChild(empty);
        logs = 0;
        logCount.textContent = '0';
    });
    function updateInputCount() {
        document.getElementById('questionCount').textContent = readRows().filter(row => row[0].trim() || row[1].trim()).length;
    }

    function readRows() {
        return sheet.getData().map(row => [String(row[0] ?? ''), String(row[1] ?? '')]);
    }
    function save() {
        chrome.storage.local.set({ [storageKey]: readRows() }, () => {
            if (chrome.runtime.lastError) status.textContent = 'Không lưu được bảng: ' + chrome.runtime.lastError.message;
        });
    }
    function setResult(index, message, kind = '') {
        // Kết quả không tham gia lịch sử undo/redo của dữ liệu nhập.
        const previousEvents = sheet.ignoreEvents;
        const previousHistory = sheet.ignoreHistory;
        sheet.ignoreEvents = sheet.ignoreHistory = true;
        try {
            sheet.setValueFromCoords(2, index, message, true);
            const cell = sheet.getCell(`C${index + 1}`);
            if (cell) cell.dataset.result = kind;
        } finally {
            sheet.ignoreEvents = previousEvents;
            sheet.ignoreHistory = previousHistory;
        }
    }
    function resetResults() {
        if (!sheet) return;
        sheet.getData().forEach((_, index) => setResult(index, ''));
        summary.textContent = '';
        progress.hidden = true;
        document.getElementById('successCount').textContent = '0';
        document.getElementById('failedCount').textContent = '0';
        updateInputCount();
    }
    function lock(value) {
        busy = value;
        start.disabled = add.disabled = clear.disabled = value;
        sheet.options.editable = !value;
        sheet.options.allowInsertRow = sheet.options.allowDeleteRow = !value;
        container.inert = value;
        document.body.dataset.busy = String(value);
        logToggle.disabled = value;
        start.textContent = value ? 'Đang di chuyển…' : 'Di chuyển câu hỏi';
    }
    add.addEventListener('click', () => {
        if (!busy) sheet.insertRow(10);
    });
    clear.addEventListener('click', () => {
        if (!confirm('Xóa toàn bộ dữ liệu trong bảng?')) return;
        sheet.setData(Array.from({ length: 30 }, () => ['', '', '']));
        sheet.history = [];
        sheet.historyIndex = -1;
        resetResults();
        save();
    });
    start.addEventListener('click', async () => {
        if (busy) return;
        resetResults();
        const { tasks, errors } = validateSheetRows(readRows());
        errors.forEach(({ index, error }) => setResult(index, error, 'error'));
        if (errors.length || !tasks.length) {
            document.getElementById('failedCount').textContent = errors.length;
            status.textContent = errors.length ? 'Hãy sửa các dòng lỗi trước khi di chuyển. Chưa có câu hỏi nào được gửi.' : 'Vui lòng nhập dữ liệu.';
            return;
        }
        lock(true);
        let success = 0;
        let failed = 0;
        function update() {
            summary.textContent = `Tổng: ${tasks.length} | Thành công: ${success} | Thất bại: ${failed}`;
            progress.value = success + failed;
            document.getElementById('successCount').textContent = success;
            document.getElementById('failedCount').textContent = failed;
        }
        try {
            const auth = await new Promise(resolve => SharedAuth.loadAuthData(resolve));
            if (!SharedAuth.validateAuth(auth.uid, auth.token)) throw new Error('Vui lòng mở popup để cập nhật UID/Token.');
            logSecrets = [auth.token];
            save();
            const groups = new Map();
            const resolved = new Map();
            progress.hidden = false;
            progress.max = tasks.length;
            update();
            // Resolve trước và gom theo IID thực, kể cả khi người dùng nhập nhiều link cùng đích.
            for (const task of tasks) {
                status.textContent = `Đang kiểm tra ngân hàng: ${task.bank}`;
                if (!resolved.has(task.bank)) {
                    resolved.set(task.bank, await SharedBankUtils.processBankLink(task.bank, auth.uid, auth.token,
                        logToggle.checked ? appendLog : undefined));
                }
                const bank = resolved.get(task.bank);
                if (!bank.success) {
                    setResult(task.index, bank.error || 'Không xác định được ngân hàng', 'error');
                    failed++;
                    update();
                    continue;
                }
                const id = String(bank.id);
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id).push(task);
                setResult(task.index, `Chờ di chuyển → ${id}`);
            }
            for (const [bankIid, group] of groups) {
                status.textContent = `Đang di chuyển ${group.length} câu hỏi đến ${bankIid}…`;
                const requestLog = { method: 'POST', endpoint: '/question-bank/editor/move-questions',
                    request: { new_bank_iid: bankIid, ids: group.map(task => task.questionId) } };
                const pendingLog = appendLog(requestLog);
                const startedAt = Date.now();
                let apiTrace;
                try {
                    const response = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({ action: 'moveQuestions', uid: auth.uid, token: auth.token,
                            questionIds: group.map(task => task.questionId), bankIid, includeApiLogs: logToggle.checked }, response => {
                            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                            else resolve(response);
                        });
                    });
                    response?.apiLogs?.forEach(entry => {
                        if (entry.endpoint === requestLog.endpoint) apiTrace = entry;
                        else appendLog(entry);
                    });
                    const result = response?.results?.[0];
                    if (response?.status !== 'completed' || result?.success !== true) {
                        throw new Error(result?.message || response?.error || 'API không xác nhận di chuyển thành công');
                    }
                    appendLog({ ...requestLog, durationMs: Date.now() - startedAt,
                        response: result, ...apiTrace, completed: true }, pendingLog);
                    group.forEach(task => setResult(task.index, `Đã di chuyển → ${bankIid}`, 'success'));
                    success += group.length;
                } catch (error) {
                    appendLog({ ...requestLog, durationMs: Date.now() - startedAt,
                        ...apiTrace, error: error.message }, pendingLog);
                    group.forEach(task => setResult(task.index, error.message, 'error'));
                    failed += group.length;
                }
                update();
            }
            status.textContent = failed ? 'Đã xử lý xong. Kiểm tra các dòng thất bại trước khi chạy lại.' : 'Đã di chuyển thành công tất cả câu hỏi.';
        } catch (error) {
            status.textContent = error.message;
        } finally {
            lock(false);
        }
    });
    try {
        const saved = await chrome.storage.local.get([storageKey, 'questionMoveSheetShowApiLogs']);
        logToggle.checked = saved.questionMoveSheetShowApiLogs === true;
        logPanel.hidden = !logToggle.checked;
        const rows = Array.isArray(saved[storageKey]) ? saved[storageKey] : [];
        const data = rows.map(row => [String(row?.[0] ?? ''), String(row?.[1] ?? ''), '']);
        while (data.length < 30) data.push(['', '', '']);
        const onEdit = () => {
            if (!sheet || busy) return;
            resetResults();
            save();
        };
        sheet = jspreadsheet(container, {
            data,
            columns: [
                { type: 'text', title: 'Question ID', width: 210 },
                { type: 'text', title: 'Target Bank ID / Link', width: 420 },
                { type: 'text', title: 'Kết quả', width: 320, readOnly: true }
            ],
            minDimensions: [3, 30],
            tableOverflow: true,
            tableHeight: '55vh',
            tableWidth: '100%',
            columnSorting: false,
            rowDrag: false,
            allowInsertColumn: false,
            allowManualInsertColumn: false,
            allowDeleteColumn: false,
            allowRenameColumn: false,
            allowExport: false,
            parseFormulas: false,
            autoCasting: false,
            wordWrap: true,
            onbeforechange: (el, cell, x, y, value) => String(value ?? ''),
            onbeforeinsertrow: () => !busy,
            onbeforedeleterow: () => !busy,
            onafterchanges: onEdit,
            oninsertrow: onEdit,
            ondeleterow: onEdit,
            onundo: onEdit,
            onredo: onEdit,
            text: {
                insertANewRowBefore: 'Thêm dòng phía trên',
                insertANewRowAfter: 'Thêm dòng phía dưới',
                deleteSelectedRows: 'Xóa dòng đã chọn',
                copy: 'Sao chép', paste: 'Dán', cut: 'Cắt',
                undo: 'Hoàn tác', redo: 'Làm lại'
            }
        });
        updateInputCount();
        SharedAuth.loadAuthData(auth => {
            document.getElementById('authBadge').dataset.ready = String(Boolean(SharedAuth.validateAuth(auth.uid, auth.token)));
            document.getElementById('authStatus').textContent = SharedAuth.validateAuth(auth.uid, auth.token)
                ? `UID: ${auth.uid} — Đã nạp xác thực từ extension.` : 'Chưa có UID/Token. Hãy mở popup để lấy xác thực.';
        });
        start.disabled = false;
    } catch (error) {
        status.textContent = `Không thể tải bảng: ${error.message}`;
    }
});
