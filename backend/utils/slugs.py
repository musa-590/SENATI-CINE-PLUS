import re
import unicodedata


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "categoria"


def unique_slug(model, name: str, exclude_id: int | None = None) -> str:
    base = slugify(name)
    candidate = base
    counter = 2

    def exists(candidate_slug: str) -> bool:
        query = model.query.filter_by(slug=candidate_slug)
        if exclude_id is not None:
            query = query.filter(model.id != exclude_id)
        return query.first() is not None

    while exists(candidate):
        candidate = f"{base}-{counter}"
        counter += 1
    return candidate
