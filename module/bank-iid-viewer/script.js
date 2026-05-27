// Bank IID Viewer — Tra cứu IID thực từ link ngân hàng
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');
    const bankLinksInput = document.getElementById('bank-links');
    const startLookupBtn = document.getElementById('startLookup');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusResultDiv = document.getElementById('statusResult');
    const messageP = document.getElementById('message');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsSummary = document.getElementById('resultsSummary');
    const copyAllBtn = document.getElementById('copyAllBtn');

    let currentUid = '';
    let currentToken = '';
    let allResolvedIids = []; // Danh sách IID đã resolve để copy tất cả

    // Load auth data
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Khôi phục input đã lưu
        chrome.storage.local.get(['bankIidViewerInput'], (data) => {
            if (data.bankIidViewerInput) bankLinksInput.value = data.bankIidViewerInput;
        });
    });

    // Cập nhật progress bar
    function updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Đang xử lý: ${current}/${total}`;
    }

    // Thêm một hàng vào bảng kết quả
    function appendResultRow(index, originalInput, bankName, bankIid, success, errorMsg) {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        const statusCell = success
            ? `<td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Thành công
                </span>
               </td>`
            : `<td class="px-4 py-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    ✗ ${errorMsg || 'Lỗi'}
                </span>
               </td>`;

        const iidCell = success
            ? `<td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center space-x-2">
                    <code class="text-sm font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">${bankIid}</code>
                    <button class="copy-iid-btn text-gray-400 hover:text-indigo-600 transition" title="Copy IID" data-iid="${bankIid}">
                        📋
                    </button>
                </div>
               </td>`
            : `<td class="px-4 py-3 text-sm text-gray-400">—</td>`;

        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${index}</td>
            <td class="px-4 py-3 text-sm text-gray-700 break-all max-w-xs">
                <span class="font-mono text-xs">${originalInput}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${success ? bankName : '<span class="text-gray-400">—</span>'}</td>
            ${iidCell}
            ${statusCell}
        `;

        // Gắn sự kiện copy cho nút copy IID trong từng hàng
        resultsTableBody.appendChild(tr);

        const copyBtn = tr.querySelector('.copy-iid-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const iid = copyBtn.dataset.iid;
                navigator.clipboard.writeText(iid).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
                });
            });
        }
    }

    // Nút tra cứu chính
    startLookupBtn.addEventListener('click', async () => {
        // Reset UI
        SharedUI.resetUI({
            messageP,
            statusResultDiv,
            detailedResultsDiv: resultsSection
        });
        resultsTableBody.innerHTML = '';
        progressContainer.classList.add('hidden');
        copyAllBtn.classList.add('hidden');
        allResolvedIids = [];

        const bankInputs = SharedUI.parseMultilineInput(bankLinksInput.value);

        // Kiểm tra auth
        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng nhập UID và Token từ trang Popup trước khi thực hiện.', 'error');
            return;
        }

        // Kiểm tra input
        if (bankInputs.length === 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                'Vui lòng nhập ít nhất một link ngân hàng.', 'error');
            return;
        }

        // Lưu input
        chrome.storage.local.set({ bankIidViewerInput: bankLinksInput.value });

        // Bắt đầu xử lý
        SharedUI.setProcessing(startLookupBtn, buttonText, loadingSpinner, true, 'Tra cứu IID');
        SharedUI.showMessage(statusResultDiv, messageP,
            `Đang tra cứu IID cho ${bankInputs.length} ngân hàng...`, 'info');

        progressContainer.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
        updateProgress(0, bankInputs.length);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < bankInputs.length; i++) {
            const input = bankInputs[i];
            updateProgress(i + 1, bankInputs.length);

            try {
                const result = await SharedBankUtils.processBankLink(input, currentUid, currentToken);

                if (result.success) {
                    appendResultRow(i + 1, input, result.name, result.id, true, null);
                    allResolvedIids.push(result.id);
                    successCount++;
                } else {
                    appendResultRow(i + 1, input, null, null, false, result.error || 'Không resolve được');
                    failCount++;
                }
            } catch (err) {
                appendResultRow(i + 1, input, null, null, false, 'Lỗi không xác định');
                failCount++;
            }
        }

        // Tổng kết
        progressContainer.classList.add('hidden');
        resultsSummary.textContent = `Thành công: ${successCount} | Thất bại: ${failCount} / Tổng: ${bankInputs.length}`;

        if (successCount > 0) {
            SharedUI.showMessage(statusResultDiv, messageP,
                `✓ Hoàn tất! Đã tra cứu thành công ${successCount}/${bankInputs.length} ngân hàng.`, 'success');
            copyAllBtn.classList.remove('hidden');
        } else {
            SharedUI.showMessage(statusResultDiv, messageP,
                '✗ Không tra cứu được IID cho bất kỳ ngân hàng nào.', 'error');
        }

        SharedUI.setProcessing(startLookupBtn, buttonText, loadingSpinner, false, 'Tra cứu IID');
    });

    // Nút copy tất cả IID
    copyAllBtn.addEventListener('click', () => {
        const text = allResolvedIids.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const original = copyAllBtn.textContent;
            copyAllBtn.textContent = '✓ Đã copy!';
            copyAllBtn.className = 'px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded';
            setTimeout(() => {
                copyAllBtn.textContent = original;
                copyAllBtn.className = 'px-3 py-1 bg-indigo-500 text-white text-sm font-semibold rounded hover:bg-indigo-600 transition';
            }, 2000);
        });
    });
});
