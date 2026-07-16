from __future__ import annotations

import orjson

from ariane_lib.key_map import KeyMapCls
from ariane_lib.key_map import KeyMapMeta


class SurveyShot(metaclass=KeyMapMeta):
    _KEY_MAP = KeyMapCls(
        {
            "azimuth": ["Azimut", "AZ"],
            "closuretoid": ["ClosureToID", "CID"],
            "color": ["Color", "CL"],
            "comment": ["Comment", "CM"],
            "date": ["Date", "DT"],
            "depth": ["Depth", "DP"],
            "depthin": ["DepthIn", "DPI"],
            "down": ["Down", "D"],
            "excluded": ["Excluded", "EXC"],
            "explorer": ["Explorer", "EX"],
            "fromid": ["FromID", "FRID"],
            "id": ["ID"],
            "inclination": ["Inclination", "INC"],
            "latitude": ["Latitude", "LT"],
            "left": ["Left", "L"],
            "length": ["Length", "LG"],
            "locked": ["Locked", "LK"],
            "longitude": ["Longitude", "LGT"],
            "name": ["Name", "NM"],
            "profiletype": ["Profiletype", "PRTY"],
            "right": ["Right", "R"],
            "section": ["Section", "SC"],
            "shape": ["Shape", "SH"],
            "type": ["Type", "TY"],
            "up": ["Up", "U"],
        }
    )

    def __init__(self, data) -> None:
        self._data = data

    def __repr__(self) -> str:
        repr_str = f"[{self.__class__.__name__} {self.id:04d}]:"
        for key in self._KEY_MAP:
            repr_str += f"\n\t- {key}: {getattr(self, key)}"
        return repr_str

    # def __getattribute__(self, name: str) -> Any:
    #     # if name == "_KEY_MAP":
    #     #     return super().__getattribute__(name)

    #     if name in _KEY_MAP.keys():
    #         value = _KEY_MAP.fetch(self.data, name)
    #         if name == "profiletype":
    #             return ProfileType.from_str(value)

    #         if name == "type":
    #             return ShotType.from_str(value)

    #         if name == "date":
    #             year, month, day = [int(v) for v in value.split("-")]
    #             return datetime.datetime(year=year, month=month, day=day)

    #         return maybe_convert_str_type(value)

    #     return super().__getattribute__(name)

    @property
    def data(self):
        return self._data

    def to_json(self):
        return orjson.dumps(
            self.data, None, option=(orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS)
        ).decode("utf-8")
