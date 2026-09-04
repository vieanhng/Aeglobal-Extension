# AGENT.MD — Aeglobal Tools Chrome Extension

## Tổng quan dự án

**Tên:** Aeglobal Tools  
**Phiên bản:** 3.1.0  
**Loại:** Chrome Extension (Manifest V3)  
**Mục đích:** Công cụ tự động hóa cho hệ thống quản lý học tập (LMS) tại `aeglobal.lotuslms.com` và `aeglobal2.lotuslms.com`.

Extension cung cấp các module chức năng để quản lý **Ngân hàng câu hỏi (Question Bank)** trên nền tảng LotusLMS, bao gồm: trích xuất câu hỏi (folder, syllabus, ngân hàng đề), trích xuất cây thư mục, nhân bản, di chuyển, tìm kiếm, xóa hàng loạt, quản lý thẻ (tags), phân quyền hàng loạt và tra cứu IID ngân hàng thông qua API nội bộ của LotusLMS.

---

## Cấu trúc dự án

```
Aeglobal Extension/
├── manifest.json              # Cấu hình extension (Manifest V3)
├── background.js              # Service worker — xử lý tất cả API calls và CORS
├── popup.html                 # Giao diện popup chính (Tabs, Quick Search, Categorized cards)
├── popup.js                   # Logic của popup (xác thực, tìm kiếm, bộ lọc tabs, điều hướng)
├── content_script.js          # Script inject vào trang LotusLMS (IID badge overlay)
├── options.html               # Trang tùy chọn
├── icons/                     # Icon extension (16, 32, 48, 128px)
├── lib/
│   ├── tailwind.css           # Tailwind CSS (full)
│   ├── tailwind.min.css       # Tailwind CSS (minified)
│   └── xlsx.full.min.js       # Thư viện xuất Excel
└── module/
    ├── shared-auth.js         # Module dùng chung: xác thực UID/Token
    ├── shared-bank-utils.js   # Module dùng chung: xử lý & resolve link ngân hàng/shortcode
    ├── shared-ui.js           # Module dùng chung: UI helpers, logging, loading
    ├── question-folder-extractor/     # [1] Xuất câu hỏi từ thư mục (Excel/JSON)
    ├── folder-structure-exporter/     # [2] Xuất sơ đồ cây cấu trúc thư mục (Excel/JSON)
    ├── question-syllabus-extractor/   # [3] Xuất câu hỏi từ Syllabus (Excel/JSON)
    ├── question-exporter/             # [4] Xuất câu hỏi từ ngân hàng đề (Excel/JSON)
    ├── question-tagger/               # [5] Quản lý thẻ câu hỏi (Thêm/Xóa/Đổi thẻ hàng loạt)
    ├── phanquyen/                     # [6] Phân quyền hàng loạt cho thư mục/ngân hàng
    ├── question-duplicator/           # [7] Nhân bản câu hỏi vào nhiều ngân hàng đích
    ├── question-move/                 # [8] Di chuyển câu hỏi hàng loạt giữa các ngân hàng
    ├── question-deleter/              # [9] Xóa câu hỏi hàng loạt (dev-steve-api)
    ├── sidepanel/                     # [10] SidePanel xem câu hỏi trực tiếp trên trang LMS
    ├── question-finder/               # [11] Tìm ngân hàng chứa câu hỏi theo ID
    └── bank-iid-viewer/               # [12] Tra cứu mã IID số thực từ link/shortcode
```

---

## Kiến trúc & Luồng dữ liệu

### Kiến trúc tổng thể

```
[Trang LotusLMS] ──(localStorage)──> [popup.js] ──(chrome.storage.local)──> [Modules]
                                          │
                                          ▼
                                    [background.js]  ←──── (chrome.runtime.sendMessage)
                                          │
                                          ▼
                                  [LotusLMS Cloud API]
                                  https://cloud-beta-api.lotuslms.com
```

### Luồng xác thực (Auth Flow)

1. Người dùng mở popup khi đang ở trang `aeglobal.lotuslms.com`
2. `popup.js` tự động chạy `autoFetchAuthOnOpen()` — inject script vào tab hiện tại
3. Script đọc `localStorage["persist:root"]` để lấy `token` và `iid` (UID)
4. Thông tin được gửi đến `background.js` qua `chrome.runtime.sendMessage({ action: "setAuthData" })`
5. `background.js` lưu vào `chrome.storage.local`
6. Các module đọc auth qua `SharedAuth.loadAuthData()`
7. **Auth tự động hết hạn sau 24 giờ** và bị xóa khi mở popup

