# CHI TIẾT USER STORIES - OMNI AI CHAT PLATFORM

## NHÓM 1: TRẢI NGHIỆM CHAT CỐT LÕI (CORE CHAT EXPERIENCE)

### US01: Gửi tin nhắn đa phương thức (Multimodal Input)
* **As a** Người dùng,
* **I want to** có thể gửi văn bản, hình ảnh, file tài liệu hoặc giọng nói vào ô chat,
* **So that** tôi có thể tương tác với AI bằng bất kỳ dữ liệu nào tôi có.

**Acceptance Criteria (AC):**
1.  **AC1:** Hệ thống cho phép nhập văn bản tối đa 4,000 ký tự (có thể điều chỉnh tùy Model).
2.  **AC2:** Cho phép đính kèm tối đa 5 file/hình ảnh cùng lúc. Định dạng hỗ trợ: JPG, PNG, PDF, DOCX, XLSX.
3.  **AC3:** Khi gửi giọng nói, hệ thống phải có animation sóng âm và nút "Dừng/Gửi". Hệ thống tự động chuyển đổi Voice-to-Text trước khi gửi đến AI.
4.  **AC4:** Hiển thị trạng thái "Đang tải" (Uploading) cho các file dung lượng lớn (>5MB).

---

### US02: Phản hồi thời gian thực (Streaming Response)
* **As a** Người dùng,
* **I want to** thấy AI phản hồi từng chữ một (streaming),
* **So that** tôi có thể đọc nội dung ngay lập tức mà không cần đợi toàn bộ câu trả lời hoàn tất.

**Acceptance Criteria (AC):**
1.  **AC1:** Văn bản phải hiển thị theo cơ chế Stream (Server-Sent Events - SSE).
2.  **AC2:** Có nút "Stop Generating" để người dùng ngắt phản hồi giữa chừng.
3.  **AC3:** Cuối mỗi câu trả lời phải có các Action Buttons: Copy, Like/Dislike, và Re-generate.

---

## NHÓM 2: TÌM KIẾM VÀ BỘ NHỚ (SEARCH & MEMORY)

### US03: Tìm kiếm Internet thời gian thực (Web Search)
* **As a** Người dùng,
* **I want to** AI tự động tìm kiếm thông tin trên mạng khi tôi hỏi về tin tức mới,
* **So that** câu trả lời luôn chính xác và cập nhật.

**Acceptance Criteria (AC):**
1.  **AC1:** Hệ thống tự phân tích ý định (Intent) của User; nếu thông tin cần cập nhật (ví dụ: "Giá vàng hôm nay"), hệ thống kích hoạt Search Engine API.
2.  **AC2:** Hiển thị nguồn trích dẫn (Citations) dưới dạng số [1], [2] và danh sách link tham khảo ở cuối câu trả lời.
3.  **AC3:** Nếu Search API lỗi, hệ thống phải thông báo "Không thể kết nối Internet, tôi sẽ trả lời dựa trên dữ liệu cũ".

---

### US04: Bộ nhớ dài hạn (Long-term Memory)
* **As a** Người dùng,
* **I want to** AI nhớ được tên tôi, công việc hoặc các sở thích tôi đã kể từ 1 tuần trước,
* **So that** tôi không phải giải thích lại nhiều lần.

**Acceptance Criteria (AC):**
1.  **AC1:** Sau khi hội thoại kết thúc, hệ thống chạy một tiến trình ngầm (Background Job) để trích xuất "User Facts".
2.  **AC2:** Các sự kiện quan trọng phải được lưu vào Vector Database gắn với User ID.
3.  **AC3:** Khi bắt đầu Chat mới, hệ thống tự động "Inject" các thông tin liên quan vào Context hệ thống (ví dụ: "Người dùng này là một lập trình viên thích dùng Python").

---

## NHÓM 3: TÍCH HỢP ĐA NỀN TẢNG (INTEGRATIONS)

### US05: Liên kết và Chat qua Telegram/Zalo
* **As a** Người dùng bận rộn,
* **I want to** nhắn tin cho AI qua ứng dụng chat cá nhân (Telegram/Zalo),
* **So that** tôi có thể sử dụng AI mà không cần mở trình duyệt hay app riêng.

**Acceptance Criteria (AC):**
1.  **AC1:** Cung cấp mã QR hoặc Link để User liên kết tài khoản Web với Bot trên Telegram/Zalo.
2.  **AC2:** Mọi tin nhắn gửi qua Bot phải được đồng bộ ngược lại lịch sử trên Web/Mobile App.
3.  **AC3:** Bot phải hỗ trợ các lệnh cơ bản như `/newchat`, `/summary`, `/mode`.

---

## NHÓM 4: QUẢN TRỊ VÀ VẬN HÀNH (ADMIN & NON-FUNCTIONAL)

### US06: Tự động điều phối Model (Smart Routing)
* **As a** Hệ thống,
* **I want to** tự động chuyển request sang Model rẻ/nhanh hơn khi có thể,
* **So that** tối ưu hóa chi phí vận hành mà vẫn đảm bảo chất lượng.

**Acceptance Criteria (AC):**
1.  **AC1:** Nếu câu hỏi ngắn (dưới 50 từ) và đơn giản, hệ thống dùng Groq (Llama 3) để trả lời siêu tốc.
2.  **AC2:** Nếu câu hỏi có file đính kèm phức tạp, hệ thống dùng GPT-4o hoặc Claude 3.5 Sonnet.
3.  **AC3:** Nếu một Provider (như OpenAI) trả về lỗi 5xx, hệ thống tự động Retry với Provider khác trong vòng tối đa 3 giây.

---

## CÁC TRƯỜNG HỢP NGOẠI LỆ CHI TIẾT (DETAIL EDGE CASES)

| ID | User Story liên quan | Kịch bản lỗi/Ngoại lệ | Cách xử lý chi tiết |
| :--- | :--- | :--- | :--- |
| **EC-01** | US01 (Input) | User gửi file PDF có mật khẩu. | Thông báo: "File này bị khóa, vui lòng mở khóa trước khi gửi". |
| **EC-02** | US02 (Streaming) | Đang stream thì mất mạng (Client-side). | Hiển thị icon cảnh báo "Mất kết nối". Lưu đoạn text đã nhận vào LocalStorage để không bị mất dữ liệu. |
| **EC-03** | US04 (Memory) | User cung cấp thông tin mâu thuẫn (Hôm trước nói thích A, hôm sau nói ghét A). | AI ưu tiên thông tin mới nhất và cập nhật lại bản ghi trong Vector Database. |
| **EC-04** | Toàn bộ | User gửi yêu cầu tạo nội dung độc hại (Sex, Bomb, Hate speech). | Chặn ngay lập tức bởi lớp Safety Filter và trả lời: "Tôi không thể hỗ trợ yêu cầu này vì vi phạm chính sách an toàn". |

---
