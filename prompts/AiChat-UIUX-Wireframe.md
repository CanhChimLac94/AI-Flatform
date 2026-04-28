## I. THIẾT KẾ UI/UX WIREFRAME (CHAT-TO-ACTION)

Mục tiêu của "Chat-to-Action" là giúp người dùng không chỉ nhận văn bản mà còn thực hiện thao tác ngay trên giao diện chat (như xem kết quả tìm kiếm, sửa file, hoặc chuyển đổi model).

### 1. Thành phần giao diện chính (Layout)
* **Sidebar (Trái):** Quản lý History & Folders. Phía dưới cùng là Profile & Quota (Theo dõi lượng token đã dùng).
* **Chat Window (Giữa):** * **Header:** Tên cuộc hội thoại & Badge hiển thị Model đang chạy (ví dụ: "⚡ Groq-Llama3" hoặc "🧠 GPT-4o").
    * **Message Bubbles:** * User: Góc phải, kèm icon các file đã upload.
        * AI: Góc trái, có hiệu ứng "Streaming".
    * **Action Bar (Dưới cùng):** Ô nhập liệu đa năng (Smart Input).

### 2. Mô tả các điểm chạm "Action" đặc biệt
* **Smart Input Bar:** * Icon `+`: Mở menu chọn (Upload File, Camera, Search Web toggle).
    * Icon `Microphone`: Giữ để nói (Voice-to-text realtime).
* **Interactive Response (Phản hồi tương tác):**
    * Khi AI tìm kiếm web: Hiển thị một widget nhỏ "Searching..." với các favicon của trang web đang đọc.
    * Khi AI tạo ảnh: Hiển thị ảnh kèm nút "Variations" hoặc "Upscale" ngay dưới ảnh.
    * **Inline Source:** Click vào số thứ tự [1] sẽ mở một side-panel bên phải hiển thị nội dung trích dẫn mà không làm mất luồng chat.

---

## II. API DOCUMENTATION (ORCHESTRATOR LAYER)

Lớp Orchestrator đóng vai trò là "bộ não" điều phối request giữa User và các nhà cung cấp AI (OpenAI, Groq, Google...).

### 1. Base URL & Authentication
* **Base URL:** `https://api.omni-ai.io/v1`
* **Auth:** Bearer Token (JWT) trong Header.

### 2. Endpoint: POST /chat/completions
Đây là endpoint quan trọng nhất, xử lý định tuyến thông minh.

**Request Header:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "conversation_id": "conv_123456",
  "model_preference": "auto", // auto, speed (Groq), quality (GPT-4)
  "messages": [
    {
      "role": "user",
      "content": "Giá cổ phiếu Tesla hôm nay thế nào?",
      "attachments": [] 
    }
  ],
  "tools": ["web_search", "image_gen"], // Các công cụ được phép kích hoạt
  "stream": true
}
```

### 3. Cấu trúc Phản hồi (Response Structure)
Hệ thống sử dụng **Server-Sent Events (SSE)** để stream dữ liệu.

**Mẫu Data Stream:**
```json
// Event 1: Trạng thái điều phối
data: {"type": "status", "content": "Searching the web for Tesla stock..."}

// Event 2: Trích dẫn tìm được
data: {"type": "citations", "links": [{"id": 1, "url": "https://finance.yahoo.com/..."}]}

// Event 3: Nội dung hội thoại (Chunk)
data: {"type": "content", "delta": "Giá cổ phiếu Tesla (TSLA) hiện tại là..."}

// Event 4: Kết thúc
data: {"type": "done", "usage": {"prompt_tokens": 150, "completion_tokens": 300}}
```

---

## III. CHI TIẾT LOGIC ĐIỀU PHỐI (ORCHESTRATOR LOGIC)

Để đảm bảo tính MECE và Zero-Miss, lớp Orchestrator phải thực hiện tuần tự các bước sau:

1.  **Intent Classification (Phân loại ý định):** * Nếu là chào hỏi/tán gẫu -> Điều hướng tới **Groq** (Rẻ, cực nhanh).
    * Nếu cần tính toán/logic/code phức tạp -> Điều hướng tới **Claude 3.5/GPT-4o**.
    * Nếu cần dữ liệu mới nhất -> Kích hoạt **Web Search Tool**.
2.  **Context Injection (Bổ sung ngữ cảnh):** * Truy vấn Vector Database lấy thông tin từ "Long-term memory" của User.
    * Gắn thêm vào System Prompt trước khi gửi tới AI.
3.  **Failover Logic (Xử lý lỗi):**
    * Nếu Provider A trả về `429 (Rate Limit)` hoặc `503 (Overloaded)`, Orchestrator tự động chuyển sang Provider B trong danh sách dự phòng (Fallback list).

---

## IV. CÁC QUY TẮC KỸ THUẬT (TECHNICAL RULES)

* **R01 (File Size):** Tối đa 20MB cho mỗi file upload. Tài liệu dài sẽ được hệ thống tự động "Chunking" và lưu vào Vector Store tạm thời trước khi Chat.
* **R02 (Timeout):** Request tới các LLM API không được quá 30 giây. Nếu quá thời gian, trả về lỗi "Model Timeout" và gợi ý dùng Model nhẹ hơn.
* **R03 (Token Management):** Kiểm tra số dư Token của User trong Redis trước khi xử lý Request. Nếu `Quota <= 0`, trả về mã lỗi `403 Forbidden` kèm thông báo "Đã hết lượt dùng miễn phí trong ngày".
