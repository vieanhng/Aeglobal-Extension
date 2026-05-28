// content_script.js

// --- Phần cũ: Lấy UID và Token từ localStorage ---
try {
    const uid = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

    if (uid && token) {
        chrome.runtime.sendMessage({ action: "setAuthData", uid: uid, token: token });
    } else {
        if (window.appConfig && window.appConfig.uid && window.appConfig.token) {
            chrome.runtime.sendMessage({ action: "setAuthData", uid: window.appConfig.uid, token: window.appConfig.token });
        }
    }
} catch (e) {
    console.error("Error in content script (auth):", e);
}

// --- Phần mới: Inject interceptor để capture API exercise/fetch-node ---
try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('module/sidepanel/interceptor.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();

    // Relay message từ interceptor (page context) lên background
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'AEGLOBAL_API_DATA') {
            chrome.runtime.sendMessage(event.data);
        }
    });
} catch (e) {
    console.error("Error in content script (interceptor):", e);
}

// --- Hiển thị IID ngân hàng trên trang folder ---
(function initBankIidOverlay() {
    const OVERLAY_ID = 'aeglobal-bank-iid-overlay';
    const STYLE_ID = 'aeglobal-bank-iid-style';
    const CONTAINER_SELECTOR = '.content-manager-container';
    let currentShortcode = null;
    let dismissedShortcode = null;
    let requestSeq = 0;

    // Chờ DOM sẵn sàng vì content script chạy ở document_start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    function start() {
        installUrlChangeWatcher();
        installContainerWatcher();
        syncOverlayWithUrl();
    }

    function installUrlChangeWatcher() {
        window.addEventListener('aeglobal:urlchange', syncOverlayWithUrl);
        if (window.__aeglobalBankIidUrlWatcherInstalled) return;
        window.__aeglobalBankIidUrlWatcherInstalled = true;
        let lastObservedUrl = location.href;

        const notifyUrlChanged = () => {
            lastObservedUrl = location.href;
            window.dispatchEvent(new Event('aeglobal:urlchange'));
        };

        const wrapHistoryMethod = (methodName) => {
            const original = history[methodName];
            history[methodName] = function (...args) {
                const result = original.apply(this, args);
                notifyUrlChanged();
                return result;
            };
        };

        wrapHistoryMethod('pushState');
        wrapHistoryMethod('replaceState');
        window.addEventListener('popstate', notifyUrlChanged);
        window.addEventListener('hashchange', notifyUrlChanged);
        setInterval(() => {
            if (location.href !== lastObservedUrl) {
                notifyUrlChanged();
            }
        }, 500);
    }

    function getFolderShortcode() {
        // Kiểm tra URL có dạng /admin/content-manager/folder/<shortcode>
        const folderMatch = location.pathname.match(/\/admin\/content-manager\/folder\/([^\/\?#]+)/);
        return folderMatch ? folderMatch[1] : null;
    }

    function syncOverlayWithUrl() {
        const shortcode = getFolderShortcode();

        if (!shortcode) {
            currentShortcode = null;
            requestSeq += 1;
            removeOverlay();
            return;
        }

        if (shortcode !== currentShortcode) {
            dismissedShortcode = null;
        }

        if (shortcode === dismissedShortcode) return;

        const existingOverlay = document.getElementById(OVERLAY_ID);
        if (shortcode === currentShortcode && isOverlayInCurrentContainer(existingOverlay)) return;

        currentShortcode = shortcode;
        renderOverlayForShortcode(shortcode);
    }

    function installContainerWatcher() {
        if (!document.documentElement || window.__aeglobalBankIidContainerWatcherInstalled) return;
        window.__aeglobalBankIidContainerWatcherInstalled = true;

        let pending = false;
        const observer = new MutationObserver(() => {
            if (pending || !currentShortcode) return;

            pending = true;
            setTimeout(() => {
                pending = false;
                syncOverlayWithUrl();
            }, 100);
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function isOverlayInCurrentContainer(overlay) {
        const container = document.querySelector(CONTAINER_SELECTOR);
        return Boolean(overlay && container && overlay.parentElement === container);
    }

    function renderOverlayForShortcode(shortcode) {
        const seq = ++requestSeq;

        // Kiểm tra cài đặt bật/tắt trước
        chrome.storage.local.get({ showBankIidOverlay: true }, (settings) => {
            if (seq !== requestSeq || shortcode !== currentShortcode) return;

            if (!settings.showBankIidOverlay) {
                removeOverlay();
                return;
            }

            const overlay = createOverlay();
            if (!overlay) return;
            setOverlayLoading(overlay);

            // Lấy auth data rồi resolve IID
            chrome.storage.local.get(['uid', 'token'], (authData) => {
                if (seq !== requestSeq || shortcode !== currentShortcode) return;

                if (!authData.uid || !authData.token) {
                    setOverlayError(overlay, 'Chưa có thông tin xác thực');
                    return;
                }

                chrome.runtime.sendMessage(
                    { action: 'resolveBankIidForPage', shortcode, uid: authData.uid, token: authData.token },
                    (response) => {
                        if (seq !== requestSeq || shortcode !== currentShortcode) return;

                        if (chrome.runtime.lastError) {
                            setOverlayError(overlay, 'Lỗi kết nối extension');
                            return;
                        }

                        if (response && response.success) {
                            setOverlaySuccess(overlay, response.iid, response.name);
                        } else if (response && response.shouldShowBadge === false) {
                            dismissedShortcode = shortcode;
                            removeOverlay();
                        } else {
                            setOverlayError(overlay, response?.error || 'Không resolve được IID');
                        }
                    }
                );
            });
        });
    }

    function createOverlay() {
        injectOverlayStyle();

        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) return null;
        ensureContainerCanAnchorBadge(container);

        const existing = document.getElementById(OVERLAY_ID);
        if (existing) {
            if (existing.parentElement !== container) {
                container.appendChild(existing);
            }
            return existing;
        }

        const el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.innerHTML = `
            <div class="aeglobal-badge-inner">
                <div class="aeglobal-badge-content">
                    <span class="aeglobal-badge-label">IID Ngân hàng</span>
                    <span class="aeglobal-badge-value aeglobal-loading">Đang tải…</span>
                </div>
                <button class="aeglobal-badge-close" title="Đóng">✕</button>
            </div>
        `;

        // Nút đóng
        el.querySelector('.aeglobal-badge-close').addEventListener('click', () => {
            dismissedShortcode = currentShortcode;
            el.style.transition = 'opacity 0.2s, transform 0.2s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            setTimeout(() => el.remove(), 200);
        });

        container.appendChild(el);
        return el;
    }

    function ensureContainerCanAnchorBadge(container) {
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
    }

    function injectOverlayStyle() {
        if (document.getElementById(STYLE_ID)) return;

        // Styles inline để tránh xung đột với trang
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #aeglobal-bank-iid-overlay {
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                animation: aeglobal-slidein 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            @keyframes aeglobal-slidein {
                from { opacity: 0; transform: translateY(10px) scale(0.95); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .aeglobal-badge-inner {
                display: flex;
                align-items: center;
                gap: 8px;
                background: #ffffff;
                border: 1px solid #bfdbfe;
                border-radius: 6px;
                padding: 5px 7px 5px 9px;
                min-width: 0;
            }
            .aeglobal-badge-content {
                display: flex;
                flex-direction: column;
                gap: 1px;
                min-width: 0;
            }
            .aeglobal-badge-label {
                font-size: 9px;
                font-weight: 600;
                color: #1d4ed8;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .aeglobal-badge-value {
                font-size: 12px;
                font-weight: 700;
                font-family: 'Courier New', ui-monospace, monospace;
                color: #1e40af;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                cursor: pointer;
                transition: color 0.15s;
            }
            .aeglobal-badge-value:hover {
                color: #2563eb;
            }
            .aeglobal-badge-value.aeglobal-loading {
                color: #60a5fa;
                font-size: 10px;
                font-weight: 400;
                font-family: inherit;
                animation: aeglobal-pulse 1.2s ease-in-out infinite;
            }
            .aeglobal-badge-value.aeglobal-error {
                color: #dc2626;
                font-size: 10px;
                font-weight: 500;
                font-family: inherit;
            }
            .aeglobal-badge-name {
                font-size: 9px;
                color: #2563eb;
                font-weight: 400;
                font-family: inherit;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            @keyframes aeglobal-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .aeglobal-badge-close {
                background: none;
                border: none;
                color: #2563eb;
                font-size: 10px;
                cursor: pointer;
                padding: 1px 3px;
                border-radius: 3px;
                line-height: 1;
                flex-shrink: 0;
                transition: color 0.15s, background 0.15s;
            }
            .aeglobal-badge-close:hover {
                color: #1d4ed8;
                background: #eff6ff;
            }
            .aeglobal-copied-toast {
                position: absolute;
                bottom: calc(100% + 6px);
                right: 0;
                background: #2563eb;
                color: white;
                font-size: 11px;
                font-weight: 600;
                padding: 4px 10px;
                border-radius: 6px;
                white-space: nowrap;
                pointer-events: none;
                animation: aeglobal-toast-in 0.2s ease;
            }
            @keyframes aeglobal-toast-in {
                from { opacity: 0; transform: translateY(4px); }
                to   { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    function removeOverlay() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.remove();
    }

    function resetOverlayContent(el) {
        el.querySelectorAll('.aeglobal-badge-name, .aeglobal-copied-toast').forEach((node) => node.remove());
    }

    function setOverlayLoading(el) {
        resetOverlayContent(el);
        const valueEl = el.querySelector('.aeglobal-badge-value');
        valueEl.textContent = 'Đang tải…';
        valueEl.className = 'aeglobal-badge-value aeglobal-loading';
        valueEl.title = '';
        valueEl.onclick = null;
    }

    function setOverlaySuccess(el, iid, name) {
        resetOverlayContent(el);
        const valueEl = el.querySelector('.aeglobal-badge-value');
        valueEl.textContent = iid;
        valueEl.className = 'aeglobal-badge-value';
        valueEl.title = `Click để copy IID: ${iid}`;

        // Thêm tên ngân hàng
        if (name) {
            const nameEl = document.createElement('span');
            nameEl.className = 'aeglobal-badge-name';
            nameEl.textContent = name;
            el.querySelector('.aeglobal-badge-content').appendChild(nameEl);
        }

        // Click để copy
        valueEl.onclick = () => {
            navigator.clipboard.writeText(String(iid)).then(() => {
                const toast = document.createElement('div');
                toast.className = 'aeglobal-copied-toast';
                toast.textContent = '✓ Đã copy IID!';
                el.appendChild(toast);
                setTimeout(() => toast.remove(), 1800);
            });
        };
    }

    function setOverlayError(el, msg) {
        resetOverlayContent(el);
        const valueEl = el.querySelector('.aeglobal-badge-value');
        valueEl.textContent = msg;
        valueEl.className = 'aeglobal-badge-value aeglobal-error';
        valueEl.title = '';
        valueEl.onclick = null;
    }
})();
