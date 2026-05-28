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
 * @param {Object} questionObject - Object chứa thông tin câu hỏi
 * @param {Array|string} tags - Danh sách tag mới hoặc tag cần thêm
 * @param {string} mode - 'append' hoặc 'replace' (mặc định là 'append')
 */
const updateQuestionTags = async (questionObject, tags, mode = 'append', uid, token) => {
    console.log(`Đang ${mode === 'append' ? 'thêm' : 'thay thế'} tags cho ID: ${questionObject.id}`);

    try {
        let finalTags = Array.isArray(tags) ? tags : [tags];

        // --- XỬ LÝ LOGIC APPEND ---
        if (mode === 'append') {
            // Bước 1: Tìm thông tin hiện tại để lấy các tags cũ
            const currentTags = questionObject.tags || [];

            // Bước 2: Hợp nhất (tránh trùng lặp)
            finalTags = [...new Set([...currentTags, ...finalTags])];
        }

        // --- GỬI REQUEST CẬP NHẬT ---
        const formData = new FormData();
        formData.append('iid', String(questionObject.id));
        formData.append('id', String(questionObject.id));
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

// Port connections for real-time logging
let connectedPorts = [];

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "logChannel") {
        connectedPorts.push(port);
        console.log("UI page connected for logging");

        port.onDisconnect.addListener(() => {
            connectedPorts = connectedPorts.filter(p => p !== port);
            console.log("UI page disconnected from logging");
        });
    }
});