### Message Passing (background.js)

| Action | Mô tả |
|---|---|
| `setAuthData` | Lưu UID, Token, ngày lưu vào storage |
| `duplicateAndMoveQuestions` | Nhân bản + di chuyển + gắn tag câu hỏi hàng loạt |
| `moveQuestions` | Di chuyển câu hỏi sang ngân hàng khác |
| `findQuestion` | Tìm ngân hàng chứa câu hỏi theo ID |
| `exportQuestions` | Xuất tất cả ID câu hỏi từ một ngân hàng |
| `deleteQuestion` | Xóa câu hỏi theo ID (gọi `dev-steve-api`) |
| `updateQuestionTags` | Cập nhật thẻ câu hỏi theo ID (Append, Remove, Replace) |

---

## API Endpoints

**Base URL:** `https://cloud-beta-api.lotuslms.com`  
**Base URL (Delete):** `https://dev-steve-api.lotuslms.com`  
**Domain param:** `_sand_domain=aeglobal`

| Endpoint | Phương thức | Chức năng |
|---|---|---|
| `/site/index/deep-clone` | POST (FormData) | Nhân bản câu hỏi (`iid`, `ntype=question`) |
| `/question-bank/editor/move-questions` | POST (FormData) | Di chuyển câu hỏi vào ngân hàng |
| `/question/index/search` | POST (GET params) | Tìm kiếm câu hỏi theo ID hoặc ngân hàng |
| `/question-bank/editor/fetch-node` | POST (GET params) | Lấy thông tin ngân hàng theo IID |
| `/exercise/editor/update-question` | POST (FormData) | Cập nhật tags cho câu hỏi |
| `/content/api/item-detail` | POST (GET params) | Resolve shortcode sang IID thực |
| `/question/delete` *(dev-steve-api)* | POST (FormData) | Xóa câu hỏi theo ID |

**Auth params (bắt buộc trên mọi request):**
- `_sand_token` — Bearer token của người dùng
- `_sand_uiid` — User IID (UID)
- `_sand_domain` — Luôn là `aeglobal`

---

## Các Module Chi Tiết

### 1. Question Duplicator (`module/question-duplicator/`)

**Chức năng:** Nhân bản một danh sách câu hỏi vào nhiều ngân hàng đích.

**Luồng xử lý:**
1. Nhận danh sách **Question IDs** và danh sách **Bank Links**
2. Resolve mỗi bank link sang IID thực (qua `SharedBankUtils.processBankLink`)
3. Với mỗi ngân hàng đích, gửi `duplicateAndMoveQuestions` lên background:
   - **Step 1:** Nhân bản từng câu hỏi (`/site/index/deep-clone`)
   - **Step 2:** Di chuyển câu hỏi nhân bản vào ngân hàng đích
   - **Step 3:** Gắn auto-tag `variant of {originalId}` + user-defined tags
4. Hiển thị log real-time qua `chrome.runtime.connect({ name: "logChannel" })`

**Tính năng đặc biệt:**
- Validate bank links trước khi chạy
- Real-time log streaming từ background
- Lưu inputs vào `chrome.storage.local` để phục hồi sau

---

### 2. Question Mover (`module/question-move/`)

**Chức năng:** Di chuyển hàng loạt câu hỏi sang một ngân hàng đích.

**Luồng xử lý:**
1. Nhận danh sách **Question IDs** và **Bank Link/IID**
2. Resolve bank link → IID thực
3. Gửi `moveQuestions` lên background → `moveQuestionsToBank()`
4. Hiển thị kết quả dạng bảng

**Lưu ý:** Di chuyển toàn bộ danh sách trong một lần gọi API (không phải từng câu một).

---

### 3. Question Finder (`module/question-finder/`)

**Chức năng:** Tìm ngân hàng chứa câu hỏi từ danh sách ID.

**Luồng xử lý:**
1. Nhận danh sách **Question IDs** (một ID mỗi dòng)
2. Với mỗi ID, gửi `findQuestion` lên background:
   - Search câu hỏi → lấy `question_bank` ID
   - Fetch thông tin ngân hàng để lấy tên
3. Hiển thị kết quả dạng bảng với link trực tiếp đến ngân hàng

---

### 4. Question Exporter (`module/question-exporter/`)

