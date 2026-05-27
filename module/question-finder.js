// Question Finder - Enhanced with batch processing and table view
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const questionIdsInput = document.getElementById('question-ids');
    const startFindQuestion = document.getElementById('startFindQuestion');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusResultDiv = document.getElementById('statusResult');
    const messageP = document.getElementById('message');
    const detailedResultsDiv = document.getElementById('detailedResults');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsSummary = document.getElementById('resultsSummary');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    let currentUid = '';
    let currentToken = '';

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
        chrome.storage.local.get(['questionIdsInput'], (data) => {
            if (data.questionIdsInput) questionIdsInput.value = data.questionIdsInput;
        });
    });

    // Update progress
    function updateProgress(current, total) {
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Đang xử lý: ${current}/${total}`;
    }

    // Add row to results table
    function addResultRow(index, questionId, result) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        const isSuccess = result && result.success;
        const statusClass = isSuccess ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
        const statusText = isSuccess ? '✓ Tìm thấy' : '✗ Không tìm thấy';

        let bankName = 'N/A';
        let bankUrl = '#';

        if (isSuccess) {
            bankName = result.success.bank_name || 'N/A';
            bankUrl = result.success.url || '#';
        }

        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-600">${index}</td>
            <td class="px-4 py-3 text-sm font-mono font-semibold text-blue-600">${questionId}</td>
            <td class="px-4 py-3 text-sm ${statusClass}">${statusText}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${bankName}</td>
            <td class="px-4 py-3 text-sm">
                ${isSuccess
                ? `<a href="${bankUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline break-all">${bankUrl}</a>`
                : '<span class="text-gray-400">-</span>'
            }
            </td>
        `;

        resultsTableBody.appendChild(row);
    }

    // Handle find question button click
    startFindQuestion.addEventListener('click', async () => {
        // Reset UI
        SharedUI.resetUI({
            messageP,
            statusResultDiv,
            detailedResultsDiv
        });
        resultsTableBody.innerHTML = '';
        progressContainer.classList.add('hidden');

        const questionIds = SharedUI.parseMultilineInput(questionIdsInput.value);

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            return;
        }

        // Validate input
        if (questionIds.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng điền ít nhất một ID câu hỏi.", 'error');
            return;
        }

        // Save input
        chrome.storage.local.set({ questionIdsInput: questionIdsInput.value });

        // Start processing
        SharedUI.setProcessing(startFindQuestion, buttonText, loadingSpinner, true, 'Tìm câu hỏi');
        SharedUI.showMessage(statusResultDiv, messageP,
            `Đang tìm kiếm ${questionIds.length} câu hỏi...`, 'info');

        // Show progress
        progressContainer.classList.remove('hidden');
        updateProgress(0, questionIds.length);

        // Show results table
        detailedResultsDiv.classList.remove('hidden');

        // Process questions one by one
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < questionIds.length; i++) {
            const questionId = questionIds[i];
            updateProgress(i + 1, questionIds.length);

            try {
                // Send message to background for each question
                const result = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: "findQuestion",
                        uid: currentUid,
                        token: currentToken,
                        questionId: questionId,
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error:", chrome.runtime.lastError.message);
                            resolve({ success: false, questionId });
                        } else if (response && response.status === "completed" && response.results.length > 0) {
                            resolve(response.results[0]);
                        } else {
                            resolve({ success: false, questionId });
                        }
                    });
                });

                // Add result to table
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }

                addResultRow(i + 1, questionId, result);

            } catch (error) {
                console.error(`Error processing question ${questionId}:`, error);
                failCount++;
                addResultRow(i + 1, questionId, { success: false });
            }
        }

        // Update summary
        resultsSummary.textContent = `Tổng: ${questionIds.length} | Tìm thấy: ${successCount} | Không tìm thấy: ${failCount}`;

        // Hide progress, show completion message
        progressContainer.classList.add('hidden');
        SharedUI.showMessage(statusResultDiv, messageP,
            `Hoàn tất! Tìm thấy ${successCount}/${questionIds.length} câu hỏi.`,
            successCount > 0 ? 'success' : 'error');

        SharedUI.setProcessing(startFindQuestion, buttonText, loadingSpinner, false, 'Tìm câu hỏi');
    });
});