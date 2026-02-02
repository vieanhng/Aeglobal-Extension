// background.js

const API_BASE = "https://cloud-beta-api.lotuslms.com";
const DOMAIN = "aeglobal";

/**
 * Nhân bản câu hỏi - Gọi trực tiếp LotusLMS API
 */
const duplicateQuestion = async (questionId, uid, token) => {
    console.log(`Đang nhân bản câu hỏi ID: ${questionId}`);
    try {
        const formData = new FormData();
        formData.append('iid', questionId);
        formData.append('ntype', 'question');
        formData.append('_sand_token', token);
        formData.append('_sand_uiid', uid);
        formData.append('_sand_domain', DOMAIN);

        const response = await fetch(`${API_BASE}/site/index/deep-clone`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        // Map lại response để khớp với logic cũ (data.success và data.questionId)
        if (data.success && data.result && data.result.id) {
            console.log(`Nhân bản thành công, ID mới: ${data.result.id}`);
            return data.result;
        } else {
            console.error(`Nhân bản thất bại câu hỏi ${questionId}`);
            return null;
        }
    } catch (error) {
        console.error(`Lỗi khi nhân bản câu hỏi ${questionId}:`, error);
        return null;
    }
};

/**
 * Di chuyển câu hỏi vào ngân hàng - Gọi trực tiếp LotusLMS API
 */
const moveQuestionsToBank = async (questionIdsToMove, bankId, uid, token) => {
    console.log(`Đang di chuyển các câu hỏi ${questionIdsToMove.join(', ')} đến ngân hàng ${bankId}`);
    try {
        const formData = new FormData();
        formData.append('new_bank_iid', bankId);
        formData.append('current_bank_iid', '30303389'); // Có thể để trống nếu không rõ ngân hàng gốc
        formData.append('_sand_domain', DOMAIN);
        formData.append('_sand_token', token);
        formData.append('_sand_uiid', uid);

        // Append danh sách ID câu hỏi theo format ids[0], ids[1]...
        questionIdsToMove.forEach((id, index) => {
            formData.append(`ids[${index}]`, id);
        });

        const response = await fetch(`${API_BASE}/question-bank/editor/move-questions`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            console.log(`Di chuyển thành công đến ngân hàng ${bankId}.`);
            return true;
        } else {
            console.error(`Di chuyển thất bại: ${data.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.error(`Lỗi khi di chuyển đến ngân hàng ${bankId}:`, error);
        return false;
    }
};

/**
 * Tìm kiếm thông tin câu hỏi và ngân hàng
 */
const findQuestion = async (questionId, uid, token) => {
    try {
        // Step 1: Search câu hỏi
        const searchUrl = `${API_BASE}/question/index/search?_sand_get_total=0&search_from_bank=1&ntype=question&q=${questionId}&submit=1&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

        const searchResponse = await fetch(searchUrl, { method: "POST" });
        const searchData = await searchResponse.json();

        if (searchData.success && searchData.result && searchData.result.length > 0) {
            const questionData = searchData.result.find(q => q.id === questionId);

            if (questionData && questionData.question_bank) {
                console.log(`Đã tìm thấy ngân hàng ID: ${questionData.question_bank}`);

                // Step 2: Lấy thông tin chi tiết ngân hàng (Bank Name)
                const bankUrl = `${API_BASE}/question-bank/editor/fetch-node?iid=${questionData.question_bank}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;
                const bankResponse = await fetch(bankUrl, { method: "POST" });
                const bankData = await bankResponse.json();

                return {
                    url: `https://${DOMAIN}.lotuslms.com/admin/question-bank/${questionData.question_bank}`,
                    bank_name: bankData.result ? bankData.result.name : "N/A",
                    tags: questionData.tags || [] // Trả về thêm tags để dùng cho các hàm sau
                };
            }
        }

        console.error(`Không tìm thấy câu hỏi hoặc ngân hàng.`);
        return false;
    } catch (error) {
        console.error(`Lỗi khi tìm câu hỏi:`, error);
        return false;
    }
};

/**
 * Cập nhật Tags với 2 tùy chọn: append (thêm vào) hoặc replace (thay thế tất cả)
 * @param {string} questionId - ID câu hỏi
 * @param {Array|string} tags - Danh sách tag mới hoặc tag cần thêm
 * @param {string} mode - 'append' hoặc 'replace' (mặc định là 'append')
 */
const updateQuestionTags = async (questionId, tags, mode = 'append', uid, token) => {
    console.log(`Đang ${mode === 'append' ? 'thêm' : 'thay thế'} tags cho ID: ${questionId}`);

    try {
        let finalTags = Array.isArray(tags) ? tags : [tags];

        // --- XỬ LÝ LOGIC APPEND ---
        if (mode === 'append') {
            // Bước 1: Tìm thông tin hiện tại để lấy các tags cũ
            const info = await findQuestion(questionId, uid, token);
            const currentTags = info.tags || [];

            // Bước 2: Hợp nhất (tránh trùng lặp)
            finalTags = [...new Set([...currentTags, ...finalTags])];
        }

        // --- GỬI REQUEST CẬP NHẬT ---
        const formData = new FormData();
        formData.append('iid', String(questionId));
        formData.append('id', String(questionId));
        formData.append('ntype', 'question');
        formData.append('rootNode[ntype]', 'question-bank');
        formData.append('_sand_step', 'tags');
        formData.append('_sand_domain', DOMAIN);
        formData.append('_sand_token', token);
        formData.append('_sand_uiid', uid);

        // Map mảng tags vào FormData
        finalTags.forEach((tag, index) => {
            formData.append(`questionData[tags][${index}]`, tag);
        });

        const response = await fetch(`${API_BASE}/exercise/editor/update-question`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            console.log(`Cập nhật thành công (${mode}). Danh sách tag mới:`, finalTags);
            return true;
        } else {
            console.error(`Lỗi từ server: ${data.message || 'Unknown'}`);
            return false;
        }

    } catch (error) {
        console.error(`Lỗi khi update tag:`, error);
        return false;
    }
};

// Lắng nghe các thông điệp từ popup.js hoặc options.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Xử lý khi popup gửi UID và Token
    if (request.action === "setAuthData") {
        const { uid, token, savedDate } = request; // Nhận thêm savedDate
        chrome.storage.local.set({ uid: uid, token: token, savedDate: savedDate }, () => { // Lưu cả savedDate
            console.log("UID, Token and save date updated.");
            sendResponse({ status: "success", message: "UID và Token đã được lưu." });
        });
        return true;
    }

    // Xử lý yêu cầu nhân bản và di chuyển câu hỏi từ options page
    if (request.action === "duplicateAndMoveQuestions") {
        const { uid, token, questionIds, bankLinks } = request;

        const processBatch = async () => {
            const results = [];
            for (const bankLink of bankLinks) {
                const bankId = bankLink.trim(); // Giả sử ID ngân hàng là phần cuối cùng của link
                const duplicatedQuestionIds = [];
                for (const originalQId of questionIds) {
                    const newQObject = await duplicateQuestion(originalQId, uid, token);
                    if (newQObject) {
                        duplicatedQuestionIds.push(newQObject.id);
                    }
                }
                if (duplicatedQuestionIds.length > 0) {
                    await moveQuestionsToBank(duplicatedQuestionIds, bankId, uid, token);
                    const updatedTags = await updateQuestionTags(duplicatedQuestionIds, request.tags, 'append', uid, token);

                    results.push({ bankLink, success: updatedTags, duplicatedCount: duplicatedQuestionIds.length });
                } else {
                    results.push({ bankLink, success: false, duplicatedCount: 0, message: "Không có câu hỏi nào được nhân bản cho ngân hàng này." });
                }
            }
            sendResponse({ status: "completed", results: results });
        };

        processBatch();
        return true;
    }


    if (request.action === "moveQuestions") {
        const { uid, token, questionIds, bankIid } = request;

        const processBatch = async () => {
            const results = [];

            if (questionIds.length > 0) {
                const moved = await moveQuestionsToBank(questionIds, bankIid, uid, token);
                results.push({ bankIid, success: moved, moveCount: questionIds.length });
            } else {
                results.push({ bankIid, success: false, moveCount: 0, message: "Không có câu hỏi nào được di chuyển cho ngân hàng này." });
            }

            sendResponse({ status: "completed", results: results });
        };

        processBatch();
        return true;
    }

    if (request.action === "findQuestion") {
        const { uid, token, questionId } = request;
        const results = [];

        const process = async () => {
            if (questionId.length > 0) {
                const result = await findQuestion(questionId, uid, token);
                results.push({ success: result });
            } else {
                results.push({ success: false, message: "Không tìm thấy NHCH cho câu hỏi này" });
            }

            sendResponse({ status: "completed", results: results });
        };

        process();
        return true;
    }
});