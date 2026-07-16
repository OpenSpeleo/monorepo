from __future__ import annotations

import shlex
import subprocess
import unittest

from parameterized import parameterized_class

from tests.commands.base import BaseCMDTestCase


class CMDTestCase(BaseCMDTestCase):
    command_template = (
        "mnemo convert --input_file={input_f} --output_file={output_f} {extra}"
    )

    @property
    def outfile(self) -> str:
        return self._temp_dir / "output.json"


@parameterized_class(
    ("input_file"),
    [
        ("tests/artifacts/test_v2.dmp",),
        ("tests/artifacts/test_v5.dmp",),
        ("tests/artifacts/test_v5_buggy_EOS.dmp",),
    ],
)
class ConvertCMDTest(CMDTestCase):
    def run_command(self, command: str):
        return subprocess.run(  # noqa: S603
            shlex.split(command),
            capture_output=True,
            text=True,
            check=False,
        )

    def test_convert_succesfull(self):
        cmd = self.get_test_cmd(
            input_f=self._file, output_f=self.outfile, extra="--format=json"
        )
        result = self.run_command(cmd)
        assert result.returncode == 0

        # with overwrite `-w`
        cmd = self.get_test_cmd(
            input_f=self._file, output_f=self.outfile, extra="--format=json -w"
        )
        result = self.run_command(cmd)
        assert result.returncode == 0

        # with overwrite `--overwrite`
        cmd = self.get_test_cmd(
            input_f=self._file,
            output_f=self.outfile,
            extra="--format=json --overwrite",
        )
        result = self.run_command(cmd)
        assert result.returncode == 0

    def test_no_overwrite_failure(self):
        cmd = self.get_test_cmd(
            input_f=self._file, output_f=self._file, extra="--format=json"
        )
        result = self.run_command(cmd)
        assert result.returncode == 1

    def test_convert_file_doesnt_exist(self):
        cmd = self.get_test_cmd(
            input_f="1223443255", output_f=self.outfile, extra="--format=json"
        )
        result = self.run_command(cmd)
        assert result.returncode == 1

    def test_unknown_format_failure(self):
        cmd = self.get_test_cmd(
            input_f=self._file, output_f=self.outfile, extra="--format=bin"
        )
        result = self.run_command(cmd)
        assert result.returncode == 2


if __name__ == "__main__":
    unittest.main()
