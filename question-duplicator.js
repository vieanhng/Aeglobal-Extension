// Question Duplicator - Optimized with shared modules
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const questionIdsInput = document.getElementById('question-ids');
    const bankLinksInput = document.getElementById('bank-links');
    const startDuplicationBtn = document.getElementById('startDuplicationBtn');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusResultDiv = document.getElementById('statusResult');
    const messageP = document.getElementById('message');
    const detailedResultsDiv = document.getElementById('detailedResults');
    const resultsList = document.getElementById('resultsList');

    // Validation elements
    const validateBanksBtn = document.getElementById('validateBanksBtn');
    const validateBtnText = document.getElementById('validateBtnText');
    const validateSpinner = document.getElementById('validateSpinner');
    const validationResults = document.getElementById('validationResults');
    const validationSummary = document.getElementById('validationSummary');
    const validationList = document.getElementById('validationList');

    // Log display elements
    const logContainer = document.getElementById('logContainer');
    const logMessages = document.getElementById('logMessages');
    const logStats = document.getElementById('logStats');
    const toggleLogBtn = document.getElementById('toggleLog');
    const clearLogBtn = document.getElementById('clearLog');
    const logContent = document.getElementById('logContent');

    let currentUid = '';
    let currentToken = '';
    let logCount = 0;
    let port = null;

    // Load and display auth data using shared module
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Load saved inputs
        chrome.storage.local.get(['questionIdsInput', 'bankLinksInput'], (data) => {
            if (data.questionIdsInput) questionIdsInput.value = data.questionIdsInput;
            if (data.bankLinksInput) bankLinksInput.value = data.bankLinksInput;
        });
    });

    // Connect to background script for real-time logging
    function connectToBackgroundLogger() {
        if (port) {
            try {
                port.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }

        port = chrome.runtime.connect({ name: "logChannel" });

        port.onMessage.addListener((msg) => {
            if (msg.type === 'log') {
                // Ensure log container is visible
                if (logContainer.classList.contains('hidden')) {
                    showLogContainer();
                }
                addLog(msg.message, msg.logType);
            }
        });

        port.onDisconnect.addListener(() => {
            console.log('Disconnected from background logger');
            port = null;
            // Try to reconnect after a short delay
            setTimeout(() => {
                console.log('Attempting to reconnect to background logger...');
                connectToBackgroundLogger();
            }, 1000);
        });

        console.log('Connected to background logger');
    }

    // Connect on page load
    connectToBackgroundLogger();

    // Log display functions
    function addLog(message, type = 'info') {
        logCount++;
        const logEntry = document.createElement('div');
        logEntry.className = 'py-1 border-b border-gray-800';

        const timestamp = new Date().toLocaleTimeString();
        let icon = '';
        let colorClass = 'text-gray-300';

        if (type === 'success') {
            icon = '✓';
            colorClass = 'text-green-400';
        } else if (type === 'error') {
            icon = '✗';
            colorClass = 'text-red-400';
        } else if (type === 'warning') {
            icon = '⚠';
            colorClass = 'text-yellow-400';
        } else if (type === 'header') {
            icon = '═';
            colorClass = 'text-blue-400 font-bold';
        } else {
            icon = '•';
            colorClass = 'text-gray-400';
        }

        logEntry.innerHTML = `
            <span class="text-gray-500">[${timestamp}]</span> 
            <span class="${colorClass}">${icon}</span> 
            <span class="${colorClass}">${escapeHtml(message)}</span>
        `;

        logMessages.appendChild(logEntry);
        logStats.textContent = `Tổng: ${logCount} dòng`;

        // Auto scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function clearLog() {
        logMessages.innerHTML = '';
        logCount = 0;
        logStats.textContent = 'Tổng: 0 dòng';
    }

    function showLogContainer() {
        logContainer.classList.remove('hidden');
    }

    // Toggle log visibility
    toggleLogBtn.addEventListener('click', () => {
        if (logContent.classList.contains('hidden')) {
            logContent.classList.remove('hidden');
            toggleLogBtn.textContent = 'Thu gọn';
        } else {
            logContent.classList.add('hidden');
            toggleLogBtn.textContent = 'Mở rộng';
        }
    });

    // Clear log button
    clearLogBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa tất cả log?')) {
            clearLog();
        }
    });

    // Validate banks button
    validateBanksBtn.addEventListener('click', async () => {
        const bankLinks = SharedUI.parseMultilineInput(bankLinksInput.value);

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            return;
        }

        // Validate input
        if (bankLinks.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng điền ít nhất một link ngân hàng.", 'error');
            return;
        }

        // Start validation
        validateSpinner.classList.remove('hidden');
        validateBtnText.textContent = 'Đang validate...';
        validateBanksBtn.disabled = true;
        validationList.innerHTML = '';
        validationResults.classList.remove('hidden');

        let validCount = 0;
        let invalidCount = 0;

        // Process each bank link
        for (let i = 0; i < bankLinks.length; i++) {
            const bankLink = bankLinks[i];

            // Create validation item
            const item = document.createElement('div');
            item.className = 'flex items-start space-x-2 text-xs p-2 bg-white rounded border border-gray-200';

            const spinner = document.createElement('div');
            spinner.className = 'flex-shrink-0 mt-0.5';
            spinner.innerHTML = `
                <svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            `;

            const content = document.createElement('div');
            content.className = 'flex-1';
            content.innerHTML = `
                <div class="font-mono text-gray-700 break-all">${bankLink}</div>
                <div class="text-gray-500 mt-1">Đang kiểm tra...</div>
            `;

            item.appendChild(spinner);
            item.appendChild(content);
            validationList.appendChild(item);

            // Validate the bank link
            const result = await SharedBankUtils.processBankLink(bankLink, currentUid, currentToken);

            // Update the item with result
            if (result.success) {
                validCount++;
                spinner.innerHTML = `<span class="text-green-500 text-lg">✓</span>`;
                content.innerHTML = `
                    <div class="font-mono text-gray-700 break-all">${bankLink}</div>
                    <div class="text-green-600 mt-1 font-semibold">✓ Hợp lệ - ${result.name}</div>
                    <div class="text-gray-500 text-xs mt-0.5">IID: ${result.id}</div>
                `;
                item.className = 'flex items-start space-x-2 text-xs p-2 bg-green-50 rounded border border-green-200';
            } else {
                invalidCount++;
                spinner.innerHTML = `<span class="text-red-500 text-lg">✗</span>`;
                content.innerHTML = `
                    <div class="font-mono text-gray-700 break-all">${bankLink}</div>
                    <div class="text-red-600 mt-1 font-semibold">✗ Lỗi: ${result.error}</div>
                `;
                item.className = 'flex items-start space-x-2 text-xs p-2 bg-red-50 rounded border border-red-200';
            }
        }

        // Update summary
        validationSummary.textContent = `Tổng: ${bankLinks.length} | Hợp lệ: ${validCount} | Lỗi: ${invalidCount}`;

        // Reset button
        validateSpinner.classList.add('hidden');
        validateBtnText.textContent = '✓ Validate ngân hàng';
        validateBanksBtn.disabled = false;

        // Show message
        if (invalidCount > 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                `⚠ Có ${invalidCount}/${bankLinks.length} link không hợp lệ. Vui lòng kiểm tra lại.`, 'error');
        } else {
            SharedUI.showMessage(statusResultDiv, messageP,
                `✓ Tất cả ${validCount} link ngân hàng đều hợp lệ!`, 'success');
        }
    });

    // Handle duplication button click
    startDuplicationBtn.addEventListener('click', async () => {
        // Reset UI
        SharedUI.resetUI({
            messageP,
            statusResultDiv,
            resultsList,
            detailedResultsDiv
        });
        clearLog();
        showLogContainer();

        const questionIds = SharedUI.parseMultilineInput(questionIdsInput.value);
        const bankLinks = SharedUI.parseMultilineInput(bankLinksInput.value);

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            addLog('Lỗi: Thiếu UID hoặc Token', 'error');
            return;
        }

        // Validate inputs
        if (questionIds.length === 0 || bankLinks.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng điền đầy đủ danh sách ID câu hỏi và link ngân hàng.", 'error');
            addLog('Lỗi: Thiếu danh sách ID câu hỏi hoặc ngân hàng', 'error');
            return;
        }

        // Save inputs
        chrome.storage.local.set({
            questionIdsInput: questionIdsInput.value,
            bankLinksInput: bankLinksInput.value
        });

        // Start processing
        SharedUI.setProcessing(startDuplicationBtn, buttonText, loadingSpinner, true, 'Nhân bản câu hỏi');
        SharedUI.showMessage(statusResultDiv, messageP, "Đang xử lý link ngân hàng...", 'info');

        // Add initial log
        addLog(`════════════════════════════════════════`, 'header');
        addLog(`Bắt đầu xử lý ${questionIds.length} câu hỏi cho ${bankLinks.length} ngân hàng`, 'header');
        addLog(`════════════════════════════════════════`, 'header');

        // Process bank links to get actual IIDs
        addLog(`Đang xử lý ${bankLinks.length} link ngân hàng...`, 'info');
        const processedBanks = [];

        for (let i = 0; i < bankLinks.length; i++) {
            const bankLink = bankLinks[i];
            addLog(`[${i + 1}/${bankLinks.length}] Đang xử lý: ${bankLink}`, 'info');

            const result = await SharedBankUtils.processBankLink(bankLink, currentUid, currentToken);

            if (result.success) {
                processedBanks.push(result.id);
                addLog(`✓ [${i + 1}/${bankLinks.length}] Đã xử lý thành công: ${bankLink} → IID: ${result.id}`, 'success');
            } else {
                addLog(`✗ [${i + 1}/${bankLinks.length}] Lỗi xử lý link ${bankLink}: ${result.error}`, 'error');
                SharedUI.showMessage(statusResultDiv, messageP,
                    `Lỗi: Không thể xử lý link ngân hàng "${bankLink}". ${result.error}`, 'error');
                SharedUI.setProcessing(startDuplicationBtn, buttonText, loadingSpinner, false, 'Nhân bản câu hỏi');
                return;
            }
        }

        addLog(`✓ Đã xử lý xong tất cả ${processedBanks.length} link ngân hàng`, 'success');
        addLog(`Kết nối với background script...`, 'info');

        SharedUI.showMessage(statusResultDiv, messageP, "Đang nhân bản và di chuyển câu hỏi...", 'info');

        // Send message to background with processed bank IIDs
        addLog(`Đang gửi yêu cầu xử lý đến background script...`, 'info');
        SharedUI.sendBackgroundMessage(
            {
                action: "duplicateAndMoveQuestions",
                uid: currentUid,
                token: currentToken,
                questionIds: questionIds,
                bankLinks: processedBanks  // Send resolved IIDs instead of original links
            },
            (response) => {
                addLog(`════════════════════════════════════════`, 'header');
                addLog('✓ Hoàn tất tất cả các thao tác!', 'success');
                addLog(`════════════════════════════════════════`, 'header');
                SharedUI.showMessage(statusResultDiv, messageP, 'Hoàn tất quá trình nhân bản và di chuyển!', 'success');
                displayResults(response.results);
                SharedUI.setProcessing(startDuplicationBtn, buttonText, loadingSpinner, false, 'Nhân bản câu hỏi');
            },
            (error) => {
                addLog(`✗ Lỗi: ${error}`, 'error');
                SharedUI.showMessage(statusResultDiv, messageP, `Lỗi: ${error}`, 'error');
                SharedUI.setProcessing(startDuplicationBtn, buttonText, loadingSpinner, false, 'Nhân bản câu hỏi');
            }
        );
    });

    // Display results
    function displayResults(results) {
        resultsList.innerHTML = '';
        if (results.length > 0) {
            detailedResultsDiv.classList.remove('hidden');
            results.forEach(result => {
                const li = document.createElement('li');
                li.className = result.success ? 'text-green-700' : 'text-red-700';
                let message = `${result.bankLink}: `;
                if (result.success) {
                    message += `Thành công (${result.duplicatedCount} câu hỏi được nhân bản và di chuyển)`;
                } else {
                    message += `Thất bại ${result.message ? ': ' + result.message : ''}`;
                }
                li.textContent = message;
                resultsList.appendChild(li);
            });
        }
    }
});