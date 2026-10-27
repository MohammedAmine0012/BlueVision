"""Exports the full demo bundle as a static JSON used by the frontend as offline fallback."""
import json, sys
from pathlib import Path
import engine
out = Path(sys.argv[1] if len(sys.argv) > 1 else "../frontend/public/mock_bundle.json")
out.write_text(json.dumps(engine.full_bundle(), separators=(",", ":"), ensure_ascii=False))
print("wrote", out, out.stat().st_size // 1024, "KB")
