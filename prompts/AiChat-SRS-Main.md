Đây là bản thảo tài liệu **Software Requirements Specification (SRS)** chi tiết cho dự án **"Omni AI Chat Platform"**. 

Tôi đã cấu trúc tài liệu này theo tiêu chuẩn quốc tế (IEEE 830), áp dụng tư duy **MECE** và bao phủ các **Edge Cases** đã thảo luận để đảm bảo tính sẵn sàng cao nhất cho đội ngũ phát triển (Developers & QA).

---

# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Project: Omni AI Chat Platform (Web & Mobile)
**Version:** 1.0  
**Status:** Draft  
**Role:** Elite Senior Business Analyst

---

## 1. GIỚI THIỆU (INTRODUCTION)
### 1.1 Mục tiêu (Purpose)
Tài liệu này quy định chi tiết các yêu cầu nghiệp vụ, chức năng và phi chức năng cho hệ thống Omni AI Chat - một nền tảng tập hợp (aggregator) các mô hình ngôn ngữ lớn (LLM) đa phương thức, hỗ trợ người dùng phổ thông truy cập AI miễn phí với khả năng ghi nhớ dài hạn và tích hợp đa nền tảng.

### 1.2 Phạm vi hệ thống (Scope)
* **Nền tảng:** Web Responsive & Mobile App (iOS/Android).
* **Cốt lõi:** Chat đa phương thức (Text, Image, File, Voice).
* **Kết nối:** API bên thứ 3 (OpenAI, Anthropic, Google, Groq, v.v.).
* **Tính năng đặc biệt:** Web Search thời gian thực, Long-term memory, Tích hợp App (Slack, Telegram...).

---

## 2. KIẾN TRÚC TỔNG QUAN (SYSTEM OVERVIEW)
### 2.1 Tác nhân hệ thống (Actors)
1.  **End User:** Người dùng cuối tương tác qua giao diện.
2.  **AI Orchestrator (System):** Thành phần trung gian điều phối request đến các LLM khác nhau.
3.  **Third-party APIs:** Các nhà cung cấp model và công cụ tìm kiếm.
4.  **Admin:** Quản trị viên theo dõi hệ thống và chi phí.

### 2.2 Thực thể dữ liệu chính (Data Entities)
| Entity | Mô tả |
| :--- | :--- |
| **User** | ID, Name, Email, Preferences, Persona_Settings. |
| **Conversation** | ID, User_ID, Title, Model_ID, Created_At, Updated_At. |
| **Message** | ID, Conv_ID, Role (User/Assistant), Content, Metadata (File/Image). |
| **Vector_Memory** | User_ID, Embedding_Vector, Content_Summary (Dùng cho Long-term memory). |
| **API_Config** | Provider_Name, API_Key_Pool, Status, Rate_Limit_Config. |

---

## 3. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 3.1 Quản lý hội thoại đa phương thức (Multimodal Chat)
* **FR-01: Input đa dạng:** Hệ thống phải chấp nhận văn bản, hình ảnh, file (PDF, Docx, Excel) và giọng nói (Voice-to-Text).
* **FR-02: Output đa dạng:** AI có khả năng trả về văn bản, hình ảnh (DALL-E/Midjourney API) và chuyển đổi văn bản thành giọng nói.
* **FR-03: Web Search Integration:** Khi người dùng yêu cầu thông tin mới nhất, hệ thống tự động gọi API Search để lấy dữ liệu làm ngữ cảnh (Context) trước khi gửi đến LLM.
* **FR-04: Model Routing:** Tự động chọn Model tối ưu (ví dụ: Groq cho tốc độ, GPT-4 cho logic phức tạp) hoặc cho phép người dùng chọn thủ công.

### 3.2 Bộ nhớ dài hạn (Long-term Memory)
* **FR-05: Trích xuất thực thể:** Sau mỗi phiên chat, hệ thống tự động tóm tắt các thông tin quan trọng (tên, sở thích, sự kiện) và lưu vào Vector Database.
* **FR-06: Truy hồi ngữ cảnh (RAG):** Khi người dùng đặt câu hỏi liên quan đến quá khứ, hệ thống tìm kiếm trong Vector Database để cung cấp thêm ngữ cảnh cho AI.

### 3.3 Tích hợp hệ sinh thái (Integrations)
* **FR-07: Webhook Messaging:** Kết nối với Slack, Telegram, Zalo qua API. Tin nhắn từ các app này sẽ được xử lý như một phiên chat trên hệ thống chính.
* **FR-08: Đồng bộ Cloud:** Lịch sử chat phải được đồng bộ Real-time giữa Web và Mobile.

---

## 4. MA TRẬN QUẢN LÝ NGOẠI LỆ (EXCEPTION & EDGE CASES)

| ID | Tình huống (Scenario) | Luồng xử lý (Handling Logic) |
| :--- | :--- | :--- |
| **EX-01** | API của nhà cung cấp chính (OpenAI) bị sập. | Hệ thống tự động chuyển hướng (Failover) sang Model dự phòng (Anthropic hoặc Google) và thông báo nhẹ cho người dùng. |
| **EX-02** | Nội dung vi phạm chính sách (Toxic/Sexual). | Hệ thống chạy lớp kiểm duyệt (Moderation Layer) trước khi gửi request. Nếu vi phạm, trả về câu trả lời từ chối mặc định. |
| **EX-03** | Token hội thoại vượt quá giới hạn (Context Window). | Hệ thống thực hiện "Sliding Window" kết hợp tóm tắt (Summarize) các tin nhắn cũ nhất để giải phóng không gian bộ nhớ. |
| **EX-04** | Mất kết nối khi đang Stream tin nhắn. | Phía Client (Web/App) phải lưu trạng thái cục bộ và tự động thực hiện "Retry" từ đoạn text cuối cùng nhận được. |
| **EX-05** | Spam request từ người dùng Free. | Áp dụng Rate Limiting theo IP và Account (ví dụ: tối đa 10 tin nhắn/phút). Sau đó yêu cầu nhập Captcha hoặc chờ. |

---

## 5. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)
* **NFR-01 (Hiệu năng):** Thời gian phản hồi (TTFT - Time to First Token) phải dưới 2 giây cho các model tốc độ cao.
* **NFR-02 (Bảo mật):** Toàn bộ dữ liệu hội thoại phải được mã hóa khi lưu trữ (Encryption at rest) và khi truyền tải (Encryption in transit).
* **NFR-03 (Khả dụng):** Hệ thống đạt độ sẵn sàng 99.9%.
* **NFR-04 (Mở rộng):** Kiến trúc Microservices để dễ dàng thêm mới các nhà cung cấp API LLM trong tương lai mà không cần dừng hệ thống.

---

## 6. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)
1.  Người dùng không cần trả phí nhưng sẽ bị giới hạn số lượng Token cao cấp (ví dụ: GPT-4o) mỗi ngày.
2.  Dữ liệu "Long-term memory" thuộc quyền sở hữu của người dùng; họ có quyền xóa sạch bộ nhớ này bất cứ lúc nào.
3.  Hệ thống không được lưu trữ thông tin nhạy cảm như mật khẩu hoặc thẻ tín dụng từ nội dung chat.
