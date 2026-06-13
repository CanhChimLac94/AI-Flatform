import type { Node, Edge } from "@xyflow/react";
import type { FlowIconKey } from "./flowIcons";

export const FLOW_TEMPLATES: {
  id: string;
  label: string;
  description: string;
  icon: FlowIconKey;
  nodes: Node[];
  edges: Edge[];
}[] = [
  {
    id: "software-dev",
    label: "Software Development",
    description: "Quy trình từ đặc tả đến kiểm thử QA.",
    icon: "terminal",
    nodes: [
      { id: "start-1", type: "start", position: { x: 50, y: 150 }, data: { label: "Yêu cầu PM", value: "Dự án: App giao hàng nhanh" } },
      { id: "agent-1", type: "agent", position: { x: 400, y: 50 }, data: { label: "Architect", prompt: "Thiết kế sơ đồ database và API.", model: "Gemini" } },
      { id: "agent-2", type: "agent", position: { x: 400, y: 250 }, data: { label: "Developer", prompt: "Viết code frontend và backend.", model: "Gemini" } },
      { id: "agent-3", type: "agent", position: { x: 750, y: 150 }, data: { label: "QA Tester", prompt: "Viết test case và kiểm thử logic.", model: "Gemini" } },
      { id: "output-1", type: "output", position: { x: 1100, y: 150 }, data: { label: "Bản build hoàn thiện", value: "" } },
    ],
    edges: [
      { id: "e1-1", source: "start-1", target: "agent-1", animated: true },
      { id: "e1-2", source: "start-1", target: "agent-2", animated: true },
      { id: "e2-3", source: "agent-1", target: "agent-3", animated: true },
      { id: "e2-4", source: "agent-2", target: "agent-3", animated: true },
      { id: "e3-o", source: "agent-3", target: "output-1", animated: true },
    ],
  },
  {
    id: "content-strategy",
    label: "Content Marketing",
    description: "Nghiên cứu chủ đề và sản xuất nội dung đa kênh.",
    icon: "document-text",
    nodes: [
      { id: "start-1", type: "start", position: { x: 50, y: 150 }, data: { label: "Chủ đề gốc", value: "Chủ đề: Tương lai của AI trong năm 2025" } },
      { id: "agent-1", type: "agent", position: { x: 400, y: 150 }, data: { label: "Researcher", prompt: "Tìm kiếm xu hướng và số liệu thống kê.", model: "Gemini" } },
      { id: "agent-2", type: "agent", position: { x: 750, y: 50 }, data: { label: "Blog Writer", prompt: "Viết bài blog chi tiết.", model: "Gemini" } },
      { id: "agent-3", type: "agent", position: { x: 750, y: 250 }, data: { label: "Social Media", prompt: "Viết caption Facebook/Insta.", model: "Gemini" } },
      { id: "output-1", type: "output", position: { x: 1100, y: 150 }, data: { label: "Chiến dịch Content", value: "" } },
    ],
    edges: [
      { id: "e1-2", source: "start-1", target: "agent-1", animated: true },
      { id: "e2-3", source: "agent-1", target: "agent-2", animated: true },
      { id: "e2-4", source: "agent-1", target: "agent-3", animated: true },
      { id: "e3-o", source: "agent-2", target: "output-1", animated: true },
      { id: "e4-o", source: "agent-3", target: "output-1", animated: true },
    ],
  },
];