**Chức năng:** Xuất tất cả ID câu hỏi từ nhiều ngân hàng.

**Luồng xử lý:**
1. Nhận danh sách **Bank Links/IDs**
2. Với mỗi ngân hàng, gửi `exportQuestions` lên background:
   - Resolve shortcode nếu cần
   - Fetch bank info để lấy tên
   - Search tất cả câu hỏi với `items_per_page=-1`
3. Hiển thị kết quả dạng card, cho phép copy từng ngân hàng hoặc tất cả

---

### 5. Bank IID Viewer (`module/bank-iid-viewer/`)

**Chức năng:** Tra cứu IID thực (số) của ngân hàng câu hỏi từ link hoặc shortcode.

**Luồng xử lý:**
1. Nhận danh sách **Bank Links** (mỗi dòng một link, hỗ trợ URL đầy đủ, shortcode, hoặc ID số)
2. Với mỗi link, gọi `SharedBankUtils.processBankLink()` để:
   - Extract ID từ URL (nếu là link `/question-bank/123`)
   - Resolve shortcode (nếu là link `/folder/abc` hoặc chữ thuần)
   - Lấy tên ngân hàng qua API `/question-bank/editor/fetch-node`
3. Hiển thị kết quả dạng bảng: Input gốc | Tên ngân hàng | IID | Trạng thái
4. Hỗ trợ copy từng IID hoặc copy tất cả IID

**Lưu ý:** Module này gọi API trực tiếp qua `SharedBankUtils` (không cần action mới trong `background.js`) vì `shared-bank-utils.js` chạy trong context của extension page (không bị CORS).

---

### 6. Question Tagger (`module/question-tagger/`)

**Chức năng:** Quản lý gắn, gỡ, thay thế, hoặc ghi đè thẻ câu hỏi hàng loạt.

**4 Chế độ hoạt động:**
- **Thêm vào (Append):** Gộp thêm thẻ mới vào danh sách thẻ hiện có của câu hỏi (loại bỏ trùng lặp).
- **Xóa thẻ (Remove):** Kiểm tra câu hỏi có chứa thẻ chỉ định hay không, nếu có thì gỡ bỏ thẻ đó và cập nhật lại. Nếu câu hỏi không chứa thẻ cần xóa, hệ thống sẽ tự động bỏ qua (Skipped).
- **Đổi thẻ A → B (Overwrite):** Ghi đè thẻ A bằng thẻ B, giữ nguyên tất cả các thẻ khác của câu hỏi. Nếu câu hỏi không chứa thẻ A, tự động bỏ qua.
- **Thay thế tất cả (Replace):** Thay thế toàn bộ danh sách thẻ hiện tại bằng danh sách thẻ mới.

**Luồng xử lý:**
1. Nhận danh sách **Question IDs** và cấu hình thẻ thao tác.
2. Với mỗi câu hỏi:
   - Tìm câu hỏi qua `/question/index/search` để lấy thông tin và danh sách tags hiện tại.
   - Xử lý mảng tags theo chế độ (`append`, `remove`, `overwrite`, `replace`).
   - Gửi yêu cầu cập nhật qua `/exercise/editor/update-question`.
3. Hỗ trợ chạy theo Batch song song và thiết lập độ trễ (delay ms).
4. Hiển thị bảng kết quả chi tiết, thanh tiến trình, log real-time và xuất CSV.

---

## Module Dùng Chung (Shared Modules)

### `shared-auth.js` — SharedAuth

```javascript
SharedAuth.loadAuthData(callback)         // Đọc auth từ chrome.storage.local
SharedAuth.displayAuthData(data, elements) // Cập nhật UI hiển thị auth
SharedAuth.validateAuth(uid, token)        // Kiểm tra auth có đủ không
```

### `shared-bank-utils.js` — SharedBankUtils

```javascript
SharedBankUtils.extractBankId(input)
// Trả về: { id: string, needsResolve: boolean }
// Hỗ trợ: numeric ID, URL /question-bank/123, URL /folder/abc, shortcode

SharedBankUtils.resolveBankShortcode(shortcode, uid, token)
// Gọi /content/api/item-detail để resolve shortcode → IID

SharedBankUtils.getBankInfo(bankId, uid, token)
// Gọi /question-bank/editor/fetch-node để lấy tên ngân hàng

SharedBankUtils.processBankLink(bankLink, uid, token)
// Pipeline đầy đủ: extract → resolve nếu cần → lấy tên
// Trả về: { success, id, name, originalInput, error }
```

