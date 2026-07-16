from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from parameterized import parameterized_class

from mnemo_lib.models import DMPFile


def sha256sum(filepath: str | Path):
    if not isinstance(filepath, Path):
        filepath = Path(filepath)

    h = hashlib.sha256()
    with filepath.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


@parameterized_class(
    ("filepath"),
    [
        ("tests/artifacts/test_v2.dmp",),
        ("tests/artifacts/test_v5.dmp",),
        ("tests/artifacts/test_v5_buggy_EOS.dmp",),
    ],
)
class ReadDMPFileTest(unittest.TestCase):
    filepath: str

    @classmethod
    def setUpClass(cls) -> None:
        cls._file = Path(cls.filepath)
        if not cls._file.exists():
            raise FileNotFoundError(f"File not found: `{cls._file}`")

    def setUp(self) -> None:
        self._dmp_data = DMPFile.from_dmp(self._file)

    def test_export_to_json(self):
        json_str = self._dmp_data.model_dump_json()

        with Path(str(self._file)[:-3] + "json").open(mode="r") as f:
            json_target = json.load(f)

        assert json.loads(json_str) == json_target

    def test_round_trip(self):
        with TemporaryDirectory() as tmp_dir:
            dmp_fp = Path(tmp_dir) / "output.dmp"
            self._dmp_data.to_dmp(filepath=dmp_fp)

            target_dmp = DMPFile.from_dmp(dmp_fp)
            target_hash = hashlib.sha256(target_dmp.to_json().encode("utf-8"))

            assert target_hash.hexdigest() == sha256sum(self._file.with_suffix(".json"))


if __name__ == "__main__":
    unittest.main()
