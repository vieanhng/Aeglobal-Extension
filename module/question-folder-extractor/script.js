// LotusLMS Question Extractor script.js
document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let isRunning = false;
    let allResults = [];
    let stats = { folders: 0, banks: 0, questions: 0 };
    let currentUid = '';
    let currentToken = '';

    // DOM Elements
    const displayUid = document.getElementById('displayUid');
    const displayToken = document.getElementById('displayToken');
    const displaySavedDate = document.getElementById('displaySavedDate');

    const cfgDomainInput = document.getElementById('cfg-domain');
    const cfgParentIdInput = document.getElementById('cfg-parentId');
    const cfgFilterInput = document.getElementById('cfg-filter');

    const btnStart = document.getElementById('btn-start');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnDownloadJson = document.getElementById('btn-download-json');
    const btnDownloadExcel = document.getElementById('btn-download-excel');

    const iconPlay = document.getElementById('icon-play');
    const iconLoading = document.getElementById('icon-loading');
    const textStart = document.getElementById('text-start');

    const statFolders = document.getElementById('stat-folders');
    const statBanks = document.getElementById('stat-banks');
    const statQuestions = document.getElementById('stat-questions');

    const logContainer = document.getElementById('log-container');
    const previewSection = document.getElementById('preview-section');
    const previewContainer = document.getElementById('preview-container');
    const previewTotalBadge = document.getElementById('preview-total-badge');

    // Load credentials and inputs from storage
    SharedAuth.loadAuthData((authData) => {
        currentUid = authData.uid;
        currentToken = authData.token;

        SharedAuth.displayAuthData(authData, {
            displayUid,
            displayToken,
            displaySavedDate
        });

        // Load previously saved inputs if any
        chrome.storage.local.get(['extractorDomain', 'extractorParentId', 'extractorFilter'], (data) => {
            if (data.extractorDomain) cfgDomainInput.value = data.extractorDomain;
            if (data.extractorParentId) cfgParentIdInput.value = data.extractorParentId;
            if (data.extractorFilter) cfgFilterInput.value = data.extractorFilter;
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

    // UI State Helpers
    function updateStatsUI() {
        statFolders.innerText = stats.folders;
        statBanks.innerText = stats.banks;
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
            textStart.innerText = 'Đang trích xuất...';
            btnDownloadJson.style.display = 'none';
            btnDownloadExcel.style.display = 'none';
            previewSection.classList.add('hidden');
        } else {
            btnStart.classList.replace('bg-gray-400', 'bg-gray-900');
            btnStart.classList.replace('cursor-not-allowed', 'hover:bg-gray-800');
            btnStart.disabled = false;
            iconPlay.style.display = 'block';
            iconLoading.style.display = 'none';
            textStart.innerText = 'Bắt đầu trích xuất';
            if (allResults.length > 0) {
                btnDownloadJson.style.display = 'flex';
                btnDownloadExcel.style.display = 'flex';
                showPreview();
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

    // Build Form Data for LotusLMS APIs
    function buildFormData(url, config) {
        const fd = new FormData();
        fd.append("_sand_web_url", url);
        fd.append("_sand_device_uuid", generateUUID());
        fd.append("_sand_token", currentToken);
        fd.append("_sand_uiid", currentUid);
        return fd;
    }

    // Fetch folder content
    async function fetchFolderContent(folderId, config) {
        const url = `https://cloud-beta-api.lotuslms.com/content/api/search-content?_sand_get_total=0&parent_id=${folderId}&items_per_page=-1&depth=1&submit=1&page=1&_sand_ajax=1&_sand_platform=3&_sand_readmin=1&_sand_is_wan=false&_sand_domain=${config.domain}&allow_cache_api_cdn=1`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: buildFormData(`https://${config.domain}.lotuslms.com/admin/content-manager/folder/${folderId}`, config)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.result || [];
        } catch (error) {
            addLog(`Lỗi khi đọc thư mục ${folderId}: ${error.message}`, 'error');
            return [];
        }
    }

    // Fetch questions from bank
    async function fetchQuestionsFromBank(bankIid, itemId, config) {
        const url = `https://cloud-beta-api.lotuslms.com/question-bank/search-questions?_sand_get_total=0&question_bank%5B%5D=${bankIid}&submit=1&page=1&items_per_page=-1&_sand_ajax=1&_sand_platform=3&_sand_readmin=1&_sand_is_wan=false&_sand_domain=${config.domain}&allow_cache_api_cdn=1`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: buildFormData(`https://${config.domain}.lotuslms.com/admin/content-manager/folder/${itemId}`, config)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.result || [];
        } catch (error) {
            addLog(`Lỗi tải câu hỏi từ Ngân hàng ${bankIid}: ${error.message}`, 'error');
            return [];
        }
    }

    // Recursive crawler
    async function processRecursively(currentFolderId, config) {
        addLog(`Đang quét thư mục: ${currentFolderId}...`, 'info');
        const items = await fetchFolderContent(currentFolderId, config);

        let localQuestions = [];

        for (const item of items) {
            if (item.type === 'folder') {
                stats.folders++;
                updateStatsUI();
                addLog(`Phát hiện thư mục con: ${item.name} (${item.id})`, 'info');
                const childQuestions = await processRecursively(item.id, config);
                localQuestions = localQuestions.concat(childQuestions);
            }
            else if (item.type === 'file' && item.target_item_type === 'question_bank') {
                stats.banks++;
                updateStatsUI();
                addLog(`Phát hiện Ngân hàng câu hỏi: ${item.name} (IID: ${item.target_item_iid})`, 'success');

                let questions = await fetchQuestionsFromBank(item.target_item_iid, item.id, config);

                // Filter by keyword in raw JSON string if filter keyword specified
                if (config.filterKeyword) {
                    const originalCount = questions.length;
                    questions = questions.filter(q => JSON.stringify(q).toLowerCase().includes(config.filterKeyword.toLowerCase()));
                    if (originalCount !== questions.length) {
                        addLog(`Bộ lọc: Giữ lại ${questions.length}/${originalCount} câu hỏi chứa "${config.filterKeyword}"`, 'info');
                    }
                }

                // Enrich question object with source metadata
                const enrichedQuestions = questions.map(q => ({
                    ...q,
                    _source_folder_name: item.name,
                    _source_folder_id: currentFolderId,
                    _source_bank_iid: item.target_item_iid
                }));

                stats.questions += questions.length;
                updateStatsUI();
                addLog(`Đã tải thành công ${questions.length} câu hỏi từ [${item.name}]`, 'success');
                localQuestions = localQuestions.concat(enrichedQuestions);
            }
        }
        return localQuestions;
    }

    // Crawling trigger
    async function startExtraction() {
        const domain = cfgDomainInput.value.trim();
        const parentId = cfgParentIdInput.value.trim();
        const filterKeyword = cfgFilterInput.value.trim();

        if (!SharedAuth.validateAuth(currentUid, currentToken)) {
            addLog('Lỗi: Chưa có thông tin xác thực (UID và Token trống). Vui lòng đồng bộ từ popup extension.', 'error');
            alert('Vui lòng đồng bộ thông tin xác thực từ extension popup trước!');
            return;
        }

        if (!parentId) {
            addLog('Lỗi: Vui lòng nhập ID thư mục cần quét.', 'error');
            alert('Vui lòng nhập ID thư mục cần quét!');
            return;
        }

        // Save inputs to storage for convenience
        chrome.storage.local.set({
            extractorDomain: domain,
            extractorParentId: parentId,
            extractorFilter: filterKeyword
        });

        const config = { domain, parentId, filterKeyword };

        // Reset UI & State
        setRunningState(true);
        logContainer.innerHTML = '';
        allResults = [];
        stats = { folders: 0, banks: 0, questions: 0 };
        updateStatsUI();

        addLog(`Bắt đầu trích xuất đệ quy từ thư mục gốc: ${parentId}`, 'info');

        try {
            allResults = await processRecursively(parentId, config);
            addLog(`Trích xuất hoàn tất! Tìm thấy tổng cộng ${allResults.length} câu hỏi.`, 'success');
        } catch (error) {
            addLog(`Lỗi hệ thống trong lúc quét: ${error.message}`, 'error');
        } finally {
            setRunningState(false);
        }
    }

    // Show visual preview of top 5 questions with dynamic type formatting
    function showPreview() {
        previewContainer.innerHTML = '';
        previewTotalBadge.innerText = `Tổng ${allResults.length} câu hỏi`;
        previewSection.classList.remove('hidden');

        // Show last 5 questions
        const previewList = allResults.slice(-5);
        previewList.forEach((q) => {
            const div = document.createElement('div');
            div.className = 'p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5 text-xs';

            const header = document.createElement('div');
            header.className = 'flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider';
            header.innerHTML = `
                <span>ID: ${q.id} | Ngân hàng: ${q._source_folder_name || 'N/A'}</span>
                <span class="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md font-sans text-[9px] font-bold">${getQuestionTypeName(q.type, q.tpl_type)}</span>
            `;

            const body = document.createElement('div');
            body.className = 'text-gray-800 font-medium whitespace-pre-wrap leading-relaxed';
            body.innerHTML = q.content; // Render HTML content correctly in preview

            let answersHtml = '';
            if (q.type === 2 || q.type === 17) {
                const answers = q.mc_answers || q.answers2 || [];
                answersHtml = `<ul class="list-disc pl-5 text-[11px] text-gray-500 space-y-1 mt-1">` +
                    answers.map((ans, idx) => {
                        const isCorrect = ans.is_answer === 1;
                        return `<li class="${isCorrect ? 'text-green-600 font-bold' : 'text-gray-400'}">Lựa chọn ${String.fromCharCode(65 + idx)}: ${ans.text} ${isCorrect ? '✓' : ''}</li>`;
                    }).join('') + `</ul>`;
            } else if (q.type === 1) {
                const blanks = q.answers || [];
                answersHtml = `<div class="text-[11px] text-green-600 font-bold mt-1 font-mono">Đáp án điền khuyết: ` +
                    blanks.map((b, idx) => `[Ô ${idx + 1}: ${Array.isArray(b) ? b.join(' | ') : b}]`).join(', ') +
                    `</div>`;
            } else if (q.type === 18) {
                const assertions = q.likert_questions || [];
                const ansOptions = q.likert_answers || [];
                const correctMapping = q.likert_correct_answers || [];
                answersHtml = `<ul class="list-decimal pl-5 text-[11px] text-gray-500 space-y-1 mt-1 font-mono">` +
                    assertions.map((a, idx) => {
                        const correctIndices = correctMapping[idx] || [];
                        const correctLabels = correctIndices.map(cIdx => {
                            const numIdx = parseInt(cIdx, 10);
                            return ansOptions[numIdx] ? ansOptions[numIdx].content : cIdx;
                        });
                        return `<li>${htmlToPlainText(a.content)} ➔ <span class="text-green-600 font-bold">${correctLabels.join(' | ')}</span></li>`;
                    }).join('') + `</ul>`;
            } else if (q.type === 4) {
                const lPairs = q.l_pair || [];
                const rPairs = q.r_pair || [];
                const correctIndices = q.answers || [];
                answersHtml = `<ul class="list-disc pl-5 text-[11px] text-gray-500 space-y-1 mt-1 font-mono">` +
                    lPairs.map((lItem, idx) => {
                        const matchedRId = correctIndices[idx] ? correctIndices[idx][0] : null;
                        let rText = matchedRId || '';
                        if (matchedRId) {
                            const matchedRItem = rPairs.find(r => r.id === matchedRId);
                            rText = matchedRItem ? matchedRItem.content : matchedRId;
                        }
                        return `<li>${htmlToPlainText(lItem.content)} ➔ <span class="text-green-600 font-bold">${htmlToPlainText(rText)}</span></li>`;
                    }).join('') + `</ul>`;
            } else if (q.type === 22) {
                const options = q.mddm_list_answer || [];
                const mappingData = q.mddm_mapping_table_data?.dataSource || [];
                let correctList = [];
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
                answersHtml = `<div class="text-[11px] text-green-600 font-bold mt-1 font-mono">Nối bảng/Dropdown: ${correctList.join('; ')}</div>`;
            }

            const answersContainer = document.createElement('div');
            answersContainer.innerHTML = answersHtml;

            div.appendChild(header);
            div.appendChild(body);
            div.appendChild(answersContainer);
            previewContainer.appendChild(div);
        });
    }

    // Export to JSON file
    function downloadJSON() {
        const parentId = cfgParentIdInput.value.trim();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allResults, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `lotus_questions_${parentId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addLog(`Đã xuất và tải tệp JSON.`, 'success');
    }

    // Export to Excel file with choices grouped in one column and answers in another
    function downloadExcel() {
        const parentId = cfgParentIdInput.value.trim();
        if (allResults.length === 0) {
            addLog('Không có câu hỏi để xuất Excel.', 'error');
            return;
        }

        addLog('Đang chuẩn bị dữ liệu xuất Excel...', 'info');

        // Map questions array to flat rows with fixed columns
        const rows = allResults.map(q => {
            const row = {
                "Mã câu hỏi (ID)": q.id || q.iid || '',
                "Thư mục nguồn": q._source_folder_name || '',
                "ID thư mục nguồn": q._source_folder_id || '',
                "IID ngân hàng": q._source_bank_iid || '',
                "Loại câu hỏi": getQuestionTypeName(q.type, q.tpl_type),
                "Độ khó": q.difficulty || '',
                "Tags": (q.tags || []).join(', '),
                "Kỹ năng": (q.skills || []).map(s => `${s.name || ''} (${s.code || ''})`).join(', '),
                "Năng lực học sinh": (q.__expand?.student_comptency_object || []).map(c => c.name || '').join(', '),
                "Nội dung (Không HTML)": htmlToPlainText(q.content),
                "Nội dung (HTML)": q.content || ''
            };

            let optionsText = '';
            let correctAnswers = '';

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
                // Fill-in / Typing. correct answer is answers field
                optionsText = ''; // No options for typing questions
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

            row["Các lựa chọn"] = optionsText;
            row["Đáp án đúng"] = correctAnswers;

            // Hint and Explanation extraction
            const hintHtml = (q.hints && q.hints[0] && q.hints[0].name) || '';
            const solHtml = (q.solutions && q.solutions[0] && q.solutions[0].name) || '';

            row["Giải thích (Không HTML)"] = htmlToPlainText(solHtml);
            row["Giải thích (HTML)"] = solHtml;
            row["Gợi ý (Không HTML)"] = htmlToPlainText(hintHtml);
            row["Gợi ý (HTML)"] = hintHtml;

            return row;
        });

        try {
            // 3. Create Workbook and Worksheet with SheetJS
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Danh sách câu hỏi");

            // 4. Generate binary data and trigger click download
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
            downloadAnchorNode.setAttribute("download", `lotus_questions_${parentId}.xlsx`);
            document.body.appendChild(downloadAnchorNode);

            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);

            addLog(`Đã xuất và tải tệp Excel thành công (${allResults.length} câu hỏi).`, 'success');
        } catch (error) {
            addLog(`Lỗi xuất Excel: ${error.message}`, 'error');
            console.error(error);
        }
    }

    // Event Listeners
    btnStart.addEventListener('click', startExtraction);

    btnClearLog.addEventListener('click', () => {
        logContainer.innerHTML = '<p class="text-gray-550 italic log-placeholder">Đã xóa sạch console log.</p>';
    });

    btnDownloadJson.addEventListener('click', downloadJSON);
    btnDownloadExcel.addEventListener('click', downloadExcel);
});