### `shared-ui.js` — SharedUI

```javascript
SharedUI.parseMultilineInput(value)        // Tách input nhiều dòng thành mảng
SharedUI.showMessage(div, p, msg, type)    // Hiển thị thông báo (success/error/info)
SharedUI.resetUI({ messageP, statusResultDiv, ... }) // Reset trạng thái UI
SharedUI.setProcessing(btn, text, spinner, isProcessing, label) // Toggle trạng thái loading
SharedUI.sendBackgroundMessage(msg, onSuccess, onError) // Gửi message đến background
```

---

## Permissions

```json
{
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [
    "https://aeglobal.lotuslms.com/*",
    "https://aeglobal2.lotuslms.com/*"
  ]
}
```

- **`activeTab`:** Để inject script đọc localStorage của tab đang mở
- **`storage`:** Lưu auth token và inputs của người dùng
- **`scripting`:** Thực thi `chrome.scripting.executeScript()` để đọc auth từ trang

---

## Cách hoạt động của Bank Link Resolution

Module `SharedBankUtils` xử lý nhiều định dạng đầu vào:

| Input | needsResolve | Xử lý |
|---|---|---|
| `12345` (số thuần) | `false` | Dùng trực tiếp |
| `https://aeglobal.lotuslms.com/admin/question-bank/12345` | `false` | Extract ID từ URL |
| `https://aeglobal.lotuslms.com/admin/folder/abc123` | `true` | Gọi `/content/api/item-detail` |
| `abc123` (shortcode chữ) | `true` | Gọi `/content/api/item-detail` |

---

## Real-time Logging (Question Duplicator)

Background script dùng `chrome.runtime.onConnect` để stream log về UI:

```
[UI Page] ─── chrome.runtime.connect({ name: "logChannel" }) ───> [background.js]
              <─── port.postMessage({ type: 'log', message, logType }) ──────────
```

Các log type: `info`, `success`, `error`, `warning`, `header`

---

## Quy ước code

- Toàn bộ code viết bằng **Vanilla JavaScript** (không framework)
- Styling dùng **Tailwind CSS** (CDN từ thư mục `/lib/`)
- Comments và UI text bằng **tiếng Việt**
- Modules giao tiếp qua **`chrome.runtime.sendMessage`** (không gọi API trực tiếp từ UI)
- Mọi API call tập trung ở **`background.js`** để tránh CORS
- Inputs người dùng được **persist** vào `chrome.storage.local` để không mất khi đóng tab

---

## Lưu ý quan trọng khi phát triển

1. **CORS:** Tất cả fetch đến `cloud-beta-api.lotuslms.com` phải thực hiện trong `background.js`. Module UI không được gọi API trực tiếp (trừ `shared-bank-utils.js` được chạy trong context của extension page).

2. **Auth expiry:** Token hết hạn sau **24 giờ**. Logic kiểm tra ở `popup.js` sẽ tự xóa token cũ và thử lấy lại.

3. **Bank IID hardcode:** Trong `moveQuestionsToBank()`, `current_bank_iid` đang hardcode là `30303389`. Đây là một known issue — có thể để trống nếu không biết ngân hàng gốc.

4. **Shortcode resolution:** Một số ngân hàng có link dạng `/folder/abc` thay vì `/question-bank/123`. Cần resolve qua API trước khi dùng.

5. **Manifest V3:** Extension dùng Service Worker (`background.js`) thay vì background page. Service Worker có thể bị terminate bất kỳ lúc nào → không lưu state trong biến toàn cục trừ `connectedPorts`.

6. **`items_per_page=-1`** trong export: Lấy tất cả câu hỏi không phân trang. Cẩn thận với ngân hàng có số lượng lớn.

---

## Hướng dẫn thêm Module mới (Developer Guide)

Quy trình chuẩn gồm 5 bước khi mở rộng thêm chức năng hoặc module mới vào Aeglobal Tools:

```
[1. Tạo module UI & Script] ──> [2. Thêm Background API (nếu cần)] ──> [3. Khai báo nút trong popup.html]
                                                                                │
[5. Test & Verify] <────────────────── [4. Đăng ký Click Event trong popup.js] ◄┘
```

---

### Bước 1: Khởi tạo thư mục module (`module/ten-module/`)

Tạo thư mục mới theo quy ước đặt tên kebab-case: `module/ten-module/` chứa 2 file chính:
- `index.html`: Giao diện làm việc (Full-page tab).
- `script.js`: Logic nghiệp vụ của module.

