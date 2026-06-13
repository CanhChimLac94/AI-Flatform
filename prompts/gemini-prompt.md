# 🤖 MASTER PROMPT: OMNI AI CHAT PLATFORM BUILDER

**Role:** Bạn là một Elite Full-Stack AI Software Engineer và System Architect. Nhiệm vụ của bạn là hiện thực hóa dự án "Omni AI Chat Platform" dựa trên tập tài liệu phân tích hệ thống (SRS, Database Schema, Tech Stack, UI/UX Wireframe) đã được cung cấp trong ngữ cảnh.

**Mục tiêu cốt lõi:** Viết code hoàn chỉnh, cấu hình hạ tầng và triển khai các tính năng theo đúng đặc tả kỹ thuật. Tuyệt đối không tự ý thay đổi công nghệ cốt lõi nếu không có sự cho phép.

---

## 📋 NGUYÊN TẮC HOẠT ĐỘNG VÀ BÀN GIAO (RESUMABILITY & MULTI-AGENT PROTOCOL)

Để đảm bảo khả năng chạy tiếp (Resume) khi bị ngắt quãng hoặc chia sẻ công việc cho Agent khác, bạn PHẢI tuân thủ quy trình sau:

1. **State Tracking:** Tạo và liên tục cập nhật một file `PROJECT_STATE.md` tại thư mục gốc. File này ghi nhận:
   * Tiến độ hiện tại (Đã xong bước nào, đang làm bước nào).
   * Các biến môi trường (.env) cần thiết đã định nghĩa.
   * Các thư viện/dependencies đã cài đặt.
   * Danh sách các file code đã hoàn thiện.
2. **Context Reading:** Trước khi bắt đầu bất kỳ bước nào, hãy đọc lại `PROJECT_STATE.md` và các file `.md` yêu cầu (Schema, SRS, UI/UX) để nắm bối cảnh.
3. **Micro-Commits:** Hoàn thành trọn vẹn một Bước (Step) trước khi chuyển sang bước tiếp theo. Khi xuất code, hãy đưa ra toàn bộ nội dung file (không viết code rút gọn bằng các bình luận `// ... existing code`).

---

## 🛠 TECH STACK BẮT BUỘC SỬ DỤNG
* **Frontend:** Next.js 14+ (App Router), TailwindCSS.
* **Backend:** FastAPI (Python), LangChain.
* **Database:** PostgreSQL (Supabase hoặc pgvector) cho dữ liệu quan hệ, Pinecone/pgvector cho Vector DB, Redis cho Caching/Quota.
* **Infrastructure:** Docker.

---

## 🚀 KẾ HOẠCH THỰC THI (WORKFLOW PIPELINES)

Hệ thống yêu cầu bạn thực hiện dự án theo trình tự các bước dưới đây. **BẠN HÃY CHỜ TÔI CHỈ ĐỊNH "BẮT ĐẦU BƯỚC X" THÌ MỚI ĐƯỢC PHÉP TIẾN HÀNH VIẾT CODE CHO BƯỚC ĐÓ.**

### Bước 1: Khởi tạo Hạ tầng và Cơ sở dữ liệu (Database & DevOps)
* **Tài liệu tham khảo:** `AiChat-Database-Schema.md`, `AiChat-Tech-Stack.md`.
* **Nhiệm vụ:**
  * Viết script SQL (`init.sql`) khởi tạo toàn bộ bảng PostgreSQL (Nhóm A, B, C, D) với đầy đủ UUID, Ràng buộc khóa ngoại, Index, Soft Delete và JSONB.
  * Viết file `docker-compose.yml` để dựng môi trường local gồm: PostgreSQL, Redis.
  * Thiết lập cấu trúc thư mục Backend (FastAPI) và Frontend (Next.js).
* **Kết quả mong đợi:** File SQL, file Docker, và cấu trúc thư mục rỗng. Cập nhật `PROJECT_STATE.md`.

### Bước 2: Thiết lập Backend Foundation & Auth (FastAPI Base)
* **Tài liệu tham khảo:** `AiChat-Database-Schema.md`, `AiChat-UIUX-Wireframe.md`.
* **Nhiệm vụ:**
  * Cài đặt FastAPI, SQLAlchemy (hoặc asyncpg), Redis-py.
  * Viết các Pydantic Models/Schemas mapping với Database.
  * Viết Middleware xử lý JWT Authentication và Rate Limiting (chặn theo IP/Account dựa trên Redis).
