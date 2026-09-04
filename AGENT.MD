# AGENT.MD — Aeglobal Tools Chrome Extension

## Tổng quan dự án

**Tên:** Aeglobal Tools  
**Phiên bản:** 3.0  
**Loại:** Chrome Extension (Manifest V3)  
**Mục đích:** Công cụ tự động hóa cho hệ thống quản lý học tập (LMS) tại `aeglobal.lotuslms.com` và `aeglobal2.lotuslms.com`.

Extension cung cấp các module chức năng để quản lý **Ngân hàng câu hỏi (Question Bank)** trên nền tảng LotusLMS, bao gồm: nhân bản, di chuyển, tìm kiếm, xuất câu hỏi hàng loạt, xóa câu hỏi hàng loạt và tra cứu IID ngân hàng thông qua API nội bộ của LotusLMS.

---

## Cấu trúc dự án

```
Aeglobal Extension/
├── manifest.json              # Cấu hình extension (Manifest V3)
├── background.js              # Service worker — xử lý tất cả API calls
├── popup.html                 # Giao diện popup chính
├── popup.js                   # Logic của popup (xác thực, điều hướng module)
├── content_script.js          # Script inject vào trang LotusLMS
├── options.html               # Trang tùy chọn (hiện tại trống)
├── icons/                     # Icon extension (16, 32, 48, 128px)
├── lib/
│   ├── tailwind.css           # Tailwind CSS (full)
│   └── tailwind.min.css       # Tailwind CSS (minified, dùng trong content scripts)
└── module/
    ├── shared-auth.js         # Module dùng chung: xác thực
    ├── shared-bank-utils.js   # Module dùng chung: xử lý link ngân hàng
    ├── shared-ui.js           # Module dùng chung: UI helpers
    ├── question-duplicator/
    │   ├── index.html         # Giao diện nhân bản câu hỏi
    │   └── script.js          # Logic nhân bản
    ├── question-exporter/
    │   ├── index.html         # Giao diện xuất ID câu hỏi
    │   └── script.js          # Logic xuất
    ├── question-finder/
    │   ├── index.html         # Giao diện tìm câu hỏi
    │   └── script.js          # Logic tìm kiếm
    ├── question-move/
    │   ├── index.html         # Giao diện di chuyển câu hỏi
    │   └── script.js          # Logic di chuyển
    ├── question-deleter/
    │   ├── index.html         # Giao diện xóa câu hỏi hàng loạt
    │   └── script.js          # Logic xóa (batch, progress, live log)
    ├── question-tagger/
    │   ├── index.html         # Giao diện quản lý thẻ câu hỏi (Thêm/Xóa/Thay thế)
    │   └── script.js          # Logic cập nhật thẻ (append, remove, replace)
    └── bank-iid-viewer/
        ├── index.html         # Giao diện xem IID ngân hàng
        └── script.js          # Logic tra cứu IID
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

## Thêm module mới

Để thêm một module chức năng mới:

1. Tạo thư mục `module/ten-module/` với `index.html` và `script.js`
2. Trong `index.html`, import 3 shared modules:
   ```html
   <script src="../shared-auth.js"></script>
   <script src="../shared-bank-utils.js"></script>
   <script src="../shared-ui.js"></script>
   ```
3. Thêm nút mở module trong `popup.html` với ID phù hợp
4. Đăng ký event listener trong `popup.js`:
   ```javascript
   document.getElementById('openNewModule').addEventListener('click', () => {
       window.open(chrome.runtime.getURL('module/ten-module/index.html'));
   });
   ```
5. Nếu cần gọi API mới, thêm handler `if (request.action === "newAction")` trong `background.js`
