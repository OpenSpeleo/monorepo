from __future__ import annotations

import unittest
from pathlib import Path

import pytest
from parameterized import parameterized_class

from ariane_lib.enums import ArianeFileType
from ariane_lib.parser import ArianeParser


@parameterized_class(
    ("filepath", "sha256"),
    [
        (
            "tests/artifacts/test_simple.tml",
            "102f4c0ba7617a72147b2ab7d4e3f28117799092a9f29fcae6b9d19722b39b93",
        ),
        (
            "tests/artifacts/test_simple.tmlu",
            "8aca1fb860f85440d69d8101446bfd7a9e23db79197612ca195f2dfae05f583c",
        ),
        (
            "tests/artifacts/test_with_walls.tml",
            "51577dc4557ea47bf564981037d9b3c8cc31c227bffdaa948346a07f101179a8",
        ),
        (
            "tests/artifacts/test_large.tml",
            "737d11e6b0a8303a0d966ed5c1b62693b716440ca7ee89f79e2c55eea8bdd9df",
        ),
    ],
)
class ParametrizedArianeFileTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._file = Path(cls.filepath)
        if not cls._file.exists():
            raise FileNotFoundError(f"File not found: `{cls._file}`")

    def setUp(self) -> None:
        self._survey = ArianeParser(self._file, pre_cache=False)

    def test_filetype(self):
        if self._survey is None:
            raise ValueError("the Ariane file has not been read.")

        extension = self._file.suffix
        filetype = None
        if extension == ".tml":
            filetype = ArianeFileType.TML
        elif extension == ".tmlu":
            filetype = ArianeFileType.TMLU
        else:
            raise ValueError(f"Unexpected extension: {extension}")

        assert filetype == self._survey.filetype

    def test_hash(self):
        assert self.sha256 == self._survey.hash

    def test_load(self):
        survey = ArianeParser(self._file, pre_cache=True)
        # Reading all the properties of an Ariane File
        _ = survey.__repr__()

        # Reading all the properties of all Ariane Shots
        for survey_shot in survey.shots:
            _ = survey_shot.__repr__()

    def test_to_json(self):
        _ = self._survey.to_json()
        _ = self._survey.shots[0].to_json()

    def test_timestamps(self):
        _ = self._survey.date_created
        _ = self._survey.date_last_modified
        _ = self._survey.date_last_opened

    def test_shot_count_consistent(self):
        assert len(self._survey.shots) == sum(
            [len(section) for section in self._survey.sections]
        )


class ArianeFileTest(unittest.TestCase):
    def test_file_not_existing(self):
        with pytest.raises(FileNotFoundError):
            _ = ArianeParser("chuck_norris.tml", pre_cache=False)

    def test_file_wrong_filetype(self):
        with pytest.raises(TypeError):
            _ = ArianeParser("tests/artifacts/file.toml", pre_cache=False)


if __name__ == "__main__":
    unittest.main()
