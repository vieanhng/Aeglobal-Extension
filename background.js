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
 * Xóa câu hỏi theo ID - Gọi API /question/delete
 */
const deleteQuestion = async (questionId, uid, token) => {
    console.log(`Đang xóa câu hỏi ID: ${questionId}`);
    try {
        const formData = new FormData();
        formData.append('id', questionId);
        formData.append('submit', '1');
        formData.append('_sand_ajax', '1');
        formData.append('_sand_platform', '3');
        formData.append('_sand_readmin', '1');
        formData.append('_sand_is_wan', 'false');
        formData.append('_sand_domain', DOMAIN);
        formData.append('_sand_masked', '');
        formData.append('allow_cache_api_cdn', '1');
        formData.append('lang', 'vn');
        formData.append('_sand_token', token);
        formData.append('_sand_uiid', uid);

        const response = await fetch(`${API_BASE}/question/delete`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            console.log(`Xóa thành công câu hỏi ID: ${questionId}`);
            return { success: true };
        } else {
            const errMsg = data.message || 'Xóa thất bại';
            console.error(`Xóa thất bại câu hỏi ${questionId}: ${errMsg}`);
            return { success: false, error: errMsg };
        }
    } catch (error) {
        console.error(`Lỗi khi xóa câu hỏi ${questionId}:`, error);
        return { success: false, error: error.message };
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
        const searchUrl = `${API_BASE}/question/index/search?_sand_get_total=0&search_from_bank=1&ntype=question&q=${encodeURIComponent(questionId)}&submit=1&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

        const searchResponse = await fetch(searchUrl, { method: "POST" });
        const searchData = await searchResponse.json();

        if (searchData.success && searchData.result && searchData.result.length > 0) {
            const qIdLower = String(questionId).toLowerCase().trim();
            const questionData = searchData.result.find(q =>
                (q.id && String(q.id).toLowerCase() === qIdLower) ||
                (q.iid && String(q.iid).toLowerCase() === qIdLower) ||
                (q._id && String(q._id).toLowerCase() === qIdLower)
            ) || (searchData.result.length === 1 ? searchData.result[0] : null);

            if (questionData) {
                let bankName = "N/A";
                let bankUrl = "#";

                if (questionData.question_bank) {
                    bankUrl = `https://${DOMAIN}.lotuslms.com/admin/question-bank/${questionData.question_bank}`;
                    try {
                        const bankUrlApi = `${API_BASE}/question-bank/editor/fetch-node?iid=${questionData.question_bank}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;
                        const bankResponse = await fetch(bankUrlApi, { method: "POST" });
                        const bankData = await bankResponse.json();
                        if (bankData.result && bankData.result.name) {
                            bankName = bankData.result.name;
                        }
                    } catch (e) {
                        console.warn(`Không lấy được tên ngân hàng: ${e.message}`);
                    }
                }

                return {
                    id: questionData.id || questionId,
                    url: bankUrl,
                    bank_name: bankName,
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
 * Cập nhật Tags với 3 tùy chọn: append (thêm vào), replace (thay thế tất cả), remove (xóa thẻ)
 * @param {Object} questionObject - Object chứa thông tin câu hỏi (id, tags, ...)
 * @param {Array|string} tags - Danh sách tag thao tác
 * @param {string} mode - 'append', 'replace', hoặc 'remove' (mặc định là 'append')
 */
const updateQuestionTags = async (questionObject, tags, mode = 'append', uid, token) => {
    const qId = questionObject.id || questionObject.iid;
    console.log(`Đang xử lý tags (chế độ: ${mode}) cho ID: ${qId}`);

    try {
        let finalTags = [];

        if (mode === 'overwrite') {
            let cleanPairs = [];
            if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
                if (Array.isArray(tags.pairs)) {
                    cleanPairs = tags.pairs
                        .map(p => ({
                            from: String(p.from || '').trim(),
                            to: String(p.to || '').trim()
                        }))
                        .filter(p => p.from.length > 0);
                } else if (tags.from !== undefined) {
                    const fromArr = (Array.isArray(tags.from) ? tags.from : [tags.from])
                        .map(t => String(t).trim())
                    const toArr = (Array.isArray(tags.to) ? tags.to : [tags.to])
                        .map(t => String(t).trim());
                    fromArr.forEach((fromTag, idx) => {
                        cleanPairs.push({ from: fromTag, to: toArr[idx] || toArr[0] || '' });
                    });
                }
            }

            const replacementMap = new Map();
            for (const pair of cleanPairs) {
                if (!replacementMap.has(pair.from)) {
                    replacementMap.set(pair.from, pair.to);
                }
            }

            const appliedChanges = [];
            const matchedFromTags = new Set();
            for (const tag of currentTags) {
                if (replacementMap.has(tag)) {
                    matchedFromTags.add(tag);
                    const toVal = replacementMap.get(tag);
                    const changeStr = `[${tag}] ➔ [${toVal || '(xóa)'}]`;
                    if (!appliedChanges.includes(changeStr)) {
                        appliedChanges.push(changeStr);
                    }
                }
            }

            if (matchedFromTags.size === 0) {
                const fromListNames = cleanPairs.map(p => p.from);
                console.log(`ID ${qId} không chứa thẻ nào khớp trong danh sách [${fromListNames.join(', ')}]. Bỏ qua.`);
                return {
                    success: true,
                    skipped: true,
                    message: `Không chứa thẻ nào khớp trong danh sách [${fromListNames.join(', ')}] để ghi đè`,
                    oldTags: currentTags,
                    finalTags: currentTags
                };
            }

            // Thay thế vị trí các thẻ A bằng thẻ B tương ứng
            let newTagsList = [];
            for (const tag of currentTags) {
                if (replacementMap.has(tag)) {
                    const toVal = replacementMap.get(tag);
                    if (toVal && toVal.length > 0) {
                        const subTags = toVal.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
                        newTagsList.push(...subTags);
                    }
                } else {
                    newTagsList.push(tag);
                }
            }

            const seen = new Set();
            finalTags = [];
            for (const t of newTagsList) {
                if (!seen.has(t) && t.length > 0) {
                    seen.add(t);
                    finalTags.push(t);
                }
            }
        } else {
            let inputTags = [];
            if (Array.isArray(tags)) {
                inputTags = tags.map(t => String(t).trim()).filter(t => t.length > 0);
            } else if (typeof tags === 'string') {
                inputTags = [tags.trim()].filter(t => t.length > 0);
            }

            if (mode === 'append') {
                const seen = new Set();
                finalTags = [];
                for (const t of [...currentTags, ...inputTags]) {
                    if (!seen.has(t) && t.length > 0) {
                        seen.add(t);
                        finalTags.push(t);
                    }
                }
            } else if (mode === 'replace') {
                const seen = new Set();
                finalTags = [];
                for (const t of inputTags) {
                    if (!seen.has(t) && t.length > 0) {
                        seen.add(t);
                        finalTags.push(t);
                    }
                }
            } else if (mode === 'remove') {
                const tagsToRemoveSet = new Set(inputTags);
                const matchedTags = currentTags.filter(t => tagsToRemoveSet.has(t));

                if (matchedTags.length === 0) {
                    console.log(`ID ${qId} không chứa bất kỳ thẻ nào cần xóa. Bỏ qua cập nhật.`);
                    return {
                        success: true,
                        skipped: true,
                        message: "Không chứa thẻ cần xóa",
                        oldTags: currentTags,
                        finalTags: currentTags
                    };
                }

                finalTags = currentTags.filter(t => !tagsToRemoveSet.has(t));
            }
        }

        // --- GỬI REQUEST CẬP NHẬT ---
        const formData = new FormData();
        formData.append('iid', String(qId));
        formData.append('id', String(qId));
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
            console.log(`Cập nhật thành công (${mode}) cho ID ${qId}. Danh sách tag mới:`, finalTags);
            return {
                success: true,
                skipped: false,
                oldTags: currentTags,
                finalTags: finalTags
            };
        } else {
            console.error(`Lỗi từ server khi cập nhật ID ${qId}: ${data.message || 'Unknown'}`);
            return {
                success: false,
                error: data.message || 'Unknown server error',
                oldTags: currentTags
            };
        }

    } catch (error) {
        console.error(`Lỗi khi update tag cho ID ${qId}:`, error);
        return {
            success: false,
            error: error.message,
            oldTags: questionObject.tags || []
        };
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
                    if (tagSuccess && tagSuccess.success) {
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

    // ============================================================
    // Cập nhật thẻ câu hỏi theo ID (append, replace, remove)
    // ============================================================
    if (request.action === "updateQuestionTags") {
        const { uid, token, questionId, tags, mode } = request;

        (async () => {
            try {
                if (!questionId) {
                    sendResponse({ success: false, error: "ID câu hỏi không hợp lệ" });
                    return;
                }

                // 1. Tìm thông tin câu hỏi
                const searchUrl = `${API_BASE}/question/index/search?_sand_get_total=0&search_from_bank=1&ntype=question&q=${encodeURIComponent(questionId)}&submit=1&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;
                const searchResponse = await fetch(searchUrl, { method: "POST" });
                const searchData = await searchResponse.json();

                if (!searchData.success || !searchData.result || searchData.result.length === 0) {
                    sendResponse({
                        success: false,
                        questionId,
                        error: "Không tìm thấy câu hỏi"
                    });
                    return;
                }

                const qIdLower = String(questionId).toLowerCase().trim();
                const questionData = (Array.isArray(searchData.result) ? searchData.result : []).find(q =>
                    (q.id && String(q.id).toLowerCase() === qIdLower) ||
                    (q.iid && String(q.iid).toLowerCase() === qIdLower) ||
                    (q._id && String(q._id).toLowerCase() === qIdLower)
                ) || (searchData.result.length === 1 ? searchData.result[0] : null);

                if (!questionData) {
                    sendResponse({
                        success: false,
                        questionId,
                        error: "Không tìm thấy câu hỏi khớp với ID"
                    });
                    return;
                }

                // 2. Gọi hàm updateQuestionTags
                const result = await updateQuestionTags(questionData, tags, mode || 'append', uid, token);

                sendResponse({
                    ...result,
                    questionId: questionData.id || questionId,
                    mode: mode || 'append'
                });
            } catch (error) {
                console.error(`Lỗi updateQuestionTags ${questionId}:`, error);
                sendResponse({
                    success: false,
                    questionId,
                    error: error.message
                });
            }
        })();

        return true; // Giữ channel mở cho async
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
    // Xóa câu hỏi theo ID
    // ============================================================
    if (request.action === 'deleteQuestion') {
        const { uid, token, questionId } = request;

        (async () => {
            try {
                const result = await deleteQuestion(questionId, uid, token);
                sendResponse(result);
            } catch (error) {
                console.error(`Lỗi deleteQuestion ${questionId}:`, error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        return true; // Giữ channel mở cho async
    }
    // ============================================================
    // Quản lý thẻ câu hỏi: Append, Remove, Replace, Overwrite
    // ============================================================
    if (request.action === 'updateQuestionTags') {
        const { uid, token, questionId, tags, mode } = request;

        (async () => {
            try {
                let qObj = await findQuestion(questionId, uid, token);
                if (!qObj) {
                    sendResponse({ success: false, questionId, error: "Không tìm thấy câu hỏi" });
                    return;
                }
                const result = await updateQuestionTags(qObj, tags, mode || 'append', uid, token);
                sendResponse({ ...result, questionId });
            } catch (error) {
                console.error(`Lỗi updateQuestionTags cho ID ${questionId}:`, error);
                sendResponse({ success: false, questionId, error: error.message });
            }
        })();

        return true; // Giữ channel mở cho async
    }
    // ============================================================
    // Content Script: Resolve IID ngân hàng từ shortcode trong URL
    // ============================================================
    if (request.action === 'resolveBankIidForPage') {
        const { shortcode, uid, token } = request;

        (async () => {
            try {
                // Bước 1: Resolve shortcode → target_item_iid
                const resolveUrl = `${API_BASE}/content/api/item-detail?item_id=${shortcode}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;
                const resolveResponse = await Promise.race([
                    fetch(resolveUrl, { method: 'POST' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]);
                const resolveData = await resolveResponse.json();

                if (!resolveData.result || resolveData.result.target_item_type !== 'question_bank') {
                    sendResponse({ success: false, shouldShowBadge: false });
                    return;
                }

                if (!resolveData.result.target_item_iid) {
                    const errMsg = resolveData.message === 'no_permission_to_view_item'
                        ? 'Không có quyền truy cập'
                        : 'Không resolve được IID';
                    sendResponse({ success: false, error: errMsg });
                    return;
                }

                const iid = resolveData.result.target_item_iid;

                // Bước 2: Lấy tên ngân hàng
                const bankUrl = `${API_BASE}/question-bank/editor/fetch-node?iid=${iid}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;
                const bankResponse = await Promise.race([
                    fetch(bankUrl, { method: 'POST' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]);
                const bankData = await bankResponse.json();

                const name = bankData.success && bankData.result ? bankData.result.name : null;
                sendResponse({ success: true, iid, name });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true; // giữ channel mở cho async
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
