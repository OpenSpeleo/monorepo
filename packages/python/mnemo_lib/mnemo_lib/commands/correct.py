from __future__ import annotations

import argparse
import datetime
import re
from pathlib import Path

from mnemo_lib.models import DMPFile


def str_to_datetime(value: str) -> datetime.datetime:
    """Validates that the input date is in YYYY-MM-DD format, a valid date in the
    past."""

    if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        raise argparse.ArgumentTypeError(
            f"Invalid date format: {value}. Expected format: YYYY-MM-DD"
        )

    try:
        date_obj = datetime.datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"Invalid date: {value}. Ensure it's a real calendar date. Expected date "
            "format: YYYY-MM-DD"
        ) from None

    # Add one day to prevent TZ false negative
    if date_obj >= datetime.datetime.now() + datetime.timedelta(days=1):  # noqa: DTZ005
        raise argparse.ArgumentTypeError(
            f"Date must be in the past: {value} is not allowed."
        )

    return date_obj  # Return validated datetime object


def positive_float(value: str | float) -> float:
    """Check if the float value meets the minimum requirement."""
    value = float(value)
    if value > 0:
        return value

    raise argparse.ArgumentTypeError(f"Value must be positive. You provided: {value}")


def compass_heading(value: str | int) -> int:
    """Check if the float value meets the compass heading requirement."""
    value = int(value)
    if 0 <= value < 360:
        return value

    raise argparse.ArgumentTypeError(
        f"Value must be within [0, 360[. You provided: {value}"
    )


def correct(args: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="mnemo correct")

    parser.add_argument(
        "-i",
        "--input_file",
        type=str,
        default=None,
        required=True,
        help="Mnemo DMP Source File.",
    )

    parser.add_argument(
        "-o",
        "--output_file",
        type=str,
        default=None,
        required=True,
        help="Path to save the converted file at.",
    )

    parser.add_argument(
        "-w",
        "--overwrite",
        action="store_true",
        help="Allow overwrite an already existing file.",
        default=False,
    )

    parser.add_argument(
        "--date",
        type=str_to_datetime,
        required=False,
        default=None,
        help="New date to apply in format `YYYY-MM-DD`.",
    )

    parser.add_argument(
        "--length_scaling",
        type=positive_float,
        required=False,
        default=None,
        help="Apply post-survey recalibration scaling factor to a DMP file.",
    )

    parser.add_argument(
        "--compass_offset",
        type=compass_heading,
        required=False,
        default=None,
        help="Apply post-survey recalibration compass offset to a DMP file.",
    )

    parser.add_argument(
        "--depth_offset",
        type=float,
        required=False,
        default=None,
        help=(
            "Apply post-survey depth offset to a DMP file. "
            "`offset > 0` => correcting deeper. "
            "`offset < 0` => correcting shallower."
        ),
    )

    parser.add_argument(
        "--reverse_azimuth",
        action="store_true",
        help="Take the reciprocal azimuth to correct a survey IN/OUT into OUT/IN.",
        default=False,
    )

    parsed_args = parser.parse_args(args)

    dmp_file = Path(parsed_args.input_file)
    if not dmp_file.exists():
        raise FileNotFoundError(f"Impossible to find: `{dmp_file}`.")

    output_file = Path(parsed_args.output_file)
    if output_file.exists() and not parsed_args.overwrite:
        raise FileExistsError(
            f"The file {output_file} already existing. "
            "Please pass the flag `--overwrite` to ignore."
        )

    dmp_file = DMPFile.from_dmp(filepath=dmp_file)

    for section in dmp_file.sections:
        if parsed_args.date is not None:
            section.date = section.date.replace(
                year=parsed_args.date.year,
                month=parsed_args.date.month,
                day=parsed_args.date.day,
            )

        for shot in section.shots:
            if parsed_args.length_scaling is not None:
                shot.length = round(shot.length * parsed_args.length_scaling, ndigits=2)

            if parsed_args.compass_offset is not None:
                shot.head_in = round(
                    (shot.head_in + parsed_args.compass_offset) % 360, ndigits=1
                )
                shot.head_out = round(
                    (shot.head_out + parsed_args.compass_offset) % 360, ndigits=1
                )

            if parsed_args.depth_offset is not None:
                shot.depth_in = round(
                    shot.depth_in + parsed_args.depth_offset, ndigits=2
                )
                shot.depth_out = round(
                    shot.depth_out + parsed_args.depth_offset, ndigits=2
                )

            if parsed_args.reverse_azimuth:
                shot.head_in = round((shot.head_in + 180) % 360, ndigits=0)
                shot.head_out = round((shot.head_out + 180) % 360, ndigits=0)

    dmp_file.to_dmp(output_file)

    return 0
