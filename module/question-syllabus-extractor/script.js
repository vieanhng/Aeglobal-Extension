// LotusLMS Syllabus Question Extractor script.js
document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let isRunning = false;
    let globalQuestions = [];
    let currentPage = 1;
    let itemsPerPage = 20;
    let stats = { syllabus: 0, exercises: 0, questions: 0 };
    let currentUid = '';
    let currentToken = '';

    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');

    const cfgSyllabusIdsInput = document.getElementById('cfg-syllabusIds');
    const cfgDomainInput = document.getElementById('cfg-domain');
    const cfgTokenInput = document.getElementById('cfg-token');
    const cfgUidInput = document.getElementById('cfg-uid');
    const cfgAllowCacheInput = document.getElementById('cfg-allowCache');

    const btnStart = document.getElementById('btn-start');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnDownloadJson = document.getElementById('btn-download-json');
    const btnDownloadExcel = document.getElementById('btn-download-excel');

    const iconPlay = document.getElementById('icon-play');
    const iconLoading = document.getElementById('icon-loading');
    const textStart = document.getElementById('text-start');

    const statSyllabus = document.getElementById('stat-syllabus');
    const statExercises = document.getElementById('stat-exercises');
    const statQuestions = document.getElementById('stat-questions');

    const logContainer = document.getElementById('log-container');
    const resultsCard = document.getElementById('results-card');
    const resultTbody = document.getElementById('result-tbody');
    const totalBadge = document.getElementById('total-badge');

    const itemsPerPageSelect = document.getElementById('items-per-page');
    const pageNavWrapper = document.getElementById('page-nav-wrapper');

    // Load credentials from storage using SharedAuth
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Prepopulate token and uid input fields too
        if (currentToken) cfgTokenInput.value = currentToken;
        if (currentUid) cfgUidInput.value = currentUid;

        // Load previously saved inputs if any
        chrome.storage.local.get(['syllabusExtractorIds', 'syllabusExtractorDomain', 'syllabusExtractorAllowCache'], (data) => {
            if (data.syllabusExtractorIds) cfgSyllabusIdsInput.value = data.syllabusExtractorIds;
            if (data.syllabusExtractorDomain) cfgDomainInput.value = data.syllabusExtractorDomain;
            if (data.syllabusExtractorAllowCache) cfgAllowCacheInput.value = data.syllabusExtractorAllowCache;
        });
    });

    // Helper: Generate UUID for device
    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Helper: Strip HTML tags and format images
    function htmlToPlainText(html) {
        if (!html) return '';
        // Replace <img src="..."> with [Ảnh: url]
        let text = html.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
            return ` [Ảnh: ${src}] `;
        });
        // Replace common block tags with newlines
        text = text.replace(/<\/p>|<br\s*\/?>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n');
        // Strip all other HTML tags
        text = text.replace(/<[^>]+>/g, '');
        // Decode common HTML entities
        text = text.replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
        // Clean up newlines and return
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n')
            .trim();
    }

    // Helper: Clean base64 image sources inside text to avoid cell limit issues in Excel
    function cleanExcelCell(val) {
        if (val === null || val === undefined) return '';
        let str = String(val);
        // Replace base64 data URLs with a truncated version
        str = str.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, 'data:image/...;base64,[BASE64_IMAGE_TRUNCATED]');
        return str;
    }

    // Helper: Map question type code to Vietnamese name
    function getQuestionTypeName(type, tpl_type) {
        switch (Number(type)) {
            case 1: return "Điền từ";
            case 2: return "Trắc nghiệm 1 đáp án";
            case 4: return "Nối cặp";
            case 17: return "Trắc nghiệm nhiều đáp án";
            case 18: return "Đúng/Sai dạng bảng";
            case 22: return "Kéo thả";
            default: return tpl_type || `Loại ${type}`;
        }
    }

    // Helper: Format Answer Object to JSON String (from lotuslms_question_extractor_syllabus.html)
    function getAnswers(question) {
        const type = Number(question.type);
        switch (type) {
            case 2:
            case 17:
                return JSON.stringify(question.mc_answers || []);
            case 18:
                return JSON.stringify({
                    likert_questions: question.likert_questions,
                    likert_answers: question.likert_answers,
                    likert_correct_answers: question.likert_correct_answers
                });
            case 1:
                return JSON.stringify(question.answers || []);
            case 22:
                return JSON.stringify({
                    mddm_question_type: question.mddm_question_type,
                    mddm_question_table_columns: question.mddm_question_table_columns,
                    mddm_question_table_rows: question.mddm_question_table_rows,
                    mddm_single_dropped: question.mddm_single_dropped,
                    mddm_question_table_data: question.mddm_question_table_data,
                    mddm_mapping_table_data: question.mddm_mapping_table_data,
                    mddm_list_answer: question.mddm_list_answer,
                    mddm_question_table_options: question.mddm_question_table_options
                });
            case 20:
                return JSON.stringify({
                    ddm_questions: question.ddm_questions,
                    ddm_answers: question.ddm_answers,
                    ddm_correct_answers: question.ddm_correct_answers
                });
            case 4:
                return JSON.stringify(question.answer_as_hint || '');
            default:
                return '';
        }
    }

    function getStatusDescription(status) {
        switch (status) {
            case 'approved':
                return 'Duyệt';
            case 'rejected':
                return 'Loại';
            case 'completed_editing':
                return 'Đã biên tập';
            default:
                return 'Mới khởi tạo';
        }
    }

    // UI State Helpers
    function updateStatsUI() {
        statSyllabus.innerText = stats.syllabus;
        statExercises.innerText = stats.exercises;
        statQuestions.innerText = stats.questions;
    }

    function setRunningState(running) {
        isRunning = running;
        if (running) {
            btnStart.classList.replace('bg-gray-900', 'bg-gray-400');
            btnStart.classList.replace('hover:bg-gray-800', 'cursor-not-allowed');
            btnStart.disabled = true;
            iconPlay.style.display = 'none';
            iconLoading.style.display = 'block';
            textStart.innerText = 'Đang thống kê...';
            btnDownloadJson.style.display = 'none';
            btnDownloadExcel.style.display = 'none';
            resultsCard.classList.add('hidden');
        } else {
            btnStart.classList.replace('bg-gray-400', 'bg-gray-900');
            btnStart.classList.replace('cursor-not-allowed', 'hover:bg-gray-800');
            btnStart.disabled = false;
            iconPlay.style.display = 'block';
            iconLoading.style.display = 'none';
            textStart.innerText = 'Bắt đầu thống kê';
            if (globalQuestions.length > 0) {
                btnDownloadJson.style.display = 'flex';
                btnDownloadExcel.style.display = 'flex';
                resultsCard.classList.remove('hidden');
                renderTable();
            }
        }
    }

    function addLog(message, type = 'info') {
        const placeholder = logContainer.querySelector('.log-placeholder');
        if (placeholder) placeholder.remove();

        const div = document.createElement('div');
        div.className = 'flex gap-3 break-all py-0.5 border-b border-gray-900';

        const time = new Date().toLocaleTimeString();
        let colorClass = 'text-blue-300';
        let prefix = '•';

        if (type === 'error') {
            colorClass = 'text-red-400';
            prefix = '✗';
        } else if (type === 'success') {
            colorClass = 'text-green-400';
            prefix = '✓';
        } else if (type === 'warning') {
            colorClass = 'text-yellow-400';
            prefix = '⚠';
        }

        div.innerHTML = `
            <span class="text-gray-600 shrink-0 font-mono">[${time}]</span>
            <span class="${colorClass} shrink-0">${prefix}</span>
            <span class="${colorClass} font-mono">${escapeHtml(message)}</span>
        `;

        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Escape HTML for text-only rendering in logs
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Recursive crawler function
    function extractQuestionsRecursively(node, context) {
        let questions = [];

        // Clone current context to pass down the tree (avoid side-effects)
        let currentContext = { ...context };

        if (node) {
            if (node.ntype === 'syllabus') {
                currentContext.syllabusName = node.name || currentContext.syllabusName;
            } else if (node.ntype === 'exercise') {
                currentContext.exerciseIid = node.iid;
                currentContext.exerciseName = node.name;
                stats.exercises++;
                updateStatsUI();
            }

            // If the current node is a question
            if (node.ntype === 'question') {
                node._source_syllabus_iid = currentContext.syllabusIid;
                node._source_syllabus_name = currentContext.syllabusName;
                node._source_exercise_iid = currentContext.exerciseIid;
                node._source_exercise_name = currentContext.exerciseName;
                questions.push(node);
            }
        }

        // Recursive traversal
        if (node && Array.isArray(node.children) && node.children.length > 0) {
            for (const child of node.children) {
                questions = questions.concat(extractQuestionsRecursively(child, currentContext));
            }
        }

        return questions;
    }

    // Single syllabus fetch and parse
    async function fetchAndExtractSingle(iid, config) {
        const url = new URL('https://cloud-beta-api.lotuslms.com/api/v2/syllabus/get');
        url.searchParams.append('ntype', 'syllabus');
        url.searchParams.append('depth', '-1');
        url.searchParams.append('iid', iid);
        url.searchParams.append('partial', 'true');
        url.searchParams.append('submit', '1');
        url.searchParams.append('_sand_ajax', '1');
        url.searchParams.append('_sand_platform', '3');
        url.searchParams.append('_sand_readmin', '1');
        url.searchParams.append('_sand_is_wan', 'false');
        url.searchParams.append('_sand_session_id', '61b05c75-17b6-40dd-9ad8-211cf16644c2');
        url.searchParams.append('_sand_domain', config.domain);
        url.searchParams.append('_sand_use_internal_network', '0');
        url.searchParams.append('allow_cache_api_cdn', config.allowCache);
        url.searchParams.append('editing_syllabus', '2');
        url.searchParams.append('lang', 'vn');

        const formData = new FormData();
        formData.append('_sand_web_url', `https://${config.domain}.lotuslms.com/admin/materials/syllabus/${iid}/children`);
        formData.append('_sand_device_uuid', generateUUID());
        formData.append('_sand_token', config.token);
        formData.append('_sand_uiid', config.uid);
        formData.append('_sand_uid', '6576b1b5d18d78fd5f032742');

        formData.append('_sand_ri', '8002e9e2607a500dd3a7e15ef478c828');
        formData.append('_sand_rit', '1726ad1ccf4fce86279e9bf4b3c56c51:9htUVMS6P3LtsyC6DjEVct8uWCLQ3k63qA6HTl6tuY1vpAyJTUu1larCccliph48');

        const options = {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*'
            },
            body: formData
        };

        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || `API returned success=false.`);
        }

        let syllabusData = data.result;

        // If data is cached on S3
        if (data.is_s3_object_url && data.result && data.result.object_url) {
            addLog(`[Syllabus ${iid}] Dữ liệu được cache, đang tải file từ S3...`, 'info');
            const s3Response = await fetch(data.result.object_url);
            if (!s3Response.ok) {
                throw new Error(`Không thể tải dữ liệu cache từ S3 (HTTP ${s3Response.status}).`);
            }
            const s3Data = await s3Response.json();
            syllabusData = s3Data.result !== undefined ? s3Data.result : s3Data;
        }

        if (!syllabusData) {
            throw new Error(`Không tìm thấy dữ liệu Syllabus hợp lệ.`);
        }

        const initialContext = {
            syllabusIid: iid,
            syllabusName: syllabusData.name || 'N/A',
            exerciseIid: 'N/A',
            exerciseName: 'N/A'
        };

        const extracted = extractQuestionsRecursively(syllabusData, initialContext);
        globalQuestions = globalQuestions.concat(extracted);
        stats.syllabus++;
        updateStatsUI();

        addLog(`Đã trích xuất thành công ${extracted.length} câu hỏi từ Syllabus ID ${iid}.`, 'success');
    }

    // Trigger crawl process
    async function startExtraction() {
        const rawIds = cfgSyllabusIdsInput.value;
        const ids = rawIds.split(/[\n,]+/).map(id => id.trim()).filter(id => id !== '');

        const domain = cfgDomainInput.value.trim();
        const token = cfgTokenInput.value.trim();
        const uid = cfgUidInput.value.trim();
        const allowCache = cfgAllowCacheInput.value.trim();

        if (ids.length === 0) {
            alert("Vui lòng nhập ít nhất 1 Syllabus IID!");
            return;
        }

        if (!token || !uid) {
            alert("Vui lòng nhập đầy đủ Token và UID để gọi API!");
            return;
        }

        // Save inputs to storage for convenience
        chrome.storage.local.set({
            syllabusExtractorIds: rawIds,
            syllabusExtractorDomain: domain,
            syllabusExtractorAllowCache: allowCache
        });

        // Reset UI & State
        globalQuestions = [];
        currentPage = 1;
        stats = { syllabus: 0, exercises: 0, questions: 0 };
        updateStatsUI();
        logContainer.innerHTML = '';
        setRunningState(true);

        addLog(`Bắt đầu xử lý danh sách ${ids.length} Syllabus IIDs...`, 'info');

        const config = { domain, token, uid, allowCache };

        for (const iid of ids) {
            addLog(`Đang gửi yêu cầu lấy dữ liệu cho Syllabus ID: ${iid}...`, 'info');
            try {
                await fetchAndExtractSingle(iid, config);
            } catch (error) {
                addLog(`Lỗi khi xử lý Syllabus ${iid}: ${error.message}`, 'error');
                console.error(error);
            }
        }

        stats.questions = globalQuestions.length;
        updateStatsUI();

        addLog(`Hoàn tất! Tìm thấy tổng cộng ${globalQuestions.length} câu hỏi.`, 'success');
        setRunningState(false);
    }

    // Render detailed HTML result table
    function renderTable() {
        resultTbody.innerHTML = '';
        totalBadge.textContent = `Tổng ${globalQuestions.length} câu hỏi`;

        if (globalQuestions.length === 0) {
            resultTbody.innerHTML = `
                <tr>
                    <td colspan="11" class="px-4 py-8 text-center text-red-500 font-medium">
                        Không tìm thấy dữ liệu câu hỏi nào.
                    </td>
                </tr>
            `;
            return;
        }

        const totalItems = globalQuestions.length;
        const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        let startIndex = 0;
        let endIndex = totalItems;

        if (itemsPerPage !== 'all') {
            startIndex = (currentPage - 1) * itemsPerPage;
            endIndex = startIndex + itemsPerPage;
        }

        const currentItems = globalQuestions.slice(startIndex, endIndex);

        currentItems.forEach((q, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50/40 transition-colors";

            const actualIndex = startIndex + index + 1;
            const contentSnippet = q.content || '<em class="text-gray-400">(Không có nội dung)</em>';

            let answerText = getAnswers(q);
            answerText = answerText ? answerText.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '<em class="text-gray-400">(Không có đáp án)</em>';

            const hintHtml = (q.hints && q.hints[0] && q.hints[0].name) || '<em class="text-gray-400">(Không có gợi ý)</em>';
            const solHtml = (q.solutions && q.solutions[0] && q.solutions[0].name) || '<em class="text-gray-400">(Không có lời giải)</em>';

            const statusText = getStatusDescription(q.content_edit_status);
            let statusBadgeClass = "bg-gray-100 text-gray-700 border-gray-250";
            if (q.content_edit_status === 'approved') statusBadgeClass = "bg-green-50 text-green-700 border-green-200";
            else if (q.content_edit_status === 'rejected') statusBadgeClass = "bg-red-50 text-red-700 border-red-200";
            else if (q.content_edit_status === 'completed_editing') statusBadgeClass = "bg-blue-50 text-blue-700 border-blue-200";

            let skillsText = 'N/A';
            if (q.skills) {
                if (Array.isArray(q.skills)) {
                    skillsText = q.skills.map(s => typeof s === 'object' ? (s.name || s.code || JSON.stringify(s)) : s).join(', ');
                } else {
                    skillsText = typeof q.skills === 'object' ? JSON.stringify(q.skills) : q.skills;
                }
            }

            let competencyText = '<em class="text-gray-400">(Không có động từ)</em>';
            if (q.__expand && q.__expand.student_comptency_object) {
                competencyText = q.__expand.student_comptency_object.map(c => c.name || '').join(', ');
            }

            tr.innerHTML = `
                <td class="px-4 py-3 border-b text-center text-gray-450 align-top font-semibold">${actualIndex}</td>
                <td class="px-4 py-3 border-b text-gray-600 align-top font-mono font-medium">${q._source_syllabus_iid}</td>
                <td class="px-4 py-3 border-b text-gray-700 align-top whitespace-normal break-words font-medium">${q._source_syllabus_name || 'N/A'}</td>
                <td class="px-4 py-3 border-b text-gray-600 align-top font-mono">${q.id || q.iid || 'N/A'}</td>
                <td class="px-4 py-3 border-b text-gray-600 align-top">
                    <span class="inline-block bg-gray-100 text-gray-700 py-1 px-2 rounded-lg text-[10px] font-bold whitespace-nowrap border border-gray-200">${getQuestionTypeName(q.type, q.tpl_type)}</span>
                </td>
                <td class="px-4 py-3 border-b text-gray-600 align-top">
                    <span class="inline-block bg-gray-100 text-gray-700 py-1 px-2 rounded-lg text-[10px] font-bold whitespace-nowrap border border-gray-200">${q.difficulty || 'N/A'}</span>
                </td>
                <td class="px-4 py-3 border-b align-top text-center">
                    <span class="inline-block py-1 px-2 rounded-lg text-[10px] font-bold whitespace-nowrap border ${statusBadgeClass}">${statusText}</span>
                </td>
                <td class="px-4 py-3 border-b text-gray-600 whitespace-normal break-words align-top leading-normal">${skillsText}</td>
                <td class="px-4 py-3 border-b text-gray-600 whitespace-normal break-words align-top leading-normal">${competencyText}</td>
                <td class="px-4 py-3 border-b text-gray-650 align-top font-mono">${q._source_exercise_iid || 'N/A'}</td>
                <td class="px-4 py-3 border-b text-gray-700 align-top whitespace-normal break-words font-medium">${q._source_exercise_name || 'N/A'}</td>
                <td class="px-4 py-3 border-b align-top max-w-xs">
                    <div class="question-content-wrapper custom-scrollbar text-gray-800 break-words whitespace-normal text-[11px] leading-relaxed">
                        ${contentSnippet}
                    </div>
                </td>
                <td class="px-4 py-3 border-b align-top max-w-xs">
                    <div class="question-content-wrapper custom-scrollbar text-gray-700 font-mono text-[10px] break-words whitespace-normal bg-gray-50 border border-gray-200 p-2 rounded-lg leading-normal">
                        ${answerText}
                    </div>
                </td>
                <td class="px-4 py-3 border-b align-top max-w-xs">
                    <div class="question-content-wrapper custom-scrollbar text-gray-800 break-words whitespace-normal text-[11px] leading-relaxed">
                        ${hintHtml}
                    </div>
                </td>
                <td class="px-4 py-3 border-b align-top max-w-xs">
                    <div class="question-content-wrapper custom-scrollbar text-gray-800 break-words whitespace-normal text-[11px] leading-relaxed">
                        ${solHtml}
                    </div>
                </td>
            `;
            resultTbody.appendChild(tr);
        });

        renderPaginationControls(totalPages, startIndex + 1, Math.min(endIndex, totalItems), totalItems);
    }

    // Render pagination buttons and labels
    function renderPaginationControls(totalPages, startItem, endItem, totalItems) {
        if (itemsPerPage === 'all' || totalItems === 0) {
            pageNavWrapper.innerHTML = `<span class="text-gray-500 font-medium">Đang hiển thị tất cả ${totalItems} kết quả</span>`;
            return;
        }

        let html = `<span class="text-gray-400 mr-2 font-medium">Hiển thị ${startItem} - ${endItem} của ${totalItems}</span>`;

        // Prev button
        html += `
            <button id="btn-page-prev" ${currentPage === 1 ? 'disabled' : ''} 
                class="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
        `;

        // Page index text
        html += `<span class="px-2.5 font-bold text-blue-600">Trang ${currentPage} / ${totalPages}</span>`;

        // Next button
        html += `
            <button id="btn-page-next" ${currentPage === totalPages ? 'disabled' : ''} 
                class="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        `;

        pageNavWrapper.innerHTML = html;

        // Add event listeners to the generated buttons
        const btnPagePrev = document.getElementById('btn-page-prev');
        const btnPageNext = document.getElementById('btn-page-next');

        if (btnPagePrev) {
            btnPagePrev.addEventListener('click', () => {
                currentPage--;
                renderTable();
                document.querySelector('.overflow-x-auto').scrollTop = 0;
            });
        }
        if (btnPageNext) {
            btnPageNext.addEventListener('click', () => {
                currentPage++;
                renderTable();
                document.querySelector('.overflow-x-auto').scrollTop = 0;
            });
        }
    }

    // Change number of items per page
    itemsPerPageSelect.addEventListener('change', () => {
        const val = itemsPerPageSelect.value;
        itemsPerPage = val === 'all' ? 'all' : parseInt(val, 10);
        currentPage = 1; // Reset to page 1
        renderTable();
    });

    // Clear logs screen
    btnClearLog.addEventListener('click', () => {
        logContainer.innerHTML = '<p class="text-gray-550 italic log-placeholder">Đã xóa sạch console log.</p>';
    });

    // Export JSON file format
    function downloadJSON() {
        if (globalQuestions.length === 0) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalQuestions, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `syllabus_questions_${new Date().getTime()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addLog(`Đã xuất và tải tệp JSON thành công.`, 'success');
    }

    // Export formatted XLSX file using SheetJS
    function downloadExcel() {
        if (globalQuestions.length === 0) {
            addLog('Không có câu hỏi để xuất Excel.', 'error');
            return;
        }

        addLog('Đang chuẩn bị dữ liệu xuất Excel...', 'info');

        // Map questions to flat columns matching the visual table structure
        const rows = globalQuestions.map((q, idx) => {
            let optionsText = '';
            let correctAnswers = '';

            // Extract question types (copied and updated from question-folder-extractor/script.js)
            if (q.type === 2 || q.type === 17) {
                // Multiple choice & select
                const choices = q.mc_answers || q.answers2 || [];
                optionsText = choices.map((choice, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return `${letter}. ${htmlToPlainText(choice.text)}`;
                }).join('\n');

                const correctLetters = [];
                choices.forEach((choice, idx) => {
                    if (choice.is_answer === 1) {
                        correctLetters.push(String.fromCharCode(65 + idx));
                    }
                });
                correctAnswers = correctLetters.join(', ');

            } else if (q.type === 1) {
                // Fill-in / Typing
                optionsText = '';
                const blanks = q.answers || [];
                correctAnswers = blanks.map((blankOptions, idx) => {
                    const optionsStr = Array.isArray(blankOptions) ? blankOptions.join(' | ') : blankOptions;
                    return `Ô trống ${idx + 1}: ${optionsStr}`;
                }).join('; ');

            } else if (q.type === 18) {
                // Likert True/False assertions
                const assertions = q.likert_questions || [];
                const ansOptions = q.likert_answers || [];
                const correctMapping = q.likert_correct_answers || [];

                optionsText = assertions.map((assertion, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return `${letter}. ${htmlToPlainText(assertion.content)}`;
                }).join('\n');

                const mappingList = [];
                assertions.forEach((assertion, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const correctIndices = correctMapping[idx] || [];
                    const correctLabels = correctIndices.map(cIdx => {
                        const numIdx = parseInt(cIdx, 10);
                        return ansOptions[numIdx] ? htmlToPlainText(ansOptions[numIdx].content) : cIdx;
                    });
                    mappingList.push(`${letter}: ${correctLabels.join(' | ')}`);
                });
                correctAnswers = mappingList.join('; ');

            } else if (q.type === 4) {
                // Matching pairs
                const lPairs = q.l_pair || [];
                const rPairs = q.r_pair || [];
                const correctIndices = q.answers || [];

                optionsText = lPairs.map((lItem, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return `${letter}. ${htmlToPlainText(lItem.content)}`;
                }).join('\n');

                const matchingList = [];
                lPairs.forEach((lItem, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const matchedRId = correctIndices[idx] ? correctIndices[idx][0] : null;
                    if (matchedRId) {
                        const matchedRItem = rPairs.find(r => r.id === matchedRId);
                        const rText = matchedRItem ? htmlToPlainText(matchedRItem.content) : matchedRId;
                        matchingList.push(`${letter} ➔ ${rText}`);
                    }
                });
                correctAnswers = matchingList.join('; ');

            } else if (q.type === 22) {
                // Inline dropdowns (mddm)
                const options = q.mddm_list_answer || [];
                optionsText = options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return `${letter}. ${htmlToPlainText(option.content)}`;
                }).join('\n');

                const mappingData = q.mddm_mapping_table_data?.dataSource || [];
                const correctList = [];
                if (mappingData.length > 0) {
                    const rowMap = mappingData[0];
                    Object.keys(rowMap).forEach(key => {
                        if (key !== 'iid') {
                            const selectedAnswers = rowMap[key] || [];
                            const formattedAns = selectedAnswers.map(ansWrapper => {
                                const ansId = ansWrapper[0];
                                const matchedOption = options.find(o => o.id === ansId);
                                return matchedOption ? htmlToPlainText(matchedOption.content) : ansId;
                            });
                            correctList.push(`Vị trí ${parseInt(key) + 1}: ${formattedAns.join(' | ')}`);
                        }
                    });
                }
                correctAnswers = correctList.join('; ');
            }

            // Skills formatting
            let skillsText = 'N/A';
            if (q.skills) {
                if (Array.isArray(q.skills)) {
                    skillsText = q.skills.map(s => typeof s === 'object' ? `${s.name || ''} (${s.code || ''})` : s).join(', ');
                } else {
                    skillsText = typeof q.skills === 'object' ? JSON.stringify(q.skills) : q.skills;
                }
            }

            let competencyText = '';
            if (q.__expand && q.__expand.student_comptency_object) {
                competencyText = q.__expand.student_comptency_object.map(c => c.name || '').join(', ');
            }

            // Hint and Explanation extraction
            const hintHtml = (q.hints && q.hints[0] && q.hints[0].name) || '';
            const solHtml = (q.solutions && q.solutions[0] && q.solutions[0].name) || '';

            return {
                "STT": idx + 1,
                "Syllabus IID": cleanExcelCell(q._source_syllabus_iid),
                "Syllabus Name": cleanExcelCell(q._source_syllabus_name),
                "ID câu hỏi": cleanExcelCell(q.id || q.iid),
                "Loại câu hỏi": cleanExcelCell(getQuestionTypeName(q.type, q.tpl_type)),
                "Độ khó": cleanExcelCell(q.difficulty),
                "Trạng thái": cleanExcelCell(getStatusDescription(q.content_edit_status)),
                "Kỹ năng": cleanExcelCell(skillsText),
                "Động từ": cleanExcelCell(competencyText),
                "Exercise IID": cleanExcelCell(q._source_exercise_iid),
                "Exercise Name": cleanExcelCell(q._source_exercise_name),
                "Nội dung (Không HTML)": cleanExcelCell(htmlToPlainText(q.content)),
                "Nội dung (HTML)": cleanExcelCell(q.content),
                "Các lựa chọn": cleanExcelCell(optionsText),
                "Đáp án đúng (Định dạng)": cleanExcelCell(correctAnswers),
                "Giải thích (Không HTML)": cleanExcelCell(htmlToPlainText(solHtml)),
                "Giải thích (HTML)": cleanExcelCell(solHtml),
                "Gợi ý (Không HTML)": cleanExcelCell(htmlToPlainText(hintHtml)),
                "Gợi ý (HTML)": cleanExcelCell(hintHtml),
                "Đáp án (JSON thô)": cleanExcelCell(getAnswers(q))
            };
        });

        try {
            // Create Workbook & Worksheet using SheetJS
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Syllabus Questions");

            // Generate binary representation and download
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

            function s2ab(s) {
                const buf = new ArrayBuffer(s.length);
                const view = new Uint8Array(buf);
                for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
                return buf;
            }

            const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);

            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", `syllabus_questions_${new Date().getTime()}.xlsx`);
            document.body.appendChild(downloadAnchorNode);

            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);

            addLog(`Đã xuất và tải tệp Excel thành công (${globalQuestions.length} câu hỏi).`, 'success');
        } catch (error) {
            addLog(`Lỗi xuất Excel: ${error.message}`, 'error');
            console.error(error);
        }
    }

    // Register button event handlers
    btnStart.addEventListener('click', startExtraction);
    btnDownloadJson.addEventListener('click', downloadJSON);
    btnDownloadExcel.addEventListener('click', downloadExcel);
});