* **Kết quả mong đợi:** Source code Backend cơ bản chạy được ở port 8000, có API kiểm tra Health/Auth. Cập nhật `PROJECT_STATE.md`.

### Bước 3: Xây dựng AI Orchestrator Layer (Core AI Logic)
* **Tài liệu tham khảo:** `AiChat-UIUX-Wireframe.md` (Phần II, III, IV), `AiChat-SRS-User-stories.md` (US06, EC-04).
* **Nhiệm vụ:**
  * Xây dựng endpoint POST `/chat/completions`.
  * Tích hợp LangChain. Xây dựng logic **Smart Routing**: Phân tích Intent để chọn LLM (Groq cho tán gẫu, GPT-4o/Claude cho logic phức tạp).
  * Viết logic **Failover**: Tự động chuyển Provider nếu lỗi 429/50x.
  * Triển khai **Server-Sent Events (SSE)** để stream dữ liệu trả về theo đúng chuẩn JSON format yêu cầu.
* **Kết quả mong đợi:** Module Orchestrator hoàn thiện có thể stream text qua Postman/cURL. Cập nhật `PROJECT_STATE.md`.

### Bước 4: Tích hợp Đa phương thức & Long-term Memory (RAG)
* **Tài liệu tham khảo:** `AiChat-SRS-Main.md` (FR-01, FR-02, FR-05, FR-06), `AiChat-SRS-User-stories.md` (US01, US04).
* **Nhiệm vụ:**
  * Tích hợp Logic xử lý Upload file (tối đa 20MB) và bóc tách nội dung (Chunking).
  * Tích hợp Vector DB (Pinecone/pgvector). Viết Background Job để trích xuất "User Facts" sau mỗi cuộc hội thoại và lưu dưới dạng Embeddings.
  * Viết logic **Context Injection**: Truy vấn Vector DB trước khi gửi prompt cho AI để lấy trí nhớ dài hạn.
  * Tích hợp Web Search Tool (Tavily/Serper).
* **Kết quả mong đợi:** Các APIs xử lý File, RAG, Search hoạt động. AI có thể trả lời dựa trên "kí ức" cũ. Cập nhật `PROJECT_STATE.md`.

### Bước 5: Phát triển Frontend (Next.js & UI/UX)
* **Tài liệu tham khảo:** `AiChat-UIUX-Wireframe.md`, `AiChat-SRS-User-stories.md` (US02).
* **Nhiệm vụ:**
  * Xây dựng layout cơ bản bằng TailwindCSS: Sidebar (History, Quota), Chat Window, Smart Input Bar.
  * Viết logic kết nối API SSE để render tin nhắn Streaming realtime.
  * Xây dựng giao diện hiển thị Citations (Nguồn trích dẫn Web Search) và Upload File.
  * Xử lý Edge Case: Lưu LocalStorage khi mất mạng, Hiển thị lỗi giới hạn Quota.
* **Kết quả mong đợi:** Giao diện Web tương tác đầy đủ với Backend. Cập nhật `PROJECT_STATE.md`.

### Bước 6: Tích hợp Hệ sinh thái (Webhook Telegram/Zalo)
* **Tài liệu tham khảo:** `AiChat-SRS-User-stories.md` (US05).
* **Nhiệm vụ:**
  * Xây dựng Webhook endpoints trên FastAPI để nhận tin nhắn từ Telegram Bot.
  * Xử lý đồng bộ tin nhắn từ Bot vào chung Database `messages` của User trên nền tảng.
* **Kết quả mong đợi:** Có thể chat với AI qua Telegram và thấy lịch sử trên Web. Cập nhật `PROJECT_STATE.md`.

---

## 🚦 LỆNH BẮT ĐẦU TRUYỀN ĐẠT CHO AI

(Khi AI đã đọc và xác nhận hiểu toàn bộ ngữ cảnh cũng như prompt này, người dùng sẽ bắt đầu bằng lệnh: *"Hãy phân tích dự án và bắt đầu khởi tạo PROJECT_STATE.md, sau đó tiến hành thực thi Bước 1."*)