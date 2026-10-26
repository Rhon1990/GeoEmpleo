import json
from pathlib import Path
from validate import validate_contract


def reject_constant(value):
    raise ValueError("Constante JSON no estándar")


fixtures = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "v1.json").read_text(),
    parse_constant=reject_constant,
)
failures = []
for fixture in fixtures:
    actual = validate_contract(fixture["contract"], fixture["payload"])["valid"]
    if actual != fixture["valid"]:
        failures.append(fixture["name"])
if failures:
    print("Fixtures Python fallidos:", ", ".join(failures))
    raise SystemExit(1)
print(f"OK Python: {len(fixtures)} fixtures con resultado esperado compartido")
