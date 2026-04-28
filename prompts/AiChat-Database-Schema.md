Với tư cách là Senior BA, tôi sẽ thiết kế **Cấu trúc Cơ sở dữ liệu (Database Schema)** theo mô hình quan hệ (Relational Database) kết hợp với Vector Database để tối ưu hóa cả dữ liệu nghiệp vụ lẫn tính năng AI (Long-term Memory).

Dưới đây là sơ đồ chi tiết được thiết kế theo nguyên tắc **MECE**, đảm bảo tính toàn vẹn dữ liệu và khả năng mở rộng.

---

### 1. KIẾN TRÚC TỔNG THỂ (HIGH-LEVEL ARCHITECTURE)
* **Primary DB (PostgreSQL):** Lưu trữ thông tin người dùng, hội thoại, tin nhắn và cấu hình hệ thống.
* **Vector DB (Pinecone/Milvus/pgvector):** Lưu trữ các bản nhúng (Embeddings) để phục vụ tìm kiếm ngữ cảnh và trí nhớ dài hạn.
* **Caching (Redis):** Lưu trữ Session, Rate limiting (Quota) và các phản hồi AI tạm thời.

---

### 2. CHI TIẾT CÁC BẢNG (TABLE SCHEMAS)

#### Nhóm A: Quản lý Người dùng & Phân quyền (User & Auth)
| Table: `users` | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Khóa chính |
| `email` | Varchar(255) | Unique | Email đăng nhập |
| `full_name` | Varchar(100) | | Tên hiển thị |
| `avatar_url` | Text | | Ảnh đại diện |
| `persona_config` | JSONB | | Lưu sở thích AI (giọng văn, ngôn ngữ) |
| `created_at` | Timestamp | | Thời gian tham gia |

#### Nhóm B: Quản lý Hội thoại (Chat Logic)
| Table: `conversations` | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK -> `users.id` | Chủ sở hữu |
| `title` | Varchar(255) | | Tiêu đề (AI tự sinh hoặc User đặt) |
| `model_id` | Varchar(50) | | Model sử dụng cuối cùng (GPT-4, Llama3...) |
| `is_archived` | Boolean | Default False | Trạng thái lưu trữ |
| `updated_at` | Timestamp | | Dùng để sắp xếp danh sách chat gần nhất |

| Table: `messages` | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Khóa chính |
| `conv_id` | UUID | FK -> `conversations.id` | Thuộc hội thoại nào |
| `role` | Enum | user, assistant, system | Vai trò của tin nhắn |
| `content` | Text | | Nội dung tin nhắn (Markdown) |
| `metadata` | JSONB | | Lưu thông tin file đính kèm, ảnh, search results |
| `tokens_used` | Integer | | Số token đã tiêu tốn cho tin nhắn này |

#### Nhóm C: Bộ nhớ dài hạn & Tri thức (Long-term Memory)
| Table: `user_memories` | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK -> `users.id` | Bộ nhớ của ai |
| `fact_content` | Text | | Nội dung sự thật (vd: "User thích Python") |
| `vector_id` | Varchar(255) | Indexed | ID liên kết sang Vector Database |
| `importance_score`| Float | 0.0 - 1.0 | Độ quan trọng để AI ưu tiên truy xuất |

#### Nhóm D: Quản lý API & Chi phí (Orchestrator & Quota)
| Table: `api_providers` | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | Varchar(50) | PK | Tên định danh (OpenAI, Groq...) |
| `base_url` | Text | | Endpoint API |
| `api_key` | Text | Encrypted | Key (Mã hóa để bảo mật) |
| `is_active` | Boolean | | Trạng thái hoạt động của Provider |

| Table: `daily_usage` | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `user_id` | UUID | FK -> `users.id` | Người dùng |
| `usage_date` | Date | | Ngày ghi nhận |
| `total_tokens` | Integer | | Tổng token đã dùng trong ngày |

---

### 3. SƠ ĐỒ QUAN HỆ (ERD CONCEPT)
Hệ thống hoạt động dựa trên các mối quan hệ logic sau:
1.  **Một User có nhiều Conversations (1:N)**.
2.  **Một Conversation có nhiều Messages (1:N)**.
3.  **Một User có nhiều Memories (1:N)**, nhưng Memories được lưu trữ phẳng dưới dạng Vectors để tìm kiếm ngữ nghĩa thay vì chỉ tìm kiếm từ khóa thông thường.
4.  **Bảng `daily_usage`** được cập nhật liên tục mỗi khi có một tin nhắn hoàn tất để kiểm soát hạn ngạch Free.



---

### 4. CHIẾN LƯỢC TỐI ƯU HÓA (TECHNICAL STRATEGY)
1.  **Indexing:** Đánh Index cho `user_id` và `conv_id` để tăng tốc độ load lịch sử chat khi người dùng cuộn (scroll).
2.  **Soft Delete:** Sử dụng cột `deleted_at` cho các bảng `conversations` và `messages` để người dùng có thể khôi phục lại dữ liệu nếu lỡ tay xóa.
3.  **JSONB Storage:** Sử dụng kiểu dữ liệu JSONB (PostgreSQL) cho cột `metadata` của tin nhắn để có thể linh hoạt lưu trữ các phản hồi khác nhau (như danh sách link web search, tọa độ ảnh, hoặc code snippets) mà không cần thay đổi cấu trúc bảng thường xuyên.

---