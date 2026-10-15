"""ORM -> camelCase JSON (the column names already are camelCase, matching the old Prisma responses)."""
from datetime import date, datetime
from typing import Any, Dict, Optional

HIDDEN = {"embedding", "passwordHash"}


def _val(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.isoformat(timespec="milliseconds") + "Z"
    if isinstance(v, date):
        return v.isoformat()
    return v


def ser(obj: Any, include: Optional[Dict[str, Any]] = None, only: Optional[list] = None) -> Optional[Dict[str, Any]]:
    """Serialize a model. `include` = {relationship: nested_include_or_None}; `only` limits scalar columns."""
    if obj is None:
        return None
    out: Dict[str, Any] = {}
    for col in obj.__mapper__.column_attrs:
        k = col.key
        if k in HIDDEN or (only is not None and k not in only):
            continue
        out[k] = _val(getattr(obj, k))
    for rel, sub in (include or {}).items():
        val = getattr(obj, rel)
        if isinstance(val, (list, tuple)):
            out[rel] = [ser(x, sub) for x in val]
        else:
            out[rel] = ser(val, sub)
    return out
