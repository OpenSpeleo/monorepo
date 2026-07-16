from __future__ import annotations

import unittest

import pytest

from ariane_lib.key_map import KeyMapMeta
from ariane_lib.parser import ArianeParser
from ariane_lib.shot import SurveyShot


class KeyMapTest(unittest.TestCase):
    def test_invalid_key(self):
        a = {}
        with pytest.raises(
            ValueError, match="The key `CHUCK NORRIS` does not exists inside `data`"
        ):
            _ = ArianeParser._KEY_MAP.fetch(a, "CHUCK NORRIS")  # noqa: SLF001
        with pytest.raises(
            ValueError, match="The key `CHUCK NORRIS` does not exists inside `data`"
        ):
            _ = SurveyShot._KEY_MAP.fetch(a, "CHUCK NORRIS")  # noqa: SLF001

    def test_missing_key(self):
        data = {}
        with pytest.raises(KeyError):
            _ = ArianeParser._KEY_MAP.fetch(data, "name")  # noqa: SLF001
        with pytest.raises(KeyError):
            _ = SurveyShot._KEY_MAP.fetch(data, "id")  # noqa: SLF001

    def _test_valid_key(self, data):
        assert ArianeParser._KEY_MAP.fetch(data, "_shots")  # noqa: SLF001
        assert SurveyShot._KEY_MAP.fetch(data, "depthin")  # noqa: SLF001

    def test_valid_key_tml(self):
        data = {"DepthIn": True, "SurveyData": True}
        self._test_valid_key(data)

    def test_valid_key_tmlu(self):
        self._test_valid_key({"DPI": True, "SRVD": True})

    def test_optional_key(self):
        assert ArianeParser._KEY_MAP.fetch({}, "geoCoding") is None  # noqa: SLF001
        assert ArianeParser._KEY_MAP.fetch({"geoCoding": True}, "geoCoding")  # noqa: SLF001

    def test_invalid_class_creation(self):
        with pytest.raises(AttributeError):

            class ImproperCls(metaclass=KeyMapMeta):
                pass


if __name__ == "__main__":
    unittest.main()
