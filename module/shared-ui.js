// Shared UI Functions
const SharedUI = {
    // Show/hide loading state on button
    setProcessing: function (button, buttonText, loadingSpinner, isProcessing, originalText = 'Xử lý') {
        button.disabled = isProcessing;
        if (isProcessing) {
            buttonText.textContent = "Đang xử lý...";
            loadingSpinner.classList.remove('hidden');
        } else {
            buttonText.textContent = originalText;
            loadingSpinner.classList.add('hidden');
        }
    },

    // Show status message with color coding
    showMessage: function (statusResultDiv, messageP, msg, type) {
        messageP.textContent = msg;
        statusResultDiv.classList.remove('hidden');
        statusResultDiv.classList.remove('bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-blue-100', 'text-blue-800');

        if (type === 'success') {
            statusResultDiv.classList.add('bg-green-100', 'text-green-800');
        } else if (type === 'error') {
            statusResultDiv.classList.add('bg-red-100', 'text-red-800');
        } else if (type === 'info') {
            statusResultDiv.classList.add('bg-blue-100', 'text-blue-800');
        }
    },

    // Reset UI state
    resetUI: function (elements) {
        const { messageP, statusResultDiv, resultsList, detailedResultsDiv } = elements;

        if (messageP) messageP.textContent = '';
        if (statusResultDiv) {
            statusResultDiv.classList.add('hidden');
            statusResultDiv.className = 'mt-4 p-4 rounded-md hidden';
        }
        if (resultsList) resultsList.innerHTML = '';
        if (detailedResultsDiv) detailedResultsDiv.classList.add('hidden');
    },

    // Parse input values (split by newline, trim, filter empty)
    parseMultilineInput: function (value) {
        return value.split('\n').map(item => item.trim()).filter(item => item);
    },

    // Send message to background script
    sendBackgroundMessage: function (message, onSuccess, onError) {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Lỗi khi gửi thông điệp:", chrome.runtime.lastError.message);
                if (onError) onError(chrome.runtime.lastError.message);
                return;
            }

            if (response && response.status === "completed") {
                if (onSuccess) onSuccess(response);
            } else {
                if (onError) onError('Có lỗi xảy ra trong quá trình xử lý.');
            }
        });
    }
};
