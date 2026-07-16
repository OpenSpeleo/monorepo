from __future__ import annotations

import argparse
from pathlib import Path

from mnemo_lib.models import DMPFile


def split(args: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="mnemo split")

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
        "--output_directory",
        type=str,
        default=None,
        required=True,
        help="Path to save the splitted files at.",
    )

    parser.add_argument(
        "-w",
        "--overwrite",
        action="store_true",
        help="Allow overwrite an already existing file.",
        default=False,
    )

    parsed_args = parser.parse_args(args)

    split_dmp_into_sections(
        input_file=parsed_args.input_file,
        output_directory=parsed_args.output_directory,
        overwrite=parsed_args.overwrite,
    )

    return 0


def split_dmp_into_sections(
    input_file: str | Path, output_directory: str | Path, overwrite: bool = False
) -> None:
    dmp_file = Path(input_file)
    if not dmp_file.exists():
        raise FileNotFoundError(f"Impossible to find: `{dmp_file}`.")

    output_directory = Path(output_directory)
    if not output_directory.is_dir():
        raise FileNotFoundError(f"The directory `{output_directory}` does not exists")

    if any(output_directory.iterdir()) and not overwrite:
        raise FileExistsError(
            f"The directory `{output_directory}` is not empty. "
            "Please pass the flag `--overwrite` to ignore."
        )

    dmp_object = DMPFile.from_dmp(filepath=dmp_file)

    for section_id, section in enumerate(dmp_object.sections):
        section_dmp = DMPFile([section])
        section_dmp.to_dmp(output_directory / f"{dmp_file.name}.{section_id + 1}.dmp")
