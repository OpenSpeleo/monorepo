from __future__ import annotations

import unittest
from pathlib import Path

from ariane_lib.parser import ArianeParser


class SectionTest(unittest.TestCase):
    filepath = "tests/artifacts/test_simple.tml"

    @classmethod
    def setUpClass(cls) -> None:
        cls._file = Path(cls.filepath)
        if not cls._file.exists():
            raise FileNotFoundError(f"File not found: `{cls._file}`")

    def setUp(self) -> None:
        self._survey = ArianeParser(self._file, pre_cache=False)

    def test_repr(self):
        for section in self._survey.sections:
            _ = section.__repr__()

    def tests_depth_stats(self):
        data = {
            "Start": {
                "total_shots": 1,
                "length": 0,
                "max_shot_length": 0.0,
                "min_shot_length": 0.0,
                "avg_shot_length": 0.0,
                "median_shot_length": 0.0,
                "max_depth": 0.0,
                "min_depth": 0.0,
                "avg_depth": 0.0,
                "median_depth": 0.0,
            },
            "Section 1": {
                "total_shots": 813,
                "length": 24753,
                "max_shot_length": 121.0,
                "min_shot_length": 2.0,
                "avg_shot_length": 30.4,
                "median_shot_length": 28.0,
                "max_depth": 186.0,
                "min_depth": 0.0,
                "avg_depth": 112.6,
                "median_depth": 140.0,
            },
            "Section 2": {
                "total_shots": 813,
                "length": 25359,
                "max_shot_length": 97.0,
                "min_shot_length": 2.0,
                "avg_shot_length": 31.2,
                "median_shot_length": 29.0,
                "max_depth": 186.0,
                "min_depth": 0.0,
                "avg_depth": 106.3,
                "median_depth": 111.0,
            },
            "Section 3": {
                "total_shots": 813,
                "length": 25466,
                "max_shot_length": 101.0,
                "min_shot_length": 2.0,
                "avg_shot_length": 31.3,
                "median_shot_length": 29.0,
                "max_depth": 186.0,
                "min_depth": 0.0,
                "avg_depth": 101.2,
                "median_depth": 109.0,
            },
        }

        for section in self._survey.sections:
            section_data = data[section.name]
            for key in section_data:
                assert getattr(section, key) == section_data[key]


if __name__ == "__main__":
    unittest.main()
