from app.services.provider_registry import get_models, REGISTRY


def test_get_models_deduplicates_openrouter_entries():
    raw = REGISTRY["openrouter"]["models"]
    assert len(raw) > len(set(raw)), "fixture should contain duplicate model ids"
    deduped = get_models("openrouter")
    assert len(deduped) == len(set(deduped))
    assert len(deduped) < len(raw)
