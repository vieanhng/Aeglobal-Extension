// Question Move - Enhanced with batch processing and table view
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const questionIdsInput = document.getElementById('question-ids');
    const bankIid = document.getElementById('bankIid');
    const startMoveQuestion = document.getElementById('startMoveQuestion');
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

    // Validation elements
    const validateBankBtn = document.getElementById('validateBankBtn');
    const validateBtnText = document.getElementById('validateBtnText');
    const validateSpinner = document.getElementById('validateSpinner');
    const validationResult = document.getElementById('validationResult');
    const validationIcon = document.getElementById('validationIcon');
    const validationContent = document.getElementById('validationContent');

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

        // Load saved inputs
        chrome.storage.local.get(['questionIdsInput', 'bankIid'], (data) => {
            if (data.questionIdsInput) questionIdsInput.value = data.questionIdsInput;
            if (data.bankIid) bankIid.value = data.bankIid;
        });
    });

    // Update progress
    function updateProgress(current, total) {
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Đang xử lý: ${current}/${total}`;
    }

    // Add row to results table
    function addResultRow(index, questionId, bankIid, success, message = '') {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        const statusClass = success ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
        const statusText = success ? '✓ Thành công' : '✗ Thất bại';

        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-600">${index}</td>
            <td class="px-4 py-3 text-sm font-mono font-semibold text-blue-600">${questionId}</td>
            <td class="px-4 py-3 text-sm ${statusClass}">${statusText}</td>
            <td class="px-4 py-3 text-sm font-mono text-gray-800">${bankIid}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${message || (success ? 'Đã di chuyển thành công' : 'Không thể di chuyển')}</td>
        `;

        resultsTableBody.appendChild(row);
    }

    // Validate bank button
    validateBankBtn.addEventListener('click', async () => {
        const bankInput = bankIid.value.trim();

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            return;
        }

        // Validate input
        if (bankInput.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng điền link ngân hàng.", 'error');
            return;
        }

        // Start validation
        validateSpinner.classList.remove('hidden');
        validateBtnText.textContent = 'Đang validate...';
        validateBankBtn.disabled = true;
        validationResult.classList.remove('hidden');

        // Show loading state
        validationIcon.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
        validationContent.innerHTML = `
            <div class="font-mono text-gray-700 break-all">${bankInput}</div>
            <div class="text-gray-500 mt-1">Đang kiểm tra...</div>
        `;

        // Validate the bank link
        const result = await SharedBankUtils.processBankLink(bankInput, currentUid, currentToken);

        // Update with result
        if (result.success) {
            validationIcon.innerHTML = `<span class="text-green-500 text-lg">✓</span>`;
            validationContent.innerHTML = `
                <div class="font-mono text-gray-700 break-all">${bankInput}</div>
                <div class="text-green-600 mt-1 font-semibold">✓ Hợp lệ - ${result.name}</div>
                <div class="text-gray-500 text-xs mt-0.5">IID: ${result.id}</div>
            `;
            validationResult.querySelector('div > div').className = 'bg-green-50 border border-green-200 rounded-lg p-3';
            SharedUI.showMessage(statusResultDiv, messageP,
                `✓ Link ngân hàng hợp lệ! ${result.name} (IID: ${result.id})`, 'success');
        } else {
            validationIcon.innerHTML = `<span class="text-red-500 text-lg">✗</span>`;
            validationContent.innerHTML = `
                <div class="font-mono text-gray-700 break-all">${bankInput}</div>
                <div class="text-red-600 mt-1 font-semibold">✗ Lỗi: ${result.error}</div>
            `;
            validationResult.querySelector('div > div').className = 'bg-red-50 border border-red-200 rounded-lg p-3';
            SharedUI.showMessage(statusResultDiv, messageP,
                `✗ Link ngân hàng không hợp lệ: ${result.error}`, 'error');
        }

        // Reset button
        validateSpinner.classList.add('hidden');
        validateBtnText.textContent = '✓ Validate ngân hàng';
        validateBankBtn.disabled = false;
    });

    // Handle move question button click
    startMoveQuestion.addEventListener('click', async () => {
        // Reset UI
        SharedUI.resetUI({
            messageP,
            statusResultDiv,
            detailedResultsDiv
        });
        resultsTableBody.innerHTML = '';
        progressContainer.classList.add('hidden');

        const questionIds = SharedUI.parseMultilineInput(questionIdsInput.value);
        const bankInput = bankIid.value.trim();

        // Validate auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            return;
        }

        // Validate inputs
        if (questionIds.length === 0 || bankInput.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                "Vui lòng điền đầy đủ danh sách ID câu hỏi và ngân hàng.", 'error');
            return;
        }

        // Save inputs
        chrome.storage.local.set({
            questionIdsInput: questionIdsInput.value,
            bankIid: bankInput
        });

        // Start processing
        SharedUI.setProcessing(startMoveQuestion, buttonText, loadingSpinner, true, 'Di chuyển');
        SharedUI.showMessage(statusResultDiv, messageP, 'Đang xử lý link ngân hàng...', 'info');

        // Process bank link to get actual IID
        const bankResult = await SharedBankUtils.processBankLink(bankInput, currentUid, currentToken);

        if (!bankResult.success) {
            SharedUI.showMessage(statusResultDiv, messageP,
                `Lỗi: Không thể xử lý link ngân hàng "${bankInput}". ${bankResult.error}`, 'error');
            SharedUI.setProcessing(startMoveQuestion, buttonText, loadingSpinner, false, 'Di chuyển');
            return;
        }

        const destination_bank = bankResult.id;

        SharedUI.showMessage(statusResultDiv, messageP,
            `Đang di chuyển ${questionIds.length} câu hỏi đến ngân hàng ${destination_bank}...`, 'info');

        // Show progress
        progressContainer.classList.remove('hidden');
        updateProgress(0, questionIds.length);

        // Show results table
        detailedResultsDiv.classList.remove('hidden');

        // Send all questions at once to background
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: "moveQuestions",
                    uid: currentUid,
                    token: currentToken,
                    questionIds: questionIds,
                    bankIid: destination_bank  // Use resolved IID
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error:", chrome.runtime.lastError.message);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                });
            });

            // Update progress to 100%
            updateProgress(questionIds.length, questionIds.length);

            // Display results
            if (response && response.status === "completed" && response.results) {
                const result = response.results[0]; // Get the first (and only) result

                if (result.success) {
                    // All questions moved successfully
                    questionIds.forEach((qid, index) => {
                        addResultRow(index + 1, qid, destination_bank, true);
                    });

                    resultsSummary.textContent = `Tổng: ${questionIds.length} | Thành công: ${questionIds.length} | Thất bại: 0`;
                    SharedUI.showMessage(statusResultDiv, messageP,
                        `Hoàn tất! Đã di chuyển thành công ${questionIds.length} câu hỏi.`, 'success');
                } else {
                    // All questions failed
                    questionIds.forEach((qid, index) => {
                        addResultRow(index + 1, qid, destination_bank, false, result.message || 'Lỗi không xác định');
                    });

                    resultsSummary.textContent = `Tổng: ${questionIds.length} | Thành công: 0 | Thất bại: ${questionIds.length}`;
                    SharedUI.showMessage(statusResultDiv, messageP,
                        `Thất bại! Không thể di chuyển câu hỏi. ${result.message || ''}`, 'error');
                }
            } else {
                // Unknown error
                questionIds.forEach((qid, index) => {
                    addResultRow(index + 1, qid, destination_bank, false, 'Lỗi không xác định');
                });

                resultsSummary.textContent = `Tổng: ${questionIds.length} | Thành công: 0 | Thất bại: ${questionIds.length}`;
                SharedUI.showMessage(statusResultDiv, messageP, 'Có lỗi xảy ra trong quá trình xử lý.', 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            questionIds.forEach((qid, index) => {
                addResultRow(index + 1, qid, destination_bank, false, error.message);
            });

            resultsSummary.textContent = `Tổng: ${questionIds.length} | Thành công: 0 | Thất bại: ${questionIds.length}`;
            SharedUI.showMessage(statusResultDiv, messageP, `Lỗi: ${error.message}`, 'error');
        }

        // Hide progress
        progressContainer.classList.add('hidden');
        SharedUI.setProcessing(startMoveQuestion, buttonText, loadingSpinner, false, 'Di chuyển');
    });
});