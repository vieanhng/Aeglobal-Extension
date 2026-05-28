// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // Các phần tử HTML liên quan đến thông tin xác thực
    const authInfoSection = document.getElementById('authInfoSection');
    const savedInfoDisplay = document.getElementById('savedInfoDisplay');
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const savedDate = document.getElementById('savedDate');
    const updateAuthInfoBtn = document.getElementById('updateAuthInfoBtn');
    const clearAuthInfoBtn = document.getElementById('clearAuthInfoBtn');

    const loginPromptSection = document.getElementById('loginPromptSection');
    const getAuthInfoBtn = document.getElementById('getAuthInfoBtn');
    const statusMessage = document.getElementById('statusMessage');

    // Các nút chức năng

    // const openAnotherFeatureBtn = document.getElementById('openAnotherFeature'); // Cho chức năng mở rộng sau này


    // Hàm để cố gắng lấy token và iid từ localStorage của trang đích
    async function getAuthDataFromTargetSite() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab && (activeTab.url.startsWith("https://aeglobal.lotuslms.com/") || activeTab.url.startsWith("https://aeglobal2.lotuslms.com/"))) {
                    chrome.scripting.executeScript(
                        {
                            target: { tabId: activeTab.id },
                            function: () => {
                                try {
                                    const persistRoot = window.localStorage.getItem("persist:root");
                                    if (persistRoot) {
                                        const parsedPersistRoot = JSON.parse(persistRoot);
                                        const userString = parsedPersistRoot.user;
                                        if (userString) {
                                            const user = JSON.parse(userString);
                                            const token = user?.info?.token;
                                            const iid = user?.info?.iid; // Lấy iid (UID)
                                            return { token, iid };
                                        }
                                    }
                                } catch (e) {
                                    console.error("Lỗi khi đọc localStorage từ trang web:", e);
                                }
                                return null;
                            }
                        },
                        (results) => {
                            if (results && results[0] && results[0].result) {
                                resolve(results[0].result);
                            } else {
                                resolve(null);
                            }
                        }
                    );
                } else {
                    // Nếu không ở đúng trang đích, không thể tự động lấy
                    resolve(null);
                }
            });
        });
    }

    // Hàm hiển thị phần thông tin đã lưu
    function showSavedAuthInfo(uid, token, date) {
        displayUid.textContent = uid;
        displayToken.textContent = token;
        savedDate.textContent = new Date(date).toLocaleString();
        savedInfoDisplay.classList.remove('hidden');
        loginPromptSection.classList.add('hidden');
        statusMessage.textContent = "";
    }

    // Hàm hiển thị phần lời nhắc đăng nhập/lấy thông tin mới
    function showLoginPrompt() {
        savedInfoDisplay.classList.add('hidden');
        loginPromptSection.classList.remove('hidden');
        statusMessage.textContent = "";
    }

    // Hàm tải và hiển thị trạng thái ban đầu
    async function loadAndDisplayAuthState() {
        const data = await chrome.storage.local.get(['uid', 'token', 'savedDate']);
        if (data.uid && data.token && data.savedDate) {
            showSavedAuthInfo(data.uid, data.token, data.savedDate);
        } else {
            showLoginPrompt();
        }
    }

    // Hàm tự động lấy auth khi mở popup
    async function autoFetchAuthOnOpen() {
        // Kiểm tra xem có đang ở trang LotusLMS không
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (activeTab && (activeTab.url.startsWith("https://aeglobal.lotuslms.com/") ||
            activeTab.url.startsWith("https://aeglobal2.lotuslms.com/"))) {

            // Hiển thị thông báo đang tự động lấy
            statusMessage.textContent = "🔄 Đang tự động lấy thông tin xác thực...";
            statusMessage.className = "mt-3 text-sm text-center text-blue-600";

            const authData = await getAuthDataFromTargetSite();

            if (authData && authData.token && authData.iid) {
                const currentTimestamp = Date.now();

                // Kiểm tra xem có cần cập nhật không (so sánh với dữ liệu hiện tại)
                const existingData = await chrome.storage.local.get(['uid', 'token']);
                const needsUpdate = !existingData.uid || !existingData.token ||
                    existingData.uid !== authData.iid ||
                    existingData.token !== authData.token;

                if (needsUpdate) {
                    // Lưu thông tin mới
                    chrome.runtime.sendMessage({
                        action: "setAuthData",
                        uid: authData.iid,
                        token: authData.token,
                        savedDate: currentTimestamp
                    }, (response) => {
                        if (response && response.status === "success") {
                            statusMessage.textContent = "✅ Đã tự động cập nhật thông tin xác thực!";
                            statusMessage.className = "mt-3 text-sm text-center text-green-600";
                            showSavedAuthInfo(authData.iid, authData.token, currentTimestamp);

                            // Ẩn thông báo sau 3 giây
                            setTimeout(() => {
                                statusMessage.textContent = "";
                            }, 3000);
                        }
                    });
                } else {
                    // Thông tin đã cập nhật, chỉ cần ẩn thông báo
                    statusMessage.textContent = "";
                }
            } else {
                // Không lấy được auth, ẩn thông báo
                statusMessage.textContent = "";
            }
        }
    }

    // Khởi tạo trạng thái khi popup mở
    loadAndDisplayAuthState();

    // Event Listeners cho phần thông tin xác thực
    chrome.storage.local.get(['uid', 'token', 'savedDate'], async (data) => {
        const { uid, token, savedDate } = data;
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000; // Một ngày tính bằng milliseconds

        if (savedDate) {
            const storedDate = new Date(savedDate);
            if (now.getTime() - storedDate.getTime() > oneDay) {
                // Nếu dữ liệu đã cũ hơn một ngày, xóa nó
                console.log("Dữ liệu xác thực đã quá một ngày. Đang xóa...");
                chrome.storage.local.remove(['uid', 'token', 'savedDate'], () => {
                    showLoginPrompt();
                    statusMessage.textContent = "Thông tin xác thực đã hết hạn (quá 1 ngày) và đã được xóa. Vui lòng cập nhật lại.";
                    statusMessage.className = "mt-3 text-sm text-center text-orange-600";

                    // Thử tự động lấy lại auth
                    autoFetchAuthOnOpen();
                });
                return; // Dừng lại không hiển thị dữ liệu cũ
            }
        }

        if (uid && token) {
            showSavedAuthInfo(uid, token, savedDate);
            // Tự động cập nhật auth nếu đang ở trang LotusLMS
            autoFetchAuthOnOpen();
        } else {
            showLoginPrompt();
            // Thử tự động lấy auth nếu chưa có
            autoFetchAuthOnOpen();
        }
    });

    // Nút "Lấy thông tin từ trang web"
    getAuthInfoBtn.addEventListener('click', async () => {
        statusMessage.textContent = "Đang cố gắng lấy thông tin từ trang web...";
        statusMessage.className = "mt-3 text-sm text-center text-blue-600";
        const authData = await getAuthDataFromTargetSite();
        if (authData && authData.token && authData.iid) {
            const currentTimestamp = Date.now();
            // Gửi UID, Token và thời gian lưu đến background script để lưu
            chrome.runtime.sendMessage({ action: "setAuthData", uid: authData.iid, token: authData.token, savedDate: currentTimestamp }, (response) => {
                if (response && response.status === "success") {
                    statusMessage.textContent = "Đã lấy và lưu thông tin thành công!";
                    statusMessage.className = "mt-3 text-sm text-center text-green-600";
                    showSavedAuthInfo(authData.iid, authData.token, currentTimestamp);
                } else {
                    statusMessage.textContent = "Lỗi khi lưu thông tin.";
                    statusMessage.className = "mt-3 text-sm text-center text-red-600";
                }
            });
        } else {
            statusMessage.textContent = "Không thể tự động lấy thông tin. Vui lòng đảm bảo bạn đang ở trang lotuslms và đã đăng nhập.";
            statusMessage.className = "mt-3 text-sm text-center text-orange-600";
        }
    });

    // Nút "Cập nhật" (cho phép cập nhật thủ công nếu cần)
    updateAuthInfoBtn.addEventListener('click', async () => {
        statusMessage.textContent = "Đang cố gắng cập nhật thông tin từ trang web...";
        statusMessage.className = "mt-3 text-sm text-center text-blue-600";
        const authData = await getAuthDataFromTargetSite();
        if (authData && authData.token && authData.iid) {
            const currentTimestamp = Date.now();
            chrome.runtime.sendMessage({ action: "setAuthData", uid: authData.iid, token: authData.token, savedDate: currentTimestamp }, (response) => {
                if (response && response.status === "success") {
                    statusMessage.textContent = "Thông tin đã được cập nhật!";
                    statusMessage.className = "mt-3 text-sm text-center text-green-600";
                    showSavedAuthInfo(authData.iid, authData.token, currentTimestamp);
                } else {
                    statusMessage.textContent = "Lỗi khi cập nhật thông tin.";
                    statusMessage.className = "mt-3 text-sm text-center text-red-600";
                }
            });
        } else {
            statusMessage.textContent = "Không thể cập nhật. Vui lòng đảm bảo bạn đang ở trang lotuslms và đã đăng nhập.";
            statusMessage.className = "mt-3 text-sm text-center text-orange-600";
        }
    });

    // Nút "Xóa"
    clearAuthInfoBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['uid', 'token', 'savedDate'], () => {
            statusMessage.textContent = "Thông tin đã được xóa.";
            statusMessage.className = "mt-3 text-sm text-center text-blue-600";
            showLoginPrompt();
        });
    });

    // Xem câu hỏi trong phiếu"
    const openSidePanelBtn = document.getElementById('openSidePanel');
    openSidePanelBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.sidePanel.open({ tabId: tabs[0].id });
                window.close();
            }
        });
    });

    // Event Listeners cho các nút chức năng chính
    const openQuestionDuplicatorBtn = document.getElementById('openQuestionDuplicator');
    openQuestionDuplicatorBtn.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('module/question-duplicator/index.html'));
    });

    const openQuestionMover = document.getElementById('openQuestionMover');
    openQuestionMover.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('module/question-move/index.html'));
    });

    const openQuestionFinder = document.getElementById('openQuestionFinder');
    openQuestionFinder.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('module/question-finder/index.html'));
    });

    const openQuestionExporter = document.getElementById('openQuestionExporter');
    openQuestionExporter.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('module/question-exporter/index.html'));
    });

    const openBankIidViewer = document.getElementById('openBankIidViewer');
    openBankIidViewer.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('module/bank-iid-viewer/index.html'));
    });

    // ── Cài đặt: Toggle hiển thị IID ngân hàng trên trang ────────
    const toggleBankIidOverlay = document.getElementById('toggleBankIidOverlay');

    // Đọc giá trị hiện tại từ storage (mặc định: bật)
    chrome.storage.local.get({ showBankIidOverlay: true }, (data) => {
        toggleBankIidOverlay.checked = data.showBankIidOverlay;
    });

    // Lưu khi thay đổi
    toggleBankIidOverlay.addEventListener('change', () => {
        chrome.storage.local.set({ showBankIidOverlay: toggleBankIidOverlay.checked });
    });

    // Thêm event listener cho các chức năng mở rộng khác tại đây sau này
    // if (openAnotherFeatureBtn) {
    //     openAnotherFeatureBtn.addEventListener('click', () => {
    //         // Ví dụ: mở một trang HTML khác hoặc thực hiện một hành động khác
    //         // window.open(chrome.runtime.getURL('another_feature.html'));
    //         alert('Chức năng này đang được phát triển!');
    //     });
    // }
});