from __future__ import annotations

import datetime
from pathlib import Path
from typing import TYPE_CHECKING
from typing import Annotated
from typing import Any
from typing import ClassVar
from typing import Literal

import orjson
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import RootModel
from pydantic import field_serializer
from pydantic import field_validator

from mnemo_lib.constants import MNEMO_SUPPORTED_VERSIONS
from mnemo_lib.constants import ShotType
from mnemo_lib.constants import SurveyDirection
from mnemo_lib.intbuffer import IntegerBuffer
from mnemo_lib.utils import convert_to_Int16BE
from mnemo_lib.utils import split_dmp_into_sections
from mnemo_lib.utils import try_split_dmp_in_sections

if TYPE_CHECKING:
    from typing import Self


class Shot(BaseModel):
    type: ShotType
    head_in: Annotated[float, Field(ge=0, lt=360)]
    head_out: Annotated[float, Field(ge=0, lt=360)]
    length: Annotated[float, Field(ge=0)]
    depth_in: Annotated[float, Field(ge=0, le=1000)]
    depth_out: Annotated[float, Field(ge=0, le=1000)]
    pitch_in: Annotated[float, Field(ge=-90, le=90)]
    pitch_out: Annotated[float, Field(ge=-90, le=90)]
    marker_idx: Annotated[int, Field(ge=0)]

    # fileVersion >= 4
    # LRUD
    left: Annotated[float, Field(ge=0)] | None = None
    right: Annotated[float, Field(ge=0)] | None = None
    up: Annotated[float, Field(ge=0)] | None = None
    down: Annotated[float, Field(ge=0)] | None = None

    # File Version >= 3
    # degrees in celcius
    temperature: Annotated[float, Field(ge=-50, lt=50)] | None = None

    # File Version >= 3
    hours: Annotated[int, Field(ge=0, lt=24)] | None = None
    minutes: Annotated[int, Field(ge=0, lt=60)] | None = None
    seconds: Annotated[int, Field(ge=0, lt=60)] | None = None

    # Magic Values, version >= 5
    shotStartValueA: ClassVar[int] = 57
    shotStartValueB: ClassVar[int] = 67
    shotStartValueC: ClassVar[int] = 77

    shotEndValueA: ClassVar[int] = 95
    shotEndValueB: ClassVar[int] = 25
    shotEndValueC: ClassVar[int] = 35

    model_config = ConfigDict(extra="forbid")

    # field serializer converts the enum to its name when dumping
    @field_serializer("type", mode="plain")
    def serialize_type(
        self, v: ShotType
    ) -> Literal["CSA", "CSB", "STANDARD", "END_OF_SURVEY"]:
        return v.name

    @field_validator("type", mode="before")
    @classmethod
    def parse_type(cls, v: Any) -> ShotType | Any:
        if isinstance(v, str):
            return ShotType[v]
        return v

    @field_validator("depth_in", "depth_out", "length", mode="before")
    @classmethod
    def ensure_positive_or_null_values(cls, v: Any) -> float | None:
        try:
            return max(0.0, float(v))
        except (TypeError, ValueError) as e:
            raise ValueError(f"Expected numeric or empty value, got {v!r}") from e

    @classmethod
    def from_dmp(cls, version: int, int_buffer: list[int]) -> Self:
        if version not in MNEMO_SUPPORTED_VERSIONS:
            raise ValueError(
                f"Invalid File Format: Expected DMP version: {MNEMO_SUPPORTED_VERSIONS}"
                f", got `{version}`."
            )

        buffer = IntegerBuffer(int_buffer)  # pyright: ignore[reportAssignmentType]

        data: dict[str, Any] = {
            "depth_in": None,
            "depth_out": None,
            "down": None,
            "head_in": None,
            "head_out": None,
            "hours": None,
            "left": None,
            "length": None,
            "marker_idx": None,
            "minutes": None,
            "pitch_in": None,
            "pitch_out": None,
            "right": None,
            "seconds": None,
            "temperature": None,
            "type": None,
            "up": None,
        }

        # =========================== Magic Values ========================== #

        if version >= 5:  # magic values checking
            assert buffer.read() == cls.shotStartValueA
            assert buffer.read() == cls.shotStartValueB
            assert buffer.read() == cls.shotStartValueC

        # =============================== TYPE ============================== #

        data["type"] = ShotType(buffer.read())

        # ============================= Shot Data =========================== #

        data["head_in"] = buffer.readInt16BE() / 10.0
        data["head_out"] = buffer.readInt16BE() / 10.0
        data["length"] = buffer.readInt16BE() / 100.0
        data["depth_in"] = buffer.readInt16BE() / 100.0
        data["depth_out"] = buffer.readInt16BE() / 100.0
        data["pitch_in"] = buffer.readInt16BE() / 10.0
        data["pitch_out"] = buffer.readInt16BE() / 10.0

        # =============================== LRUD ============================== #

        if version >= 4:
            data["left"] = buffer.readInt16BE() / 100.0
            data["right"] = buffer.readInt16BE() / 100.0
            data["up"] = buffer.readInt16BE() / 100.0
            data["down"] = buffer.readInt16BE() / 100.0

        # =============================== Env =============================== #

        if version >= 4:
            data["temperature"] = buffer.readInt16BE() / 10.0
            data["hours"] = buffer.read()
            data["minutes"] = buffer.read()
            data["seconds"] = buffer.read()

        # ============================= Markers ============================= #

        data["marker_idx"] = buffer.read()

        # =========================== Magic Values ========================== #

        if version >= 5:  # magic values checking
            assert buffer.read() == cls.shotEndValueA
            assert buffer.read() == cls.shotEndValueB
            assert buffer.read() == cls.shotEndValueC

        return cls.model_validate(data)

    @classmethod
    def get_eos_shot(cls) -> Self:
        return cls.model_validate(
            {
                "depth_in": 0.0,
                "depth_out": 0.0,
                "down": None,
                "head_in": 0.0,
                "head_out": 0.0,
                "hours": None,
                "left": None,
                "length": 0.0,
                "marker_idx": 0,
                "minutes": None,
                "pitch_in": 0.0,
                "pitch_out": 0.0,
                "right": None,
                "seconds": None,
                "temperature": None,
                "type": "END_OF_SURVEY",
                "up": None,
            }
        )

    def _generate_dmp(self, version: int) -> list[int]:  # pyright: ignore[reportIncompatibleMethodOverride]
        if version not in MNEMO_SUPPORTED_VERSIONS:
            raise ValueError(
                f"Invalid File Format: Expected DMP version: {MNEMO_SUPPORTED_VERSIONS}"
                f", got `{version}`."
            )

        data: list[int] = []

        # Magic Numbers
        if version >= 5:
            data += [self.shotStartValueA, self.shotStartValueB, self.shotStartValueC]

        data += [
            self.type.value,
            *convert_to_Int16BE(self.head_in * 10.0),
            *convert_to_Int16BE(self.head_out * 10.0),
            *convert_to_Int16BE(self.length * 100.0),
            *convert_to_Int16BE(self.depth_in * 100.0),
            *convert_to_Int16BE(self.depth_out * 100.0),
            *convert_to_Int16BE(self.pitch_in * 10.0),
            *convert_to_Int16BE(self.pitch_out * 10.0),
        ]

        if version >= 4:
            data += [
                *convert_to_Int16BE((left if (left := self.left) else 0.0) * 100.0),
                *convert_to_Int16BE((right if (right := self.right) else 0.0) * 100.0),
                *convert_to_Int16BE((up if (up := self.up) else 0.0) * 100.0),
                *convert_to_Int16BE((down if (down := self.down) else 0.0) * 100.0),
            ]

        if version >= 3:
            data += [
                *convert_to_Int16BE(
                    (temp if (temp := self.temperature) else 0.0) * 10.0
                ),
                hours if (hours := self.hours) else 0,
                minutes if (minutes := self.minutes) else 0,
                seconds if (seconds := self.seconds) else 0,
            ]

        data += [marker_idx if (marker_idx := self.marker_idx) else 0]

        if version >= 5:
            data += [self.shotEndValueA, self.shotEndValueB, self.shotEndValueC]

        return data


