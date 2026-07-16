from __future__ import annotations

import argparse
from pathlib import Path

from ariane_lib.parser import ArianeParser


def correct(args: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="mnemo correct")

    parser.add_argument(
        "-i",
        "--input_file",
        type=str,
        default=None,
        required=True,
        help="Mnemo TML Source File.",
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
        "--length_scaling",
        type=float,
        required=False,
        default=None,
        help="Apply post-survey recalibration scaling factor to a TML file.",
    )

    parser.add_argument(
        "--compass_offset",
        type=float,
        required=False,
        default=None,
        help="Apply post-survey recalibration compass offset to a TML file.",
    )

    parser.add_argument(
        "--depth_offset",
        type=float,
        required=False,
        default=None,
        help=(
            "Apply post-survey depth offset to a TML file. "
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

    input_file = Path(parsed_args.input_file)
    if not input_file.exists():
        raise FileNotFoundError(f"Impossible to find: `{input_file}`.")

    output_file = Path(parsed_args.output_file)
    if output_file.exists() and not parsed_args.overwrite:
        raise FileExistsError(
            f"The file {output_file} already existing. "
            "Please pass the flag `--overwrite` to ignore."
        )

    survey = ArianeParser(input_file, pre_cache=True)

    for shot in survey.shots:
        if parsed_args.length_scaling is not None:
            shot.length = round(shot.length * parsed_args.length_scaling, ndigits=2)

        if parsed_args.depth_offset is not None:
            shot.depth = round(shot.depth + parsed_args.depth_offset, ndigits=2)
            shot.depthin = round(shot.depthin + parsed_args.depth_offset, ndigits=2)

        if parsed_args.compass_offset is not None:
            shot.azimuth = round(
                (shot.azimuth + parsed_args.compass_offset) % 360, ndigits=0
            )

        if parsed_args.reverse_azimuth:
            shot.azimuth = round((shot.azimuth + 180) % 360, ndigits=0)

    survey.to_tml(output_file)

    return 0
