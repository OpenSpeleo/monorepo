from __future__ import annotations

import hashlib
import shlex
import subprocess
import unittest
from typing import TYPE_CHECKING

from parameterized import parameterized_class

from tests.commands.base import BaseCMDTestCase

if TYPE_CHECKING:
    from pathlib import Path


def compute_sha256(file_path: Path) -> str:
    """Compute the SHA1 checksum of a file."""
    sha1 = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(8192):  # Read in chunks of 8KB
            sha1.update(chunk)
    return sha1.hexdigest()


class CMDTestCase(BaseCMDTestCase):
    command_template = (
        "mnemo split --input_file={input_f} --output_directory={output_dir} {extra}"
    )

    def run_command(self, command: str):
        return subprocess.run(  # noqa: S603
            shlex.split(command),
            capture_output=True,
            text=True,
            check=False,
        )


@parameterized_class(
    ("input_file", "expected_filecount", "expected_hashes"),
    [
        (
            "tests/artifacts/test_v2.dmp",
            6,
            [
                "090ffb0427d279e09aae5827d75ad13f771e4eab47464c1ca1de05310373ff21",  # 1
                "095fb8fbd93c62b0e74cf2d07c1828531c178388dd19003e58afb7389754b5c2",  # 2
                "32ee2dbba5592d288a2a3d7034ff6fe936bd22f6084c9a66d2bad658a95fb84c",  # 3
                "f77df0ef7da429a06340d80e8b170f98ff9cb7f2da389ba4b4eb07217f5a2c21",  # 4
                "467777920b781212efec4bf11e09b7a9a8c48ce7f916f51a7c837df542df920e",  # 5
                "6184988ea17746527067a708332ca7690b2b3fb1007f14ff08b94f588c8ef449",  # 6
            ],
        ),
        (
            "tests/artifacts/test_v5.dmp",
            9,
            [
                "68f012c1e625fc95888bdaa1f761c59c77fa5d66d91763368d01b53873a52b71",  # 1
                "21ecdd7cb46300123618fd872827a8e3260f89f409f0d553da2656d151bb07e6",  # 2
                "8415b3abfb839dd20605b65e180190f91b2f2e27cacab37fee8b71937a88cb45",  # 3
                "10937ec1e484b609732d8b8a93b9b3e2d7e8ae6170390f07c6b65bbc788e54a8",  # 4
                "d511a1254428f0ca5319a9ceef391fc0e5e68d92e3e6e2d469c8315d29849bf5",  # 5
                "0ca42c2c166cd149af7a3c5e65f0396350bd84ed8a1e0efa3964823970306258",  # 6
                "a7e8077329afbd8ca9021bf1b17e8c6ab7c7978f42e79e3abcb06338d9cdda7d",  # 7
                "1128642d1948163dcb6c18b6b548d310975d7f97879f9e9a60ff9dff70fd3a3b",  # 8
                "aa672493503cc85374a086d38b002e144c8e3ef9101da5cf3ac9653048cb8edf",  # 9
            ],
        ),
        (
            "tests/artifacts/test_v5_buggy_EOS.dmp",
            3,
            [
                "e99ba475a460b724fd2a370028f675101901b7d602fcaef3503821702527734d",  # 1
                "98427708cc74cc5caad9e19528b3ad96ad81d8c562aad5b310a35203211321d3",  # 2
                "78e078d8866d52219a67255f2a8cd938f4661f9ba56ef4d0608edd285f23df80",  # 3
            ],
        ),
    ],
)
class ConvertCMDTest(CMDTestCase):
    def _execute_successful_split(self, extra=""):
        cmd = self.get_test_cmd(
            input_f=self._file, output_dir=self._temp_dir, extra=extra
        )
        result = self.run_command(cmd)
        assert result.returncode == 0
        assert len(list(self._temp_dir.glob("*.dmp"))) == self.expected_filecount

        for filehash, file in zip(
            self.expected_hashes, sorted(self._temp_dir.glob("*.dmp")), strict=True
        ):
            assert compute_sha256(file) == filehash

    def test_successful_split(self):
        self._execute_successful_split()
        self._execute_successful_split(extra="-w")
        self._execute_successful_split(extra="--overwrite")

    def test_no_overwrite_failure(self):
        self._execute_successful_split()
        cmd = self.get_test_cmd(input_f=self._file, output_dir=self._temp_dir, extra="")
        result = self.run_command(cmd)
        assert result.returncode == 1

    def test_slit_file_doesnt_exist(self):
        cmd = self.get_test_cmd(input_f="12234435", output_dir=self._temp_dir, extra="")
        result = self.run_command(cmd)
        assert result.returncode == 1

    def test_slit_file_into_directory_doesnt_exist(self):
        cmd = self.get_test_cmd(input_f=self._file, output_dir="239259754", extra="")
        result = self.run_command(cmd)
        assert result.returncode == 1


if __name__ == "__main__":
    unittest.main()
