from __future__ import annotations

import datetime
from collections import UserDict
from collections import UserList
from typing import Any

from ariane_lib.enums import ProfileType
from ariane_lib.enums import ShotType
from ariane_lib.enums import UnitType
from ariane_lib.type_utils import maybe_convert_str_type


class OptionalArgList(UserList):
    pass


class KeyMapCls(UserDict):
    def _find_dict_key(self, data, key) -> str:
        if key in self.keys():
            possible_keys = self[key]
            try:
                for tentative_key in self[key]:
                    if tentative_key in data:
                        return tentative_key

                raise KeyError(f"Unable to find any of {self[key]}")  # noqa: TRY301

            except KeyError:
                if isinstance(possible_keys, OptionalArgList):
                    return None
                raise
        else:
            raise ValueError(f"The key `{key}` does not exists inside `data`")

    def fetch(self, data, key) -> Any | None:
        target_key = self._find_dict_key(data, key)
        return data[target_key] if target_key is not None else None

    def set_attr(self, data, key, value) -> None:
        target_key = self._find_dict_key(data, key)
        data[target_key] = value


class KeyMapMeta(type):
    def __new__(cls, name, bases, attrs):  # noqa: C901
        try:
            _KEY_MAP = attrs["_KEY_MAP"]
        except KeyError as e:
            raise AttributeError(
                f"The class {name} does not define a `_KEY_MAP` class attribute"
            ) from e

        def fetcher(self, name):
            value = self._KEY_MAP.fetch(self.data, name)

            match name:
                case "color":
                    return value

                case "date":
                    year, month, day = (int(v) for v in value.split("-"))
                    return datetime.datetime(year=year, month=month, day=day)  # noqa: DTZ001

                case "profiletype":
                    return ProfileType.from_str(value)

                case "type":
                    return ShotType.from_str(value)

                case "unit":
                    return UnitType.from_str(value)

                case _:
                    return maybe_convert_str_type(value)

        attrs["_fetch_property_value"] = fetcher

        # Definining all the properties
        for key in _KEY_MAP:
            # nested function necessary to avoid
            # reference leak on the closure variable: "name"
            def wrapper(name):
                @property
                def inner(self):
                    return self._fetch_property_value(name)

                @inner.setter
                def inner(self, value) -> None:
                    self._KEY_MAP.set_attr(self.data, name, value)

                return inner

            attrs[key] = wrapper(name=key)

        return super().__new__(cls, name, bases, attrs)
