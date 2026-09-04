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

    const authSummaryRow = document.getElementById('authSummaryRow');
    const authDetailsContainer = document.getElementById('authDetailsContainer');
    const authToggleIcon = document.getElementById('authToggleIcon');
    const toggleAuthDetailBtn = document.getElementById('toggleAuthDetailBtn');

    const loginPromptSection = document.getElementById('loginPromptSection');
    const getAuthInfoBtn = document.getElementById('getAuthInfoBtn');
    const statusMessage = document.getElementById('statusMessage');

    const displayUidDetail = document.getElementById('displayUidDetail');
    const copyUidCompactBtn = document.getElementById('copyUidCompactBtn');
    const copyUidBtn = document.getElementById('copyUidBtn');
    const copyTokenBtn = document.getElementById('copyTokenBtn');

    // Toggle expand/collapse chi tiết auth
    function toggleAuthDetails() {
        if (!authDetailsContainer) return;
        const isHidden = authDetailsContainer.classList.contains('hidden');
        if (isHidden) {
            authDetailsContainer.classList.remove('hidden');
            if (authToggleIcon) authToggleIcon.textContent = '▴';
        } else {
            authDetailsContainer.classList.add('hidden');
            if (authToggleIcon) authToggleIcon.textContent = '▾';
        }
    }

    if (authSummaryRow) {
        authSummaryRow.addEventListener('click', toggleAuthDetails);
    }
    if (toggleAuthDetailBtn) {
        toggleAuthDetailBtn.addEventListener('click', toggleAuthDetails);
    }

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
                    resolve(null);
                }
            });
        });
    }

    // Hàm hiển thị phần thông tin đã lưu
    function showSavedAuthInfo(uid, token, date) {
        displayUid.textContent = uid;
        if (displayUidDetail) displayUidDetail.textContent = uid;
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
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (activeTab && (activeTab.url.startsWith("https://aeglobal.lotuslms.com/") ||
            activeTab.url.startsWith("https://aeglobal2.lotuslms.com/"))) {

            statusMessage.textContent = "🔄 Đang tự động lấy thông tin xác thực...";
            statusMessage.className = "mt-1.5 text-xs text-center text-blue-600";

            const authData = await getAuthDataFromTargetSite();

            if (authData && authData.token && authData.iid) {
                const currentTimestamp = Date.now();

                const existingData = await chrome.storage.local.get(['uid', 'token']);
                const needsUpdate = !existingData.uid || !existingData.token ||
                    existingData.uid !== authData.iid ||
                    existingData.token !== authData.token;

                if (needsUpdate) {
                    chrome.runtime.sendMessage({
                        action: "setAuthData",
                        uid: authData.iid,
                        token: authData.token,
                        savedDate: currentTimestamp
                    }, (response) => {
                        if (response && response.status === "success") {
                            statusMessage.textContent = "✅ Đã tự động cập nhật thông tin!";
                            statusMessage.className = "mt-1.5 text-xs text-center text-green-600";
                            showSavedAuthInfo(authData.iid, authData.token, currentTimestamp);

                            setTimeout(() => {
                                statusMessage.textContent = "";
                            }, 2500);
                        }
                    });
                } else {
                    statusMessage.textContent = "";
                }
            } else {
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
        const oneDay = 24 * 60 * 60 * 1000;

        if (savedDate) {
            const storedDate = new Date(savedDate);
            if (now.getTime() - storedDate.getTime() > oneDay) {
                chrome.storage.local.remove(['uid', 'token', 'savedDate'], () => {
                    showLoginPrompt();
                    statusMessage.textContent = "Thông tin xác thực đã hết hạn (quá 1 ngày). Vui lòng lấy lại.";
                    statusMessage.className = "mt-1.5 text-xs text-center text-orange-600";
                    autoFetchAuthOnOpen();
                });
                return;
            }
        }

        if (uid && token) {
            showSavedAuthInfo(uid, token, savedDate);
            autoFetchAuthOnOpen();
        } else {
            showLoginPrompt();
            autoFetchAuthOnOpen();
        }
    });

    // Nút "Lấy thông tin từ trang web"
    getAuthInfoBtn.addEventListener('click', async () => {
        statusMessage.textContent = "Đang lấy thông tin từ LotusLMS...";
        statusMessage.className = "mt-1.5 text-xs text-center text-blue-600";
        const authData = await getAuthDataFromTargetSite();
        if (authData && authData.token && authData.iid) {
            const currentTimestamp = Date.now();
            chrome.runtime.sendMessage({ action: "setAuthData", uid: authData.iid, token: authData.token, savedDate: currentTimestamp }, (response) => {
                if (response && response.status === "success") {
                    statusMessage.textContent = "✅ Đã lấy và lưu thông tin thành công!";
                    statusMessage.className = "mt-1.5 text-xs text-center text-green-600";
                    showSavedAuthInfo(authData.iid, authData.token, currentTimestamp);
                    setTimeout(() => { statusMessage.textContent = ""; }, 2500);
                } else {
                    statusMessage.textContent = "❌ Lỗi khi lưu thông tin.";
                    statusMessage.className = "mt-1.5 text-xs text-center text-red-600";
                }
            });
        } else {
            statusMessage.textContent = "Không thể lấy thông tin. Hãy đảm bảo bạn đã mở và đăng nhập LotusLMS.";
            statusMessage.className = "mt-1.5 text-xs text-center text-orange-600";
        }
    });

    // Nút "Cập nhật"
    updateAuthInfoBtn.addEventListener('click', async () => {
        statusMessage.textContent = "Đang cập nhật từ LotusLMS...";
        statusMessage.className = "mt-1.5 text-xs text-center text-blue-600";
        const authData = await getAuthDataFromTargetSite();
        if (authData && authData.token && authData.iid) {
            const currentTimestamp = Date.now();
            chrome.runtime.sendMessage({ action: "setAuthData", uid: authData.iid, token: authData.token, savedDate: currentTimestamp }, (response) => {
                if (response && response.status === "success") {
                    statusMessage.textContent = "✅ Thông tin đã được cập nhật!";
                    statusMessage.className = "mt-1.5 text-xs text-center text-green-600";
                    showSavedAuthInfo(authData.iid, authData.token, currentTimestamp);
                    setTimeout(() => { statusMessage.textContent = ""; }, 2500);
                } else {
                    statusMessage.textContent = "❌ Lỗi khi cập nhật thông tin.";
                    statusMessage.className = "mt-1.5 text-xs text-center text-red-600";
                }
            });
        } else {
            statusMessage.textContent = "Không thể cập nhật. Hãy đảm bảo bạn đã mở và đăng nhập LotusLMS.";
            statusMessage.className = "mt-1.5 text-xs text-center text-orange-600";
        }
    });

    // Nút "Xóa"
    clearAuthInfoBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['uid', 'token', 'savedDate'], () => {
            statusMessage.textContent = "Đã xóa thông tin xác thực.";
            statusMessage.className = "mt-1.5 text-xs text-center text-blue-600";
            showLoginPrompt();
            setTimeout(() => { statusMessage.textContent = ""; }, 2500);
        });
    });

    // ── Hàm sao chép vào Clipboard ──
    function copyToClipboard(text, successMsg, button) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = button ? button.innerHTML : null;
            if (button) {
                button.innerHTML = '✅ Đã copy!';
                setTimeout(() => {
                    if (originalHtml) button.innerHTML = originalHtml;
                }, 1500);
            }
            if (statusMessage) {
                statusMessage.textContent = successMsg;
                statusMessage.className = "mt-1.5 text-xs text-center text-green-600";
                setTimeout(() => {
                    statusMessage.textContent = "";
                }, 2000);
            }
        }).catch(err => {
            console.error('Không thể copy:', err);
        });
    }

    if (copyUidCompactBtn) {
        copyUidCompactBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(displayUid.textContent, '✅ Đã sao chép UID!', copyUidCompactBtn);
        });
    }

    if (copyUidBtn) {
        copyUidBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(displayUid.textContent, '✅ Đã sao chép UID!', copyUidBtn);
        });
    }

    if (copyTokenBtn) {
        copyTokenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(displayToken.textContent, '✅ Đã sao chép Token!', copyTokenBtn);
        });
    }

    // ── Nút chức năng ──
    // Xem câu hỏi trong phiếu (SidePanel)
    const openSidePanelBtn = document.getElementById('openSidePanel');
    if (openSidePanelBtn) {
        openSidePanelBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.sidePanel.open({ tabId: tabs[0].id });
                    window.close();
                }
            });
        });
    }

    const openLotusExtractorBtn = document.getElementById('openLotusExtractor');
    if (openLotusExtractorBtn) {
        openLotusExtractorBtn.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-folder-extractor/index.html'));
        });
    }

    const openFolderStructureExporterBtn = document.getElementById('openFolderStructureExporter');
    if (openFolderStructureExporterBtn) {
        openFolderStructureExporterBtn.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/folder-structure-exporter/index.html'));
        });
    }

    const openSyllabusExtractorBtn = document.getElementById('openSyllabusExtractor');
    if (openSyllabusExtractorBtn) {
        openSyllabusExtractorBtn.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-syllabus-extractor/index.html'));
        });
    }

    const openQuestionDuplicatorBtn = document.getElementById('openQuestionDuplicator');
    if (openQuestionDuplicatorBtn) {
        openQuestionDuplicatorBtn.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-duplicator/index.html'));
        });
    }

    const openQuestionMover = document.getElementById('openQuestionMover');
    if (openQuestionMover) {
        openQuestionMover.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-move/index.html'));
        });
    }

    const openQuestionDeleter = document.getElementById('openQuestionDeleter');
    if (openQuestionDeleter) {
        openQuestionDeleter.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-deleter/index.html'));
        });
    }

    const openQuestionTagger = document.getElementById('openQuestionTagger');
    if (openQuestionTagger) {
        openQuestionTagger.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-tagger/index.html'));
        });
    }

    const openPhanQuyen = document.getElementById('openPhanQuyen');
    if (openPhanQuyen) {
        openPhanQuyen.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/phanquyen/index.html'));
        });
    }

    const openQuestionFinder = document.getElementById('openQuestionFinder');
    if (openQuestionFinder) {
        openQuestionFinder.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-finder/index.html'));
        });
    }

    const openQuestionExporter = document.getElementById('openQuestionExporter');
    if (openQuestionExporter) {
        openQuestionExporter.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/question-exporter/index.html'));
        });
    }

    const openBankIidViewer = document.getElementById('openBankIidViewer');
    if (openBankIidViewer) {
        openBankIidViewer.addEventListener('click', () => {
            window.open(chrome.runtime.getURL('module/bank-iid-viewer/index.html'));
        });
    }

    // ── Cài đặt: Toggle hiển thị IID ngân hàng trên trang ────────
    const toggleBankIidOverlay = document.getElementById('toggleBankIidOverlay');
    if (toggleBankIidOverlay) {
        chrome.storage.local.get({ showBankIidOverlay: true }, (data) => {
            toggleBankIidOverlay.checked = data.showBankIidOverlay;
        });

        toggleBankIidOverlay.addEventListener('change', () => {
            chrome.storage.local.set({ showBankIidOverlay: toggleBankIidOverlay.checked });
        });
    }

    // ── Bộ lọc Tab & Tìm kiếm chức năng ──
    const categoryTabs = document.querySelectorAll('#categoryTabs .tab-btn');
    const groupSections = document.querySelectorAll('.group-section');
    const noResultsMsg = document.getElementById('noResultsMsg');
    const searchInput = document.getElementById('featSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    let currentCategory = 'all';

    function normalizeText(text) {
        return (text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .trim();
    }

    function filterFeatures() {
        const rawQuery = (searchInput?.value || '').trim();
        const normQuery = normalizeText(rawQuery);
        let visibleTotal = 0;

        groupSections.forEach(section => {
            const groupCategory = section.getAttribute('data-group');
            let groupHasVisible = false;

            const buttons = section.querySelectorAll('.feat-btn');
            buttons.forEach(btn => {
                const btnCategory = btn.getAttribute('data-category');
                const title = btn.querySelector('.feat-label')?.textContent || '';
                const desc = btn.querySelector('.feat-desc')?.textContent || '';
                const keywords = btn.getAttribute('data-keywords') || '';

                const normTarget = normalizeText(`${title} ${desc} ${keywords}`);

                const matchesCategory = (currentCategory === 'all') || (btnCategory === currentCategory);
                const matchesSearch = !normQuery || normTarget.includes(normQuery);

                if (matchesCategory && matchesSearch) {
                    btn.classList.remove('hidden');
                    groupHasVisible = true;
                    visibleTotal++;
                } else {
                    btn.classList.add('hidden');
                }
            });

            // Ẩn hoặc hiện tiêu đề nhóm
            if (groupHasVisible) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });

        if (noResultsMsg) {
            if (visibleTotal === 0) {
                noResultsMsg.classList.remove('hidden');
            } else {
                noResultsMsg.classList.add('hidden');
            }
        }
    }

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.getAttribute('data-category') || 'all';
            filterFeatures();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
            }
            filterFeatures();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                filterFeatures();
            } else if (e.key === 'Enter') {
                // Mở chức năng đầu tiên hiển thị
                const firstVisible = document.querySelector('.feat-btn:not(.hidden)');
                if (firstVisible) {
                    firstVisible.click();
                }
            }
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            clearSearchBtn.style.display = 'none';
            filterFeatures();
        });
    }
});