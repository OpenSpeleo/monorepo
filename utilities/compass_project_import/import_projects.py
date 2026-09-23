#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests>=2.32,<3"]
# ///
"""Import one Compass project per DAT from a MAK file.

See README.md for configuration, dry runs, position ranges and upload retries.
"""

import argparse
import io
import os
import re
import shlex
import sys
import unicodedata
import zipfile
from pathlib import Path
from uuid import UUID

import requests

# For local development, set SPELEODB_INSTANCE=http://localhost:8000.
SPELEODB_INSTANCE = os.environ.get("SPELEODB_INSTANCE", "https://www.speleodb.org")
OAUTH_TOKEN = os.environ.get("OAUTH_TOKEN", "")

SURVEY = re.compile(r"^#(?P<filename>[^,;\r\n]+)(?P<stations>,[^;]*;|;)", re.MULTILINE)


def ascii_title(value):
    value = value.translate(str.maketrans({"´": "'", "’": "'", "‘": "'"}))
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return " ".join(value.split())


def filename_key(value):
    # macOS filenames may use decomposed accents; Windows paths ignore case.
    return unicodedata.normalize("NFC", value).casefold()


def read_projects(mak_file):
    raw = mak_file.read_bytes()
    try:
        source = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        source = raw.decode("cp1252")
    files = {}
    for path in mak_file.parent.iterdir():
        if path.is_file():
            key = filename_key(path.name)
            if key in files:
                raise ValueError(f"Ambiguous filename: {path.name}")
            files[key] = path

    projects = []
    settings = ""
    previous_end = 0
    seen = set()
    for match in SURVEY.finditer(source):
        # Keep all preceding non-survey directives, including inherited UTM
        # zone, datum, location and flags. Drop every other #DAT statement.
        settings += source[previous_end : match.start()]
        previous_end = match.end()
        filename = match["filename"].strip()
        key = filename_key(filename)
        if key in seen:
            raise ValueError(f"Repeated DAT reference: {filename}")
        seen.add(key)
        if key not in files:
            raise FileNotFoundError(f"Missing DAT: {filename}")
        if Path(filename).suffix.lower() != ".dat":
            raise ValueError(f"Expected a DAT reference: {filename}")
        title = ascii_title(Path(filename).stem)
        if not title:
            raise ValueError(f"Empty ASCII title: {filename}")
        # Use a fixed ASCII name inside each independent project. Preserve
        # station identifiers and coordinates exactly, and DAT bytes verbatim.
        mak = (settings + "#survey.dat" + match["stations"] + "\r\n").encode("ascii")
        projects.append((title, files[key], mak))

    if not projects or len(projects) != len(re.findall(r"^#", source, re.MULTILINE)):
        raise ValueError("Could not parse every MAK survey statement")
    return projects


def project_zip(project_id, mak, dat):
    metadata = (
        f'[speleodb]\nid = "{UUID(str(project_id))}"\nversion = "1.0.0"\n\n'
        '[project]\nmak_file = "project.mak"\n'
        'dat_files = ["survey.dat"]\nplt_files = []\n'
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("compass.toml", metadata)
        archive.writestr("project.mak", mak)
        archive.write(dat, "survey.dat")
    return buffer.getvalue()


def api(session, method, path, **kwargs):
    url = f"{SPELEODB_INSTANCE.rstrip('/')}/api/v2/{path}"
    response = session.request(
        method, url, timeout=(15, 300), allow_redirects=False, **kwargs
    )
    if response.status_code == 304 and method == "PUT":
        return response
    if not 200 <= response.status_code < 300:
        raise RuntimeError(
            f"{method} {path}: HTTP {response.status_code}: {response.text[:1000]}"
        )
    return response


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mak-file", type=Path, required=True, help="Path to the source MAK file"
    )
    parser.add_argument(
        "--start", type=int, default=1, help="First position to load (1-based)"
    )
    parser.add_argument(
        "--stop", type=int, help="Stop before this position (exclusive, 1-based)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Validate and list; no API calls"
    )
    parser.add_argument(
        "--project-id", type=UUID, help="Reuse this project at --start only"
    )
    args = parser.parse_args()
    mak_file = args.mak_file.expanduser().resolve()
    if not mak_file.is_file():
        parser.error(f"MAK file not found: {mak_file}")
    projects = read_projects(mak_file)
    if not 1 <= args.start <= len(projects):
        parser.error(f"--start must be between 1 and {len(projects)}")
    if args.stop is not None and args.stop < args.start:
        parser.error("--stop must be greater than or equal to --start")
    if not args.dry_run and not OAUTH_TOKEN.strip():
        parser.error("Set the OAUTH_TOKEN environment variable")

    print(f"Found {len(projects)} projects; starting at {args.start}.", flush=True)
    with requests.Session() as session:
        session.headers["Authorization"] = f"Token {OAUTH_TOKEN}"
        for position, (title, dat, mak) in enumerate(projects, start=1):
            if args.stop is not None and position >= args.stop:
                break
            if position < args.start:
                continue
            print(f"[{position}/{len(projects)}] {title}", flush=True)
            if args.dry_run:
                # Exercise packaging and read every selected DAT, without uploading.
                project_zip(UUID(int=0), mak, dat)
                continue

            project_id = (
                str(args.project_id)
                if position == args.start and args.project_id
                else None
            )
            try:
                if project_id is None:
                    created = api(
                        session,
                        "POST",
                        "projects/",
                        json={
                            "name": title,
                            "description": title,
                            "country": "MX",
                            "type": "COMPASS",
                        },
                    ).json()
                    project_id = str(UUID(created["id"]))
                    print(f"  Created {project_id}", flush=True)
                else:
                    existing = api(session, "GET", f"projects/{project_id}/").json()
                    if any(
                        existing.get(k) != v
                        for k, v in {
                            "name": title,
                            "description": title,
                            "country": "MX",
                            "type": "COMPASS",
                        }.items()
                    ):
                        raise ValueError(
                            "--project-id does not match this DAT's project metadata"
                        )

                archive = project_zip(project_id, mak, dat)
                api(session, "POST", f"projects/{project_id}/acquire/")
                try:
                    api(
                        session,
                        "PUT",
                        f"projects/{project_id}/upload/compass_zip/",
                        data={"message": f"Import {title} from {mak_file.name}"},
                        files={"artifact": ("project.zip", archive, "application/zip")},
                    )
                finally:
                    api(session, "POST", f"projects/{project_id}/release/")
                print("  Uploaded and released lock.", flush=True)
            except (Exception, KeyboardInterrupt) as error:
                print(f"Stopped at position {position}: {error}", file=sys.stderr)
                if project_id:
                    stop_option = (
                        f" --stop {args.stop}" if args.stop is not None else ""
                    )
                    print(
                        f"Retry: --mak-file={shlex.quote(str(mak_file))} "
                        f"--start {position}{stop_option} --project-id {project_id}",
                        file=sys.stderr,
                    )
                else:
                    print(
                        "If creation timed out, check the server for the project before retrying; "
                        "use its ID with --project-id if it exists.",
                        file=sys.stderr,
                    )
                return 1
    print("Dry run complete." if args.dry_run else "Import complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
