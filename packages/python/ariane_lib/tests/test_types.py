from __future__ import annotations

import unittest

import pytest

from ariane_lib.enums import ArianeFileType
from ariane_lib.enums import ProfileType
from ariane_lib.enums import ShotType
from ariane_lib.enums import UnitType


class EnumTypesTest(unittest.TestCase):
    def test_invalid_unitType(self):  # noqa: N802
        with pytest.raises(ValueError, match="Unknown value: LIGHTYEAR"):
            _ = UnitType.from_str("lightyear")

    def test_invalid_fileType(self):  # noqa: N802
        with pytest.raises(ValueError, match="Unknown value: TOML"):
            _ = ArianeFileType.from_str("toml")

    def test_invalid_profileType(self):  # noqa: N802
        with pytest.raises(ValueError, match="Unknown value: DIAGONAL"):
            _ = ProfileType.from_str("diagonal")

    def test_invalid_shotType(self):  # noqa: N802
        with pytest.raises(ValueError, match="Unknown value: HYPOTHETICAL"):
            _ = ShotType.from_str("hypothetical")


if __name__ == "__main__":
    unittest.main()