#### 1.1. Mẫu `index.html` chuẩn:
```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tên Chức Năng — Aeglobal Tools</title>
    <link href="../../lib/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50 min-h-screen p-6 text-gray-800">
    <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
                <h1 class="text-xl font-bold text-gray-800">Tên Chức Năng Mới</h1>
                <p class="text-sm text-gray-500 mt-1">Mô tả ngắn gọn mục đích của module</p>
            </div>
            <div id="authStatusBox" class="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm">
                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                <span id="displayUid" class="font-medium text-gray-600">Đang tải UID...</span>
            </div>
        </div>

        <!-- Form nhập liệu -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 mb-5 shadow-sm space-y-4">
            <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1">Danh sách Question IDs / Inputs:</label>
                <textarea id="inputList" rows="6" class="w-full text-xs font-mono p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none" placeholder="Nhập mỗi giá trị trên một dòng..."></textarea>
            </div>

            <div class="flex items-center justify-between pt-2">
                <div id="statusMessage" class="text-sm font-medium"></div>
                <button id="startProcessBtn" class="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                    <span id="btnSpinner" class="hidden animate-spin">⏳</span>
                    <span id="btnText">Bắt đầu xử lý</span>
                </button>
            </div>
        </div>

        <!-- Bảng kết quả hoặc Log -->
        <div id="resultSection" class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hidden">
            <h2 class="text-base font-semibold mb-3">Kết quả thực hiện</h2>
            <div id="resultsTableContainer" class="overflow-x-auto">
                <!-- Nội dung kết quả render tại đây -->
            </div>
        </div>
    </div>

    <!-- Nạp thư viện dùng chung -->
    <script src="../shared-auth.js"></script>
    <script src="../shared-bank-utils.js"></script>
    <script src="../shared-ui.js"></script>
    <!-- Script riêng của module -->
    <script src="script.js"></script>
</body>
</html>
```

#### 1.2. Mẫu `script.js` chuẩn:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    let authData = { uid: null, token: null };

    // 1. Tải thông tin xác thực
    SharedAuth.loadAuthData((data) => {
        authData = data;
        if (!SharedAuth.validateAuth(data.uid, data.token)) {
            SharedUI.showMessage(null, document.getElementById('statusMessage'), 'Chưa có thông tin xác thực. Hãy mở LotusLMS!', 'error');
            document.getElementById('startProcessBtn').disabled = true;
            return;
        }
        document.getElementById('displayUid').textContent = `UID: ${data.uid}`;
    });

    // 2. Khôi phục input đã lưu từ chrome.storage (nếu có)
    const saved = await chrome.storage.local.get(['myModule_inputs']);
    if (saved.myModule_inputs) {
        document.getElementById('inputList').value = saved.myModule_inputs;
    }

    // 3. Xử lý khi bấm nút Thực thi
    const startBtn = document.getElementById('startProcessBtn');
    startBtn.addEventListener('click', async () => {
        const rawInput = document.getElementById('inputList').value;
        const items = SharedUI.parseMultilineInput(rawInput);

        if (items.length === 0) {
            alert('Vui lòng nhập ít nhất một dòng dữ liệu!');
            return;
        }

        // Lưu input để người dùng không mất dữ liệu
        chrome.storage.local.set({ myModule_inputs: rawInput });

        // Đặt trạng thái đang xử lý
        SharedUI.setProcessing(startBtn, document.getElementById('btnText'), document.getElementById('btnSpinner'), true, 'Đang chạy...');

        try {
            // Gửi action lên background.js để thực hiện (tránh CORS)
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: "myNewAction",
                    items: items,
                    uid: authData.uid,
                    token: authData.token
                }, resolve);
            });

            if (response && response.status === "completed") {
                // Hiển thị kết quả thành công
            } else {
                alert('Có lỗi xảy ra: ' + (response?.error || 'Không rõ nguyên nhân'));
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi: ' + err.message);
        } finally {
            SharedUI.setProcessing(startBtn, document.getElementById('btnText'), document.getElementById('btnSpinner'), false, 'Bắt đầu xử lý');
        }
    });
});
```

---

### Bước 2: Khai báo API action trong `background.js` (nếu cần)

Tất cả các lệnh `fetch` đến domain LotusLMS (`cloud-beta-api.lotuslms.com` hoặc `dev-steve-api.lotuslms.com`) **bắt buộc** phải thực thi trong `background.js` để tránh bị trình duyệt chặn CORS.

Trong `background.js`, thêm handler trong hàm `chrome.runtime.onMessage.addListener`:

```javascript
if (request.action === "myNewAction") {
    (async () => {
        try {
            const { items, uid, token } = request;
            
            // Xử lý gọi API LotusLMS tại đây
            const url = `https://cloud-beta-api.lotuslms.com/path/to/api?_sand_domain=aeglobal&_sand_token=${encodeURIComponent(token)}&_sand_uiid=${encodeURIComponent(uid)}`;
            
            // Ví dụ: gọi fetch...
            // const res = await fetch(url, { method: 'POST', body: ... });
            // const result = await res.json();

            sendResponse({ status: "completed", data: /* kết quả */ });
        } catch (error) {
            console.error("Lỗi myNewAction:", error);
            sendResponse({ status: "error", error: error.message });
        }
    })();
    return true; // BẮT BUỘC để giữ message channel mở cho tác vụ bất đồng bộ
}
```

---

### Bước 3: Đăng ký nút chức năng trong `popup.html`

Từ phiên bản 3.1.0, `popup.html` được thiết kế theo danh mục nhóm, có bộ lọc tab và tìm kiếm tức thì. Bạn cần tuân thủ cấu trúc card sau:

#### 3.1. Chọn nhóm phù hợp:
- Nhóm Xuất dữ liệu: Thêm vào `<div class="group-section" data-group="export">`
- Nhóm Quản lý & Thao tác: Thêm vào `<div class="group-section" data-group="ops">`
- Nhóm Tra cứu & Tiện ích: Thêm vào `<div class="group-section" data-group="tools">`

#### 3.2. Cấu trúc nút mẫu:
```html
<button id="openMyNewModule" class="feat-btn" data-category="ops" data-keywords="tu khoa tieng viet khong dau co dau english keywords">
    <!-- Icon box: icon-export (xanh lá), icon-ops (tím), icon-view (xanh dương), icon-amber (cam), icon-danger (đỏ) -->
    <div class="feat-icon-box icon-ops">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <!-- Icon SVG 24x24 -->
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="..." />
        </svg>
    </div>
    <div class="feat-content">
        <div class="feat-title-row">
            <span class="feat-label">Tên Chức Năng Mới</span>
            <!-- Badge: badge-orange, badge-indigo, badge-red, badge-blue -->
            <span class="feat-badge badge-indigo">Hàng loạt</span>
        </div>
        <div class="feat-desc">Mô tả ngắn 1 dòng về công dụng của module</div>
    </div>
    <span class="feat-arrow">›</span>
</button>
```

#### 3.3. Cập nhật số đếm trên thanh Tabs:
Trong `#categoryTabs`, tăng số đếm `tab-count` của nhóm tương ứng và tab `Tất cả`:
```html
<button class="tab-btn active" data-category="all">
    Tất cả <span class="tab-count">13</span> <!-- Tăng lên 13 -->
</button>
<button class="tab-btn" data-category="ops">
    ⚡ Thao tác <span class="tab-count">6</span> <!-- Tăng lên 6 -->
</button>
```

---

### Bước 4: Đăng ký sự kiện mở trong `popup.js`

Trong `popup.js`, thêm sự kiện click mở tab mới cho nút vừa tạo:

```javascript
const openMyNewModuleBtn = document.getElementById('openMyNewModule');
if (openMyNewModuleBtn) {
    openMyNewModuleBtn.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('module/ten-module/index.html'));
    });
}
```

---

### Bước 5: Kiểm tra và xác minh (Testing Checklist)

1. [ ] Vào `chrome://extensions`, bấm **Reload** extension.
2. [ ] Mở popup và kiểm tra:
   - Nút mới hiển thị ngay ngắn, không bị vỡ layout hoặc tràn viền.
   - Thử gõ từ khóa vào ô **Tìm nhanh chức năng** (cả tiếng Việt có dấu và không dấu).
   - Thử click chuyển qua lại giữa các **Category Tabs** xem nút có ẩn/hiện đúng nhóm không.
   - Click vào nút xem tab giao diện `module/ten-module/index.html` có mở ra không.
3. [ ] Trong tab module mới:
   - Kiểm tra xem UID/Token có tự động nạp thành công từ storage không.
   - Thử nhập dữ liệu mẫu và chạy thử chức năng.

