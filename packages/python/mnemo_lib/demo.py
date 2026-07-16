from pathlib import Path

from mnemo_lib.models import DMPFile

# ruff: noqa: T201

if __name__ == "__main__":
    paths = ["tests/artifacts/test_v5.dmp", "tests/artifacts/test_v2.dmp"]

    for fp in paths:
        dmp_file = Path(fp)
        print("-------------------------------------------------------")
        print(f"{fp=}")
        dmpfile = DMPFile.from_dmp(filepath=dmp_file)
        print(dmpfile.to_json(filepath=fp[:-3] + "json"))
        for section in dmpfile.sections:
            print(f"{section=}")

        print(f"{DMPFile.from_dmp(fp)=}")