class Section(BaseModel):
    date: datetime.datetime
    direction: SurveyDirection
    name: Annotated[str, Field(min_length=3, max_length=3)]
    shots: Annotated[list[Shot], Field(min_length=1)]
    version: Literal[2, 3, 4, 5]

    # Magic Values, version >= 2
    sectionStartValueA: ClassVar[int] = 68
    sectionStartValueB: ClassVar[int] = 89
    sectionStartValueC: ClassVar[int] = 101

    model_config = ConfigDict(extra="forbid")

    # field serializer converts the enum to its name when dumping
    @field_serializer("direction", mode="plain")
    def serialize_type(self, v: SurveyDirection) -> Literal["IN", "OUT"]:
        return v.name

    @field_validator("direction", mode="before")
    @classmethod
    def parse_type(cls, v: Any) -> SurveyDirection | Any:
        if isinstance(v, str):
            return SurveyDirection[v]
        return v

    @field_validator("date", mode="before")
    @classmethod
    def validate_datetime(cls, value: str | datetime.datetime) -> datetime.datetime:
        match value:
            case datetime.datetime():
                return value

            case str():
                try:
                    return datetime.datetime.strptime(value, "%Y-%m-%d %H:%M").replace(
                        tzinfo=datetime.UTC
                    )
                except ValueError as e:
                    raise ValueError(
                        f"Invalid datetime format: {value}. "
                        "Expected 'YYYY-MM-DD HH:MM'."
                    ) from e

            case _:
                raise TypeError(f"Unknown data type received: {type(value)=}")

        return value

    @field_serializer("date")
    def serialize_datetime(self, value: datetime.datetime) -> str:
        return value.strftime("%Y-%m-%d %H:%M")

    @classmethod
    def from_dmp(cls, int_buffer: list[int], uncorrupt: bool = False) -> Self:  # noqa: C901, PLR0912
        buffer = IntegerBuffer(int_buffer)

        data: dict[str, Any] = {
            "date": None,
            "direction": None,
            "name": None,
            "shots": [],
            "version": None,
        }

        # ============================= VERSION ============================= #

        data["version"] = buffer.read()

        if data["version"] not in MNEMO_SUPPORTED_VERSIONS:
            raise ValueError(
                f"Invalid File Format: Expected DMP version: {MNEMO_SUPPORTED_VERSIONS}"
                f", got `{data['version']}`."
            )

        if data["version"] > 2:  # magic values checking
            assert buffer.read() == cls.sectionStartValueA
            assert buffer.read() == cls.sectionStartValueB
            assert buffer.read() == cls.sectionStartValueC

        # =============================== DATE ============================== #

        if uncorrupt:
            _ = buffer.read(5)  # Skip 5 positions over
            data["date"] = datetime.datetime.now()  # noqa: DTZ005

        else:
            year = buffer.read() + 2000
            if year not in range(2016, 2100):
                raise ValueError(f"Invalid year: `{year}`")

            month = buffer.read()
            if month not in range(1, 13):
                raise ValueError(f"Invalid month: `{month}`")

            day = buffer.read()
            if day not in range(1, 31):
                raise ValueError(f"Invalid day: `{day}`")

            hour = buffer.read()
            if hour not in range(24):
                raise ValueError(f"Invalid hour: `{hour}`")

            minute = buffer.read()
            if hour not in range(60):
                raise ValueError(f"Invalid minute: `{minute}`")

            data["date"] = datetime.datetime(  # noqa: DTZ001
                year=year,
                month=month,
                day=day,
                hour=hour,
                minute=minute,
            )

        # =============================== NAME ============================== #
        data["name"] = "".join([chr(i) for i in buffer.read(3)])

        # ============================ DIRECTION ============================ #

        data["direction"] = SurveyDirection(buffer.read())

        # ============================== SHOTS ============================== #
        match data["version"]:
            case 2:
                shot_buff_len = 16
            case 3:
                shot_buff_len = 21
            case 4:
                shot_buff_len = 29
            case 5:
                shot_buff_len = 35
            case _:
                raise ValueError(
                    f"Unknown value received for MNEMO DMP Version: `{data['version']}`"
                )

        # `while True` loop equivalent with exit bound
        # There will never be more than 9999 shots in one section.
        for _ in range(int(9e5)):
            try:
                data["shots"].append(
                    Shot.from_dmp(
                        version=data["version"],
                        int_buffer=buffer.read(shot_buff_len),
                    )
                )
            except IndexError:
                break
        else:
            raise RuntimeError("The loop never finished")

        return cls.model_validate(data)

    def _generate_dmp(self) -> list[int]:
        # =================== DMP HEADER =================== #
        data = [self.version]

        if self.version > 2:  # magic numbers
            data += [
                self.sectionStartValueA,
                self.sectionStartValueB,
                self.sectionStartValueC,
            ]

        data += [
            self.date.year % 100,  # 2023 -> 23
            self.date.month,
            self.date.day,
            self.date.hour,
            self.date.minute,
            ord(self.name[0]),
            ord(self.name[1]),
            ord(self.name[2]),
            self.direction.value,
        ]
        # %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% #

        for shot in self.shots:
            data += shot._generate_dmp(version=self.version)  # pyright: ignore[reportPrivateUsage] # noqa: SLF001

        return data


