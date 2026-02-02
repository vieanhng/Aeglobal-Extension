// options.js
document.addEventListener('DOMContentLoaded', () => {
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const questionIdInput = document.getElementById('question-id');
    const startFindQuestion = document.getElementById('startFindQuestion');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusResultDiv = document.getElementById('statusResult');
    const messageP = document.getElementById('message');
    const detailedResultsDiv = document.getElementById('detailedResults');
    const resultsList = document.getElementById('resultsList');

    let currentUid = '';
    let currentToken = '';
    let currentSavedDate = '';

    // Tải UID và Token đã lưu từ storage khi trang được tải
    chrome.storage.local.get(['uid', 'token','savedDate', 'questionIdsInput', 'bankIid'], (data) => {
        if (data.uid) {
            currentUid = data.uid;
            displayUid.textContent = data.uid;
        } else {
            displayUid.textContent = 'Chưa có';
            displayUid.classList.add('text-red-500');
        }
        if (data.token) {
            currentToken = data.token;
            displayToken.textContent = data.token;
        } else {
            displayToken.textContent = 'Chưa có';
            displayToken.classList.add('text-red-500');
        }
        if (data.savedDate) {
            currentSavedDate = data.savedDate;
            displaySavedDate.textContent = new Date(data.savedDate).toLocaleString();;
        } else {
            displaySavedDate.textContent = 'Chưa có';
            displaySavedDate.classList.add('text-red-500');
        }
        if (data.questionIdInput) questionIdInput.value = data.questionIdInput;
    });

    startFindQuestion.addEventListener('click', async () => {
        // Reset trạng thái hiển thị
        messageP.innerHTML = '';
        statusResultDiv.classList.add('hidden');
        resultsList.innerHTML = '';
        detailedResultsDiv.classList.add('hidden');
        statusResultDiv.className = 'mt-4 p-4 rounded-md hidden'; // Reset classes

        const questionId = questionIdInput.value.trim();

        if (!currentUid || !currentToken) {
            showMessage("Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.", 'error');
            return;
        }

        if (questionId.length === 0) {
            showMessage("Vui lòng điền ID câu hỏi.", 'error');
            return;
        }

        // Lưu dữ liệu người dùng nhập vào storage
        chrome.storage.local.set({
            questionIdInput: questionIdInput.value
        });

        // Bật trạng thái xử lý
        setProcessing(true);
        showMessage("Đang xử lý tìm kiếm câu hỏi...", 'info');

        try {
            // Gửi thông điệp tới background script
            chrome.runtime.sendMessage({
                action: "findQuestion",
                uid: currentUid,
                token: currentToken,
                questionId: questionId,
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Lỗi khi gửi thông điệp:", chrome.runtime.lastError.message);
                    showMessage(`Lỗi: ${chrome.runtime.lastError.message}. Vui lòng kiểm tra console để biết thêm chi tiết.`, 'error');
                    setProcessing(false);
                    return;
                }

                if (response && response.status === "completed") {
                    showMessage('Hoàn tất quá trình tìm kiếm!', 'success');
                    displayResults(response.results);
                } else {
                    showMessage('Có lỗi xảy ra trong quá trình xử lý.', 'error');
                }
                setProcessing(false);
            });
        } catch (error) {
            console.error("Lỗi không xác định:", error);
            showMessage(`Lỗi không xác định: ${error.message}`, 'error');
            setProcessing(false);
        }
    });

    function setProcessing(isProcessing) {
        startFindQuestion.disabled = isProcessing;
        if (isProcessing) {
            buttonText.textContent = "Đang xử lý...";
            loadingSpinner.classList.remove('hidden');
        } else {
            buttonText.textContent = "Tìm câu hỏi";
            loadingSpinner.classList.add('hidden');
        }
    }

    function showMessage(msg, type) {
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
    }

    function displayResults(results) {
        resultsList.innerHTML = '';
        if (results.length > 0) {
            detailedResultsDiv.classList.remove('hidden');

            results.forEach(result => {
                const li = document.createElement('li');
                li.className = result.success ? 'text-green-700' : 'text-red-700';

                if (result.success) {
                    const { bank_name, url } = result.success;
                    li.innerHTML = `NHCH: ${bank_name}<br>Link: <i><a href="${url}" target="_blank">${url}</a></i>`;
                } else {
                    // Directly set the innerHTML for this 'li'
                    li.textContent = `Thất bại${result.message ? ': ' + result.message : ''}`;
                }

                resultsList.appendChild(li);
            });
        }
    }
});