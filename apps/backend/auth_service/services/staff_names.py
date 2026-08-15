def format_staff_name(full_name, role_code):
    name = (full_name or "").strip()
    if role_code != "DOCTOR":
        return name
    if name.casefold().startswith("bs."):
        name = name[3:].strip()
    return f"BS. {name}"