class DMPFile(RootModel[list[Section]]):
    def to_json(self, filepath: str | Path | None = None) -> str:
        json_str = orjson.dumps(
            self.model_dump(),
            None,
            option=(orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS),
        ).decode("utf-8")

        if filepath is not None:
            if not isinstance(filepath, Path):
                filepath = Path(filepath)

            with filepath.open(mode="w") as file:
                file.write(json_str)

        return json_str

    @classmethod
    def from_dmp(
        cls,
        filepath: Path | str,
        uncorrupt: bool = False,
        uncorrupt_date: datetime.date | None = None,
    ) -> Self:
        if not isinstance(filepath, Path):
            filepath = Path(filepath)

        if not filepath.exists():
            raise FileNotFoundError

        with filepath.open(mode="r") as file:
            data = [int(i) for i in file.read().strip().split(";") if i != ""]

        return cls.from_dmp_data(
            data,
            uncorrupt=uncorrupt,
            uncorrupt_date=uncorrupt_date,
        )

    @classmethod
    def from_dmp_data(
        cls,
        dmp_data: list[int],
        uncorrupt: bool = False,
        uncorrupt_date: datetime.date | None = None,
    ) -> Self:
        sections: list[Section]

        if not uncorrupt:
            sections: list[Section] = [
                Section.from_dmp(section_dmp, uncorrupt=False)
                for section_dmp in split_dmp_into_sections(dmp_data)
            ]
        else:
            if uncorrupt_date is None:
                raise ValueError(
                    "`uncorrupt_date` is mandatory for `uncorrupt == True`"
                )
            sections: list[Section] = [
                Section.from_dmp(section_dmp, uncorrupt=True)
                for section_dmp in try_split_dmp_in_sections(dmp_data)
            ]

            for section in sections:
                # Force fixing the date - Might be corrupted
                section.date = datetime.datetime.combine(
                    uncorrupt_date,
                    datetime.datetime.min.time(),
                )

                # Adding back the final EOS Shot (might not be here)
                if section.shots[-1].type != ShotType.END_OF_SURVEY:
                    section.shots.append(Shot.get_eos_shot())

        return cls(sections)

    def to_dmp(self, filepath: str | Path | None = None) -> list[int]:
        data = self._generate_dmp()

        if filepath is not None:
            if not isinstance(filepath, Path):
                filepath = Path(filepath)

            with filepath.open(mode="w") as file:
                # always finish with a trailing ";"
                file.write(f"{';'.join([str(nbr) for nbr in data])};")

        return data

    def _generate_dmp(self) -> list[int]:  # pyright: ignore[reportIncompatibleMethodOverride]
        data = [nbr for section in self.root for nbr in section._generate_dmp()]  # pyright: ignore[reportPrivateUsage] # noqa: SLF001

        file_version = int(data[0])

        if file_version not in MNEMO_SUPPORTED_VERSIONS:
            raise ValueError(
                f"Invalid File Format: Expected DMP version: {MNEMO_SUPPORTED_VERSIONS}"
                f", got `{file_version}`."
            )

        if file_version > 2:  # version > 2
            # adding `MN2OVER` message at the end
            data += [77, 78, 50, 79, 118, 101, 114]

        return data

    @property
    def sections(self):
        return self.root
