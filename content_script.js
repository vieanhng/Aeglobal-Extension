// content_script.js
// Ví dụ: Lấy UID và Token từ Local Storage hoặc Session Storage
// Thay thế bằng logic phù hợp với trang web của bạn
try {
    const uid = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

    if (uid && token) {
        chrome.runtime.sendMessage({ action: "setAuthData", uid: uid, token: token });
    } else {
        // Cố gắng lấy từ biến JS toàn cục (ví dụ: nếu trang web định nghĩa window.appConfig.uid)
        // Đây chỉ là ví dụ, bạn cần kiểm tra cấu trúc JS của trang web
        if (window.appConfig && window.appConfig.uid && window.appConfig.token) {
            chrome.runtime.sendMessage({ action: "setAuthData", uid: window.appConfig.uid, token: window.appConfig.token });
        }
    }
} catch (e) {
    console.error("Error in content script:", e);
}

// Nếu bạn cần lấy từ network requests, bạn sẽ cần một cách phức tạp hơn
// Ví dụ: can thiệp vào XMLHttpRequest hoặc Fetch API, nhưng điều này phức tạp hơn
// và thường không khuyến khích trừ khi không có lựa chọn nào khác.