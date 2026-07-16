from __future__ import annotations

import argparse
from pathlib import Path

from mnemo_lib.models import DMPFile


def convert(args: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="mnemo convert")

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
        "-f",
        "--format",
        type=str,
        # choices=["json", "dmp"],
        choices=["json"],
        required=True,
        help="Conversion format used.",
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

    match parsed_args.format:
        case "json":
            dmp_file = DMPFile.from_dmp(filepath=input_file)
            dmp_file.to_json(filepath=output_file)
        # case "dmp":
        #     with input_file.open(mode="r") as f:
        #         json_target = json.load(f)  # TODO
        case _:  # pragma: no cover
            raise ValueError(f"Unknown value: {parsed_args.format=}")

    return 0
