import type { AgentCategory, AgentDraft } from "./types";

/** Map LLM category slugs to UUIDs; unknown slugs are skipped. */
export function categoryIdsFromDraftSlugs(
  draft: AgentDraft,
  categories: AgentCategory[],
): string[] {
  const slugs = draft.category_slugs ?? [];
  if (!slugs.length) return [];
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
  return slugs.map((s) => bySlug.get(s)).filter((id): id is string => Boolean(id));
}

export function draftToPersonalCreate(draft: AgentDraft, categories: AgentCategory[]) {
  return {
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    system_prompt: draft.system_prompt.trim(),
    model: draft.model?.trim() || undefined,
    tools: draft.tools ?? [],
    icon: draft.icon ?? null,
    is_public: draft.is_public ?? false,
    category_ids: categoryIdsFromDraftSlugs(draft, categories),
  };
}

export function draftToSystemCreate(draft: AgentDraft, categories: AgentCategory[]) {
  const category_ids = categoryIdsFromDraftSlugs(draft, categories);
  if (!category_ids.length) {
    throw new Error("At least one valid category is required for system agents");
  }
  return {
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    system_prompt: draft.system_prompt.trim(),
    model: draft.model?.trim() || undefined,
    tools: draft.tools ?? [],
    icon: draft.icon ?? null,
    category_ids,
  };
}