// Helper function to send logs to UI
function sendLogToUI(message, type = 'info') {
    connectedPorts.forEach(port => {
        try {
            port.postMessage({ type: 'log', message, logType: type });
        } catch (error) {
            console.error('Failed to send log to UI:', error);
        }
    });
}

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
        const { uid, token, questionIds, bankLinks, tags } = request;

        const processBatch = async () => {
            const results = [];

            for (const bankLink of bankLinks) {
                const bankId = bankLink;
                const duplicatedQuestionMap = []; // Store mapping: { originalId, duplicatedId }

                // Step 1: Duplicate all questions and track original IDs
                console.log(`\n========================================`);
                sendLogToUI(`========================================`, 'header');
                console.log(`Processing bank ${bankId}: Duplicating ${questionIds.length} questions...`);
                sendLogToUI(`Processing bank ${bankId}: Duplicating ${questionIds.length} questions...`, 'header');
                console.log(`========================================`);
                sendLogToUI(`========================================`, 'header');

                for (let i = 0; i < questionIds.length; i++) {
                    const originalQId = questionIds[i];
                    console.log(`\n[${i + 1}/${questionIds.length}] Duplicating question ID: ${originalQId}`);
                    sendLogToUI(`[${i + 1}/${questionIds.length}] Duplicating question ID: ${originalQId}`, 'info');
                    const newQObject = await duplicateQuestion(originalQId, uid, token);
                    if (newQObject) {
                        console.log(`✓ [${i + 1}/${questionIds.length}] Successfully duplicated: ${originalQId} → ${newQObject.id}`);
                        sendLogToUI(`✓ [${i + 1}/${questionIds.length}] Successfully duplicated: ${originalQId} → ${newQObject.id}`, 'success');
                        duplicatedQuestionMap.push({
                            originalId: originalQId,
                            duplicatedId: newQObject.id,
                            duplicateObject: newQObject
                        });
                    } else {
                        console.error(`✗ [${i + 1}/${questionIds.length}] Failed to duplicate question ID: ${originalQId}`);
                        sendLogToUI(`✗ [${i + 1}/${questionIds.length}] Failed to duplicate question ID: ${originalQId}`, 'error');
                    }
                }

                // Check if any questions were duplicated
                if (duplicatedQuestionMap.length === 0) {
                    console.error(`\n⚠ No questions were successfully duplicated for bank ${bankId}`);
                    sendLogToUI(`⚠ No questions were successfully duplicated for bank ${bankId}`, 'warning');
                    results.push({
                        bankLink,
                        bankId,
                        success: false,
                        duplicatedCount: 0,
                        movedCount: 0,
                        taggedCount: 0,
                        message: "Không có câu hỏi nào được nhân bản cho ngân hàng này."
                    });
                    continue;
                }

                console.log(`\n✓ Duplication complete: ${duplicatedQuestionMap.length}/${questionIds.length} questions duplicated successfully`);
                sendLogToUI(`✓ Duplication complete: ${duplicatedQuestionMap.length}/${questionIds.length} questions duplicated successfully`, 'success');

                // Extract duplicated IDs for moving
                const duplicatedQuestionIds = duplicatedQuestionMap.map(item => item.duplicatedId);

                // Step 2: Move duplicated questions to bank
                console.log(`\n--- Moving ${duplicatedQuestionIds.length} questions to bank ${bankId}... ---`);
                sendLogToUI(`--- Moving ${duplicatedQuestionIds.length} questions to bank ${bankId}... ---`, 'info');
                const moveSuccess = await moveQuestionsToBank(duplicatedQuestionIds, bankId, uid, token);

                if (moveSuccess) {
                    console.log(`✓ Successfully moved all questions to bank ${bankId}`);
                    sendLogToUI(`✓ Successfully moved all questions to bank ${bankId}`, 'success');
                } else {
                    console.error(`✗ Failed to move questions to bank ${bankId}`);
                    sendLogToUI(`✗ Failed to move questions to bank ${bankId}`, 'error');
                }

                // Step 3: Update tags for each duplicated question with auto-generated variant tag
                let taggedCount = 0;
                console.log(`\n--- Updating tags for ${duplicatedQuestionIds.length} questions... ---`);
                sendLogToUI(`--- Updating tags for ${duplicatedQuestionIds.length} questions... ---`, 'info');

                for (let i = 0; i < duplicatedQuestionMap.length; i++) {
                    const item = duplicatedQuestionMap[i];
                    console.log(`\n[${i + 1}/${duplicatedQuestionMap.length}] Updating tags for question ID: ${item.duplicatedId} (original: ${item.originalId})`);
                    sendLogToUI(`[${i + 1}/${duplicatedQuestionMap.length}] Updating tags for question ID: ${item.duplicatedId} (original: ${item.originalId})`, 'info');

                    // Create auto tag: 'variant of {original question id}'
                    const variantTag = `variant of ${item.originalId}`;

                    // Combine auto tag with user-provided tags (if any)
                    const allTags = tags && tags.length > 0
                        ? [variantTag, ...tags]
                        : [variantTag];

                    console.log(`  Tags to apply: ${allTags.join(', ')}`);
                    sendLogToUI(`  Tags to apply: ${allTags.join(', ')}`, 'info');

                    const tagSuccess = await updateQuestionTags(item.duplicateObject, allTags, 'append', uid, token);
                    if (tagSuccess) {
                        console.log(`✓ [${i + 1}/${duplicatedQuestionMap.length}] Successfully tagged question ID: ${item.duplicatedId}`);
                        sendLogToUI(`✓ [${i + 1}/${duplicatedQuestionMap.length}] Successfully tagged question ID: ${item.duplicatedId}`, 'success');
                        taggedCount++;
                    } else {
                        console.error(`✗ [${i + 1}/${duplicatedQuestionMap.length}] Failed to tag question ID: ${item.duplicatedId}`);
                        sendLogToUI(`✗ [${i + 1}/${duplicatedQuestionMap.length}] Failed to tag question ID: ${item.duplicatedId}`, 'error');
                    }
                }

                console.log(`\n✓ Tagging complete: ${taggedCount}/${duplicatedQuestionMap.length} questions tagged successfully`);
                sendLogToUI(`✓ Tagging complete: ${taggedCount}/${duplicatedQuestionMap.length} questions tagged successfully`, 'success');

                // Determine overall success
                const overallSuccess = moveSuccess && taggedCount > 0;

                results.push({
                    bankLink,
                    bankId,
                    success: overallSuccess,
                    duplicatedCount: duplicatedQuestionMap.length,
                    movedCount: moveSuccess ? duplicatedQuestionIds.length : 0,
                    taggedCount: taggedCount,
                    message: overallSuccess
                        ? `Đã nhân bản ${duplicatedQuestionMap.length} câu hỏi, di chuyển ${moveSuccess ? 'thành công' : 'thất bại'}`
                        : `Có lỗi xảy ra trong quá trình xử lý.`
                });
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

    if (request.action === "exportQuestions") {
        const { uid, token, bankId, needsResolve } = request;

        // Immediately return true to keep message channel open
        (async () => {
            try {
                console.log(`Starting export for bank ${bankId} (needsResolve: ${needsResolve})`);

                let actualBankId = bankId;

                // Step 0: Resolve shortcode to actual ID if needed
                if (needsResolve) {
                    console.log(`Resolving shortcode: ${bankId}`);
                    try {
                        const resolveUrl = `${API_BASE}/content/api/item-detail?item_id=${bankId}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

                        const resolveResponse = await Promise.race([
                            fetch(resolveUrl, { method: "POST" }),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Resolve timeout')), 10000))
                        ]);

                        const resolveData = await resolveResponse.json();

                        if (resolveData.result && resolveData.result.target_item_iid) {
                            actualBankId = resolveData.result.target_item_iid;
                            console.log(`Resolved ${bankId} -> ${actualBankId}`);
                        } else if (resolveData.message === 'no_permission_to_view_item') {
                            console.error(`No permission to view item: ${bankId}`);
                            sendResponse({
                                status: "completed",
                                result: { success: false, bankId, error: "Không có quyền truy cập" }
                            });
                            return;
                        } else {
                            console.error(`Failed to resolve shortcode: ${bankId}`);
                            sendResponse({
                                status: "completed",
                                result: { success: false, bankId, error: "Không thể resolve shortcode" }
                            });
                            return;
                        }
                    } catch (resolveError) {
                        console.error(`Error resolving shortcode ${bankId}:`, resolveError);
                        sendResponse({
                            status: "completed",
                            result: { success: false, bankId, error: `Lỗi resolve: ${resolveError.message}` }
                        });
                        return;
                    }
                }

                // Step 1: Get bank info with timeout
                const bankUrl = `${API_BASE}/question-bank/editor/fetch-node?iid=${actualBankId}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

                const bankResponse = await Promise.race([
                    fetch(bankUrl, { method: "POST" }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Bank fetch timeout')), 10000))
                ]);

                const bankData = await bankResponse.json();

                if (!bankData.success || !bankData.result) {
                    console.error(`Failed to fetch bank info for ID: ${actualBankId}`);
                    sendResponse({
                        status: "completed",
                        result: { success: false, bankId: actualBankId, error: "Failed to fetch bank info" }
                    });
                    return;
                }

                const bankName = bankData.result.name || `Bank ${actualBankId}`;
                console.log(`Bank name: ${bankName}`);

                // Step 2: Search all questions in the bank with timeout
                const searchUrl = `${API_BASE}/question/index/search?_sand_get_total=0&question_bank[]=${actualBankId}&items_per_page=-1&page=1&ntype=question&submit=1&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

                const searchResponse = await Promise.race([
                    fetch(searchUrl, { method: "POST" }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Search timeout')), 15000))
                ]);

                const searchData = await searchResponse.json();

                if (searchData.success && searchData.result && searchData.result.length > 0) {
                    // Extract all question IDs
                    const questionIds = searchData.result.map(q => q.id);

                    console.log(`Exported ${questionIds.length} questions from bank ${actualBankId} (${bankName})`);

                    sendResponse({
                        status: "completed",
                        result: {
                            success: true,
                            bankId: actualBankId,
                            bankName,
                            questionIds
                        }
                    });
                } else {
                    console.log(`No questions found in bank ${actualBankId}`);
                    sendResponse({
                        status: "completed",
                        result: {
                            success: true,
                            bankId: actualBankId,
                            bankName,
                            questionIds: []
                        }
                    });
                }
            } catch (error) {
                console.error(`Error exporting questions from bank ${bankId}:`, error);
                sendResponse({
                    status: "completed",
                    result: { success: false, bankId, error: error.message }
                });
            }
        })();

        return true; // Keep message channel open for async response
    }
    // ============================================================
    // SidePanel: Lưu dữ liệu exercise được capture từ trang web
    // ============================================================
    if (request.type === 'AEGLOBAL_API_DATA') {
        const { payload } = request;

        chrome.storage.local.get({ history: [] }, (data) => {
            const history = data.history;

            // Thêm entry mới vào đầu danh sách
            history.unshift(payload);

            // Giữ tối đa 100 entries
            if (history.length > 100) {
                history.pop();
            }

            chrome.storage.local.set({ history });
        });

        return; // không cần sendResponse
    }
});

// Mở sidepanel khi click action icon (giữ popup là default, sidepanel mở thủ công)
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error(error));