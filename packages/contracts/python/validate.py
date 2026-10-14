import json
import re
import ipaddress
from datetime import datetime
from itertools import islice
from pathlib import Path
from ada_url import URL
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

NAMES = ("source-posting-event", "search-request", "job-detail", "job-list", "map-response", "problem")
ROOT = Path(__file__).resolve().parents[1] / "schemas" / "v1"
schemas = {name: json.loads((ROOT / (name + ".schema.json")).read_text()) for name in ("common", *NAMES)}


def deny_remote(uri):
    raise ValueError("Referencia de esquema no registrada localmente")


registry = Registry(retrieve=deny_remote).with_resources(
    (schema["$id"], Resource.from_contents(schema)) for schema in schemas.values()
)
checker = FormatChecker()


@checker.checks("http-url")
def is_http_url(value):
    if not isinstance(value, str):
        return True
    match = re.match(r"^https?://([^/?#]+)", value)
    if not match:
        return False
    authority = match[1]
    if not re.fullmatch(r"[\x21-\x7e]+", authority) or re.search(r"[@%\\]", authority) or "\\" in value:
        return False
    parts = re.fullmatch(r"(\[[0-9a-fA-F:.]+\]|[^:]+)(?::([0-9]{1,5}))?", authority)
    if not parts or (parts[2] is not None and int(parts[2]) > 65535):
        return False
    hostname = parts[1]
    try:
        parsed = URL(value)
        if parsed.protocol not in ("http:", "https:") or not parsed.hostname or parsed.username or parsed.password:
            return False
        parsed.port  # Comprueba rango y sintaxis del puerto, sin resolver DNS.
        if hostname.startswith("["):
            ipaddress.IPv6Address(hostname[1:-1])
            return True
        if re.fullmatch(r"[0-9.]+", hostname):
            ipaddress.IPv4Address(hostname)
            return True
        labels = (hostname[:-1] if hostname.endswith(".") else hostname).split(".")
        if len(hostname) > 253 or any(len(label) > 63 or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?", label) for label in labels):
            return False
        if re.fullmatch(r"(?:[0-9]+|0x[0-9a-f]+)", labels[-1], re.IGNORECASE):
            return False
        return parsed.hostname == hostname.lower()
    except ValueError:
        return False


@checker.checks("date-time")
def is_utc_instant(value):
    if not isinstance(value, str):
        return True
    if not re.fullmatch(r"(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z", value):
        return False
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
        canonical = value if "." in value else value[:-1] + ".000Z"
        return instant.isoformat(timespec="milliseconds").replace("+00:00", "Z") == canonical
    except ValueError:
        return False


validators = {}
for name in NAMES:
    Draft202012Validator.check_schema(schemas[name])
    validators[name] = Draft202012Validator(schemas[name], registry=registry, format_checker=checker)


def validate_contract(name, payload):
    if name not in validators:
        raise ValueError("Contrato no admitido")
    try:
        json.dumps(payload, allow_nan=False)
    except (TypeError, ValueError, OverflowError, RecursionError):
        return {"valid": False, "issues": [{"path": "", "code": "non_json"}]}
    issues = []
    for error in islice(validators[name].iter_errors(payload), 20):
        path = "/".join(str(part).replace("~", "~0").replace("/", "~1") for part in error.absolute_path)
        issues.append({"path": "/" + path if path else "", "code": error.validator})
    return {"valid": False, "issues": issues} if issues else {"valid": True}
