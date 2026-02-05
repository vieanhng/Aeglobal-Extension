// Question Exporter - Export question IDs from question banks
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const bankLinksInput = document.getElementById('bank-links');
    const startExportBtn = document.getElementById('startExport');
    const copyAllIdsBtn = document.getElementById('copyAllIds');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusResultDiv = document.getElementById('statusResult');
    const messageP = document.getElementById('message');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const bankResults = document.getElementById('bankResults');
    const resultsSummary = document.getElementById('resultsSummary');

    let currentUid = '';
    let currentToken = '';
    let allExportedIds = [];

    // Load and display auth data using shared module
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Load saved input
        chrome.storage.local.get(['bankLinksInput'], (data) => {
            if (data.bankLinksInput) bankLinksInput.value = data.bankLinksInput;
        });
    });

    // Extract bank ID from URL or return as-is if already an ID
    // Returns object: { id: string, needsResolve: boolean }
    function extractBankId(input) {
        const trimmed = input.trim();

        // Check if it's a direct numeric ID
        if (/^\d+$/.test(trimmed)) {
            return { id: trimmed, needsResolve: false };
        }

        // Check if it's a URL with numeric ID: /question-bank/12345
        const numericMatch = trimmed.match(/\/question-bank\/(\d+)/);
        if (numericMatch) {
            return { id: numericMatch[1], needsResolve: false };
        }

        // Check if it's a shortcode URL: /question-bank/abc123 or just abc123
        const shortcodeMatch = trimmed.match(/\/folder\/([^\/\?]+)/) || trimmed.match(/^([a-zA-Z0-9_-]+)$/);
        if (shortcodeMatch) {
            return { id: shortcodeMatch[1], needsResolve: true };
        }

        // Fallback: treat as ID that might need resolution
        return { id: trimmed, needsResolve: true };
    }


    // Update progress
    function updateProgress(current, total) {
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Đang xử lý: ${current}/${total}`;
    }

    // Create bank result card
    function createBankResultCard(bankId, bankName, questionIds) {
        const card = document.createElement('div');
        card.className = 'bg-gray-50 border border-gray-200 rounded-lg p-4';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-3';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <h4 class="font-semibold text-gray-800">${bankName}</h4>
            <p class="text-sm text-gray-600">ID: ${bankId} | Tổng: ${questionIds.length} câu hỏi</p>
        `;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded hover:bg-blue-600 transition';
        copyBtn.textContent = '📋 Copy';
        copyBtn.addEventListener('click', () => {
            const idsText = questionIds.join('\n');
            navigator.clipboard.writeText(idsText).then(() => {
                copyBtn.textContent = '✓ Đã copy!';
                copyBtn.className = 'px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded';
                setTimeout(() => {
                    copyBtn.textContent = '📋 Copy';
                    copyBtn.className = 'px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded hover:bg-blue-600 transition';
                }, 2000);
            });
        });

        header.appendChild(titleDiv);
        header.appendChild(copyBtn);

        const idsContainer = document.createElement('div');
        idsContainer.className = 'bg-white border border-gray-300 rounded p-3 max-h-60 overflow-y-auto';

        const idsList = document.createElement('pre');
        idsList.className = 'text-sm font-mono text-gray-700 whitespace-pre-wrap';
        idsList.textContent = questionIds.join('\n');

        idsContainer.appendChild(idsList);

        card.appendChild(header);
        card.appendChild(idsContainer);

        return card;
    }

    // Handle export button click
    startExportBtn.addEventListener('click', async () => {
        // Reset UI
        SharedUI.resetUI({
            messageP,
            statusResultDiv,
            detailedResultsDiv: resultsSection
        });
        bankResults.innerHTML = '';
        progressContainer.classList.add('hidden');
        copyAllIdsBtn.classList.add('hidden');
        allExportedIds = [];

        const bankInputs = SharedUI.parseMultilineInput(bankLinksInput.value);

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            return;
        }

        // Validate input
        if (bankInputs.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng điền ít nhất một link ngân hàng hoặc ID.", 'error');
            return;
        }

        // Extract bank IDs with resolution info
        const bankIds = bankInputs
            .map(extractBankId)
            .filter(item => item && item.id && item.id.length > 0);

        if (bankIds.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Không tìm thấy ID ngân hàng hợp lệ.", 'error');
            return;
        }

        // Save input
        chrome.storage.local.set({ bankLinksInput: bankLinksInput.value });

        // Start processing
        SharedUI.setProcessing(startExportBtn, buttonText, loadingSpinner, true, 'Xuất ID câu hỏi');
        SharedUI.showMessage(statusResultDiv, messageP,
            `Đang xuất ID từ ${bankIds.length} ngân hàng...`, 'info');

        // Show progress
        progressContainer.classList.remove('hidden');
        updateProgress(0, bankIds.length);

        // Show results section
        resultsSection.classList.remove('hidden');

        let totalQuestions = 0;
        let successBanks = 0;

        // Process each bank
        for (let i = 0; i < bankIds.length; i++) {
            const bankInfo = bankIds[i];
            updateProgress(i + 1, bankIds.length);

            try {
                // Send message to background to export questions
                const result = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: "exportQuestions",
                        uid: currentUid,
                        token: currentToken,
                        bankId: bankInfo.id,
                        needsResolve: bankInfo.needsResolve
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error:", chrome.runtime.lastError.message);
                            resolve({ success: false, bankId: bankInfo.id });
                        } else if (response && response.status === "completed") {
                            resolve(response.result);
                        } else {
                            resolve({ success: false, bankId: bankInfo.id });
                        }
                    });
                });

                // Add result card
                if (result.success && result.questionIds && result.questionIds.length > 0) {
                    const card = createBankResultCard(bankInfo.id, result.bankName, result.questionIds);
                    bankResults.appendChild(card);

                    allExportedIds.push(...result.questionIds);
                    totalQuestions += result.questionIds.length;
                    successBanks++;
                } else {
                    // Show error card
                    const errorCard = document.createElement('div');
                    errorCard.className = 'bg-red-50 border border-red-200 rounded-lg p-4';
                    errorCard.innerHTML = `
                        <h4 class="font-semibold text-red-800">Lỗi: Ngân hàng ID ${bankInfo.id}</h4>
                        <p class="text-sm text-red-600 mt-1">Không thể xuất câu hỏi từ ngân hàng này.</p>
                    `;
                    bankResults.appendChild(errorCard);
                }

            } catch (error) {
                console.error(`Error processing bank ${bankInfo.id}:`, error);
                const errorCard = document.createElement('div');
                errorCard.className = 'bg-red-50 border border-red-200 rounded-lg p-4';
                errorCard.innerHTML = `
                    <h4 class="font-semibold text-red-800">Lỗi: Ngân hàng ID ${bankInfo.id}</h4>
                    <p class="text-sm text-red-600 mt-1">Đã xảy ra lỗi khi xử lý.</p>
                `;
                bankResults.appendChild(errorCard);
            }
        }

        // Update summary
        resultsSummary.textContent = `Tổng: ${totalQuestions} câu hỏi từ ${successBanks}/${bankIds.length} ngân hàng`;

        // Hide progress, show completion message
        progressContainer.classList.add('hidden');

        if (successBanks > 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                `✓ Hoàn tất! Đã xuất ${totalQuestions} câu hỏi từ ${successBanks} ngân hàng.`, 'success');
            copyAllIdsBtn.classList.remove('hidden');
        } else {
            SharedUI.showMessage(statusResultDiv, messageP,
                `✗ Không thể xuất câu hỏi từ bất kỳ ngân hàng nào.`, 'error');
        }

        SharedUI.setProcessing(startExportBtn, buttonText, loadingSpinner, false, 'Xuất ID câu hỏi');
    });

    // Copy all IDs button
    copyAllIdsBtn.addEventListener('click', () => {
        const allIdsText = allExportedIds.join('\n');
        navigator.clipboard.writeText(allIdsText).then(() => {
            const originalText = copyAllIdsBtn.textContent;
            copyAllIdsBtn.textContent = '✓ Đã copy tất cả!';
            copyAllIdsBtn.className = 'inline-flex items-center px-6 py-3 border border-green-300 text-base font-medium rounded-md shadow-sm text-white bg-green-500';
            setTimeout(() => {
                copyAllIdsBtn.textContent = originalText;
                copyAllIdsBtn.className = 'inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';
            }, 2000);
        });
    });
});
