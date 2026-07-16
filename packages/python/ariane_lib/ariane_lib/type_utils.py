from __future__ import annotations

import ast


def strtobool(val):
    """Convert a string representation of truth to true (1) or false (0).
    True values are 'y', 'yes', 't', 'true', and 'on'; false values
    are 'n', 'no', 'f', 'false', and 'off'.  Raises ValueError if
    'val' is anything else.
    """
    val = val.lower()
    if val in ("y", "yes", "t", "true", "on"):
        return True

    if val in ("n", "no", "f", "false", "off"):
        return False

    raise ValueError(f"invalid truth value {val}")


def maybe_convert_str_type(value):
    if not isinstance(value, str):
        return value

    # maybe convert to bool
    try:
        return strtobool(value)
    except ValueError:
        pass

    # maybe convert to int/float
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError):
        pass

    return value
