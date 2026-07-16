from __future__ import annotations

import hashlib
import tempfile
import zipfile
from functools import cached_property
from pathlib import Path

import orjson
import xmltodict
from defusedxml.minidom import parseString
from dicttoxml2 import dicttoxml

from ariane_lib.enums import ArianeFileType
from ariane_lib.key_map import KeyMapCls
from ariane_lib.key_map import KeyMapMeta
from ariane_lib.key_map import OptionalArgList
from ariane_lib.section import SurveySection
from ariane_lib.shot import SurveyShot


def _extract_zip(input_zip):
    input_zip = zipfile.ZipFile(input_zip)
    return {name: input_zip.read(name) for name in input_zip.namelist()}


class ArianeParser(metaclass=KeyMapMeta):
    _KEY_MAP = KeyMapCls(
        {
            "constraints": ["Constraints"],
            "cartoEllipse": ["CartoEllipse"],
            "cartoLine": ["CartoLine"],
            "cartoLinkedSurface": ["CartoLinkedSurface"],
            "cartoOverlay": ["CartoOverlay"],
            "cartoPage": ["CartoPage"],
            "cartoRectangle": ["CartoRectangle"],
            "cartoSelection": ["CartoSelection"],
            "cartoSpline": ["CartoSpline"],
            "firstStartAbsoluteElevation": ["firstStartAbsoluteElevation"],
            "geoCoding": OptionalArgList(["geoCoding"]),
            "name": ["caveName"],
            "layers": ["Layers"],
            "listAnnotation": ["ListAnnotation"],
            "unit": ["unit"],
            "useMagneticAzimuth": ["useMagneticAzimuth"],
            "_cavefile": ["CaveFile"],
            "_shots_list": ["Data"],
            "_shots": ["SurveyData", "SRVD"],
        }
    )

    def __init__(self, filepath: str, pre_cache: bool = True) -> None:
        self._filepath = Path(filepath)

        if not self.filepath.is_file():
            raise FileNotFoundError(f"File not found: {filepath}")

        # Pre-Cache the data otherwise ensure at least that the file type is valid
        _ = self.data if pre_cache else self.filetype

    def __repr__(self) -> str:
        repr_str = f"[ArianeSurveyFile {self.filetype.name}] `{self.filepath}`:"
        for key in self._KEY_MAP:
            if key.startswith("_"):
                continue
            repr_str += f"\n\t- {key}: {getattr(self, key)}"
        repr_str += f"\n\t- shots: Total Shots: {len(self.shots)}"
        repr_str += f"\n\t- hash: {self.hash}"
        return repr_str

    def _as_binary(self):
        with self.filepath.open(mode="rb") as f:
            return f.read()

    # Hash related methods

    @cached_property
    def __hash__(self):
        return hashlib.sha256(self._as_binary()).hexdigest()

    @property
    def hash(self):
        return self.__hash__

    # File Timestamps

    @property
    def lstat(self):
        return self.filepath.lstat()

    @property
    def date_created(self):
        return self.lstat.st_ctime

    @property
    def date_last_modified(self):
        return self.lstat.st_mtime

    @property
    def date_last_opened(self):
        return self.lstat.st_atime

    # Loading & Reading the XML File

    @cached_property
    def _data(self):
        if self.filetype == ArianeFileType.TML:
            xml_data = _extract_zip(self.filepath)["Data.xml"]

        elif self.filetype == ArianeFileType.TMLU:
            with self.filepath.open(mode="r") as f:
                xml_data = f.read()

        else:
            raise ValueError(f"Unknown file format: {self.filetype}")

        return xmltodict.parse(xml_data)

    # Export Formats

    def to_json(self):
        return orjson.dumps(
            self.data, None, option=(orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS)
        ).decode("utf-8")

    def to_tml(self, filepath: Path | str) -> None:
        if isinstance(filepath, str):
            filepath = Path(filepath)

        filetype = ArianeFileType.from_path(filepath)

        if filetype != ArianeFileType.TML:
            raise TypeError(
                f"Unsupported fileformat: `{filetype.name}`. "
                f"Expected: `{ArianeFileType.TML.name}`"
            )

        xml_str = dicttoxml(
            self._data["CaveFile"],
            custom_root="CaveFile",
            attr_type=False,
            fold_list=False,
        )

        xml_prettyfied = (
            parseString(xml_str)
            .toprettyxml(indent=" " * 4, encoding="utf-8", standalone=True)
            .decode("utf-8")
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            xml_f = Path(tmp_dir) / "Data.xml"
            with xml_f.open(mode="w") as f:
                f.write(xml_prettyfied)

            with zipfile.ZipFile(filepath, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(f.name, "Data.xml")

    # =============== Descriptive Properties =============== #

    @property
    def data(self) -> dict:
        return self._KEY_MAP.fetch(self._data, "_cavefile")

    @property
    def filepath(self) -> Path:
        return self._filepath

    @property
    def filetype(self) -> ArianeFileType:
        try:
            return ArianeFileType.from_str(self.filepath.suffix[1:])
        except ValueError as e:
            raise TypeError(e) from e

    @cached_property
    def shots(self) -> list[SurveyShot]:
        return [
            SurveyShot(data=survey_shot)
            for survey_shot in self._KEY_MAP.fetch(self._shots_list, "_shots")
        ]

    @cached_property
    def sections(self) -> list[list[SurveyShot]]:
        section_map = {}
        for shot in self.shots:
            try:
                section_map[shot.section].add_shot(shot)
            except KeyError:
                section_map[shot.section] = SurveySection(shot=shot)

        return list(section_map.values())
