import type { FlowIconKey } from "./flowIcons";

export interface SampleRole {
  label: string;
  prompt: string;
  icon: FlowIconKey;
  color: string;
}

/** Draggable sample agents in Flow Designer — seeded as default system agents on the backend. */
export const SAMPLE_ROLES: SampleRole[] = [
  {
    label: "Business Analysis",
    prompt: "Phân tích yêu cầu nghiệp vụ và tạo đặc tả chức năng.",
    icon: "chart-bar",
    color: "text-blue-300",
  },
  {
    label: "UI/UX Designer",
    prompt: "Thiết kế giao diện người dùng và trải nghiệm tương tác.",
    icon: "paint-brush",
    color: "text-pink-300",
  },
  {
    label: "System Architect",
    prompt: "Thiết kế kiến trúc hạ tầng và sơ đồ cơ sở dữ liệu.",
    icon: "layers",
    color: "text-amber-300",
  },
  {
    label: "Fullstack Dev",
    prompt: "Triển khai logic backend và giao diện frontend.",
    icon: "terminal",
    color: "text-emerald-300",
  },
  {
    label: "QA Tester",
    prompt: "Kiểm thử các trường hợp sử dụng và báo cáo lỗi.",
    icon: "shield-check",
    color: "text-red-300",
  },
];
