// Shared Authentication and Storage Functions
const SharedAuth = {
    // Load UID, Token and saved date from storage
    loadAuthData: function (callback) {
        chrome.storage.local.get(['uid', 'token', 'savedDate'], (data) => {
            const authData = {
                uid: data.uid || '',
                token: data.token || '',
                savedDate: data.savedDate || ''
            };
            if (callback) callback(authData);
        });
    },

    // Display auth data in UI
    displayAuthData: function (authData, elements) {
        const { uid, token, savedDate } = authData;
        const { displayUid, displayToken, displaySavedDate } = elements;

        if (uid) {
            displayUid.textContent = uid;
            displayUid.classList.remove('text-red-500');
        } else {
            displayUid.textContent = 'Chưa có';
            displayUid.classList.add('text-red-500');
        }

        if (token) {
            displayToken.textContent = token;
            displayToken.classList.remove('text-red-500');
        } else {
            displayToken.textContent = 'Chưa có';
            displayToken.classList.add('text-red-500');
        }

        if (savedDate) {
            displaySavedDate.textContent = new Date(savedDate).toLocaleString();
            displaySavedDate.classList.remove('text-red-500');
        } else {
            displaySavedDate.textContent = 'Chưa có';
            displaySavedDate.classList.add('text-red-500');
        }
    },

    // Validate if auth data exists
    validateAuth: function (uid, token) {
        return uid && token;
    }
};
