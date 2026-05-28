# Aeglobal Tools — Chrome Extension

Extension hỗ trợ tự động hoá cho hệ thống **Aeglobal LotusLMS**, giúp giảng viên và quản trị viên thao tác nhanh hơn trên nền tảng.

---

## ✨ Tính năng

| Tính năng | Mô tả |
|---|---|
| 📋 Xem câu hỏi trong phiếu | Xem toàn bộ danh sách câu hỏi của một phiếu bài tập ngay trên sidebar |
| 📝 Nhân bản câu hỏi | Sao chép câu hỏi sang phiếu khác |
| 🔀 Di chuyển câu hỏi | Di chuyển câu hỏi giữa các phiếu |
| 🔍 Tìm câu hỏi | Tìm kiếm câu hỏi theo từ khoá hoặc ID |
| ⬇️ Xuất ID câu hỏi | Xuất danh sách ID câu hỏi từ link ngân hàng |
| 🏦 Tra cứu IID ngân hàng | Tra cứu thông tin IID của ngân hàng câu hỏi |

---

## 🚀 Hướng dẫn cài đặt

Extension chưa có trên Chrome Web Store, bạn cần cài thủ công theo các bước dưới đây.

### Bước 1 — Tải source code từ GitHub

**Cách 1: Tải file ZIP (dễ nhất, không cần Git)**

1. Truy cập trang GitHub của repo này
2. Nhấn nút **`Code`** (màu xanh lá) → chọn **`Download ZIP`**
3. Giải nén file `.zip` vừa tải về vào một thư mục tuỳ ý (ví dụ: `D:\Extensions\Aeglobal Tools`)

**Cách 2: Clone bằng Git**

```bash
git clone https://github.com/vieanhng/Aeglobal-Extension.git
```

---

### Bước 2 — Mở trang quản lý Extension của Chrome

1. Mở trình duyệt **Google Chrome**
2. Nhập vào thanh địa chỉ:
   ```
   chrome://extensions
   ```
   rồi nhấn **Enter**

---

### Bước 3 — Bật chế độ Developer

Ở góc trên bên phải trang `chrome://extensions`, bật công tắc **Developer mode** (Chế độ nhà phát triển).

---

### Bước 4 — Tải Extension

1. Nhấn nút **`Load unpacked`** (Tải tiện ích đã giải nén) xuất hiện ở góc trên bên trái
2. Chọn **thư mục gốc** của source code vừa tải/clone (thư mục chứa file `manifest.json`)
3. Nhấn **Select Folder**

✅ Extension sẽ xuất hiện trong danh sách và biểu tượng 🅰 sẽ hiển thị trên thanh công cụ Chrome.

---

### Bước 5 — Ghim Extension (tuỳ chọn)

Để dễ truy cập, hãy ghim extension lên thanh công cụ:

1. Nhấn vào biểu tượng 🧩 (Extensions) trên thanh công cụ Chrome
2. Tìm **Aeglobal Tools** và nhấn biểu tượng 📌 để ghim

---

## 🔄 Cập nhật lên phiên bản mới

Khi có bản cập nhật mới từ GitHub:

**Nếu dùng ZIP:**
1. Tải lại file ZIP mới → giải nén **đè lên** thư mục cũ
2. Vào `chrome://extensions` → nhấn nút 🔄 **Reload** bên cạnh Aeglobal Tools

**Nếu dùng Git:**
```bash
git pull
```
Sau đó vào `chrome://extensions` → nhấn nút 🔄 **Reload**.

---

## 🔐 Quyền truy cập

Extension yêu cầu các quyền sau:

| Quyền | Lý do |
|---|---|
| `activeTab` | Đọc nội dung tab đang mở để lấy thông tin xác thực |
| `storage` | Lưu token và UID vào bộ nhớ cục bộ |
| `scripting` | Chạy script trên trang LotusLMS |
| `sidePanel` | Hiển thị giao diện sidebar |

> Extension **không** thu thập hay gửi dữ liệu ra bên ngoài. Mọi thông tin được lưu trữ hoàn toàn **cục bộ** trên máy tính của bạn.

---

## 🌐 Trang hỗ trợ

Extension chỉ hoạt động trên:
- `https://aeglobal.lotuslms.com/*`
- `https://aeglobal2.lotuslms.com/*`

---

## ❓ Câu hỏi thường gặp

<details>
<summary><strong>Không thấy biểu tượng extension trên thanh công cụ?</strong></summary>

Nhấn vào biểu tượng 🧩 (Extensions) → tìm Aeglobal Tools → nhấn 📌 để ghim.
</details>

<details>
<summary><strong>Extension báo lỗi sau khi cài?</strong></summary>

Đảm bảo bạn đã chọn đúng **thư mục gốc** chứa file `manifest.json`, không phải thư mục con bên trong.
</details>

<details>
<summary><strong>Tính năng "Lấy ngay" không lấy được thông tin xác thực?</strong></summary>

Bạn cần đang mở tab **LotusLMS** (`aeglobal.lotuslms.com`) và đã đăng nhập vào hệ thống trước khi nhấn "Lấy ngay".
</details>

<details>
<summary><strong>Extension không cập nhật sau khi pull code mới?</strong></summary>

Vào `chrome://extensions` và nhấn nút 🔄 **Reload** bên cạnh Aeglobal Tools để áp dụng thay đổi mới nhất.
</details>

---

## 📄 Giấy phép

Dự án nội bộ — sử dụng trong phạm vi tổ chức.
