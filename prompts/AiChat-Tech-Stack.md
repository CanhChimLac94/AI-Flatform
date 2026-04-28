## I. CÔNG NGHỆ ĐỀ XUẤT (TECH STACK)

Tôi chọn hướng tiếp cận **Modern Hybrid Cloud** để đảm bảo khả năng mở rộng (Scalability).

| Thành phần | Công nghệ đề xuất | Lý do chọn |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14+ (App Router)** & **TailwindCSS** | Tối ưu SEO cho bản Web, hỗ trợ SSR/ISR giúp load giao diện cực nhanh. |
| **Mobile App** | **Flutter** hoặc **React Native** | Phát triển một lần, chạy cả iOS và Android với hiệu năng gần như Native. |
| **Backend** | **FastAPI (Python)** | Xử lý bất đồng bộ (Asynchronous) cực tốt, thư viện hỗ trợ AI (LangChain, LlamaIndex) phong phú nhất. |
| **Orchestrator** | **LangChain** | Công cụ chuẩn để điều phối luồng (Chains), quản lý Prompt và kết nối đa Model. |
| **Primary DB** | **PostgreSQL (Supabase)** | Quản lý dữ liệu quan hệ chặt chẽ, hỗ trợ Auth và Real-time sẵn có. |
| **Vector DB** | **Pinecone** hoặc **pgvector** | Lưu trữ và truy xuất "Long-term Memory" theo không gian vector. |
| **Caching/Quota** | **Redis** | Lưu trữ session và đếm số token dùng trong ngày (Rate limiting) cực nhanh. |
| **Hạ tầng** | **Docker & Kubernetes** | Dễ dàng triển khai và mở rộng (Scale) các microservices. |

---

## II. KẾ HOẠCH TRIỂN KHAI (PROJECT ROADMAP)

Dự án sẽ chia làm 4 giai đoạn chính theo mô hình **Agile/Scrum**:

### Giai đoạn 1: MVP - Minimum Viable Product
* **Mục tiêu:** Xây dựng luồng Chat cơ bản với tốc độ cao.
* **Công việc:**
    * Thiết lập Backend với FastAPI và kết nối API Groq (để lấy tốc độ làm ưu thế cạnh tranh ban đầu).
    * Xây dựng giao diện Web Chat cơ bản (Text-only).
    * Triển khai hệ thống Auth (Google/Email).
    * Cấu trúc Database cơ bản (User, Conversation, Message).

### Giai đoạn 2: Trí tuệ & Đa phương thức
* **Mục tiêu:** Hoàn thiện tính năng AI nâng cao.
* **Công việc:**
    * Tích hợp **Multimodal** (Upload ảnh, file PDF/Docx).
    * Triển khai **Web Search Tool** (sử dụng Tavily hoặc Serper API).
    * Xây dựng lớp **Long-term Memory** (Vector DB + RAG) để AI nhớ sở thích người dùng.
    * Hoàn thiện luồng **Voice-to-Text**.

### Giai đoạn 3: Hệ sinh thái & Tích hợp
* **Mục tiêu:** Mở rộng ra các nền tảng khác.
* **Công việc:**
    * Phát triển **Mobile App** (bản Beta).
    * Xây dựng Bot Gateway để tích hợp vào **Telegram, Zalo, Slack**.
    * Thiết lập hệ thống quản lý **Quota & Token** (chặn người dùng dùng quá giới hạn miễn phí).

### Giai đoạn 4: Tối ưu hóa & Scale (Tuần 13+)
* **Mục tiêu:** Tăng tính ổn định và tối ưu chi phí.
* **Công việc:**
    * Triển khai **Smart Routing** (Tự động chuyển đổi giữa OpenAI/Claude/Groq để giảm cost).
    * A/B Testing các mẫu giao diện (UX).
    * Theo dõi Analytics để hiểu hành vi người dùng và cải thiện AI Persona.

