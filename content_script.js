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