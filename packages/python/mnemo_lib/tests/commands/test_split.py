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
                "28d93c55d1c51891e3899a449202fc779a065e4046a14214bccdd98f01b0e793",  # 1
                "1df164401a9c3f593e1559c393ba1c57080f68d98844a00dc1382c36fc5c0e92",  # 2
                "a2e74db54e9f5ebc1dbc35cefb49d43b243b3f522011d35c847439880e38d4cb",  # 3
                "a8e5a9ba5d823d13fb30aab3f2f95fddc63c1c03ebce0570585b2211e16c0636",  # 4
                "b2146b57ca3a0e7527a43b37d87c3c1e21795027a647c36968e11d096ed0b259",  # 5
                "73788a7f8241c315ee60abaec57d4b279a8a9584e40a1539cf62c0ce21a43902",  # 6
            ],
        ),
        (
            "tests/artifacts/test_v5.dmp",
            9,
            [
                "863dc987d827fa5c94f6eb8a5124fbf7e2149dc1c887492d92f1cc7ab80b20cc",  # 1
                "ebaa28dc38e2feaad3d42bdbe538eef506d9d0965ad16e2f4922333654d31c03",  # 2
                "4d71545c30255921c1c0fcbe9b7accf78714304016da550377c17988112cbfc8",  # 3
                "22acd779921354c64356dd078aceeda2329efb48d59371f7d5a6a94fa8d3d665",  # 4
                "af8b64c8b26be9a565cf7ca622407b05bdfa9db99b96cea47d5541970d6c5c0b",  # 5
                "2f2939489ab681576a2fd93ede5da95464669f22222935582036ed9222202b33",  # 6
                "5e74125ddd5a9d78396dba3d6667ee1cfe5f07e939dca86ba34850e35ab3438c",  # 7
                "1d30173a26e8cb0f8d5b3b47145d14b2484fd60d2e097babee149458bbbe3c4f",  # 8
                "57e8a1f3d645cd76bcfecded5d02e325b21e1311df8973cd66bd56480e573f2b",  # 9
            ],
        ),
        (
            "tests/artifacts/test_v5_buggy_EOS.dmp",
            3,
            [
                "c0e01c8e25360ec802cefc61bcffc23e68855f92c021b74a3d43f4e2f7b58583",  # 1
                "80082e724a5d372c33feaa1340f772f1c24a3f66231581ac06113793a7f3bba6",  # 2
                "5be5b249d0ed698cfaebae6ee4aa2360f56c98702ca6e6004d4a81fa4ccdb949",  # 3
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
