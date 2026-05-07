#!/usr/bin/env python3
"""Simple healthcheck for an Ailun Personal Node."""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


def format_bytes(value: int) -> str:
    units = ("B", "KiB", "MiB", "GiB", "TiB")
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{value} B"


def format_duration(seconds: float) -> str:
    seconds = int(seconds)
    days, seconds = divmod(seconds, 86400)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)

    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or parts:
        parts.append(f"{hours}h")
    if minutes or parts:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def status(ok: bool, message: str, details: dict | None = None) -> dict:
    return {
        "ok": ok,
        "status": "OK" if ok else "WARN",
        "message": message,
        "details": details or {},
    }


def check_disk(path: str = "/") -> dict:
    usage = shutil.disk_usage(path)
    used_percent = (usage.used / usage.total) * 100
    ok = used_percent < 90
    return status(
        ok,
        f"{used_percent:.1f}% used on {path}",
        {
            "path": path,
            "total": format_bytes(usage.total),
            "used": format_bytes(usage.used),
            "free": format_bytes(usage.free),
            "used_percent": round(used_percent, 1),
        },
    )


def parse_meminfo() -> dict[str, int]:
    values: dict[str, int] = {}
    with open("/proc/meminfo", "r", encoding="utf-8") as meminfo:
        for line in meminfo:
            key, raw_value = line.split(":", 1)
            parts = raw_value.strip().split()
            if parts:
                values[key] = int(parts[0]) * 1024
    return values


def check_memory() -> dict:
    try:
        meminfo = parse_meminfo()
    except OSError as exc:
        return status(False, f"Unable to read memory info: {exc}")

    total = meminfo.get("MemTotal", 0)
    available = meminfo.get("MemAvailable", 0)
    if not total:
        return status(False, "Unable to determine total memory")

    used = total - available
    used_percent = (used / total) * 100
    ok = used_percent < 90
    return status(
        ok,
        f"{used_percent:.1f}% memory used",
        {
            "total": format_bytes(total),
            "used": format_bytes(used),
            "available": format_bytes(available),
            "used_percent": round(used_percent, 1),
        },
    )


def get_local_ip() -> str | None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return None
    finally:
        sock.close()


def get_public_ip(timeout: float = 3.0) -> str | None:
    try:
        with urlopen("https://api.ipify.org", timeout=timeout) as response:
            return response.read().decode("utf-8").strip()
    except (OSError, URLError, TimeoutError):
        return None


def check_ip_address() -> dict:
    local_ip = get_local_ip()
    public_ip = get_public_ip()
    ok = bool(local_ip)
    message = f"local IP {local_ip}" if local_ip else "Unable to determine local IP"
    if public_ip:
        message += f", public IP {public_ip}"
    return status(
        ok,
        message,
        {
            "hostname": socket.gethostname(),
            "local_ip": local_ip,
            "public_ip": public_ip,
        },
    )


def run_command(command: list[str], timeout: float = 5.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def check_docker() -> dict:
    if shutil.which("docker") is None:
        return status(False, "Docker CLI is not installed or not in PATH")

    try:
        result = run_command(["docker", "info", "--format", "{{json .}}"])
    except (OSError, subprocess.TimeoutExpired) as exc:
        return status(False, f"Unable to query Docker: {exc}")

    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or "docker info failed"
        return status(False, error)

    details: dict[str, object] = {}
    output = result.stdout.strip()
    if output:
        try:
            info = json.loads(output)
            details = {
                "server_version": info.get("ServerVersion"),
                "containers": info.get("Containers"),
                "containers_running": info.get("ContainersRunning"),
                "images": info.get("Images"),
            }
        except json.JSONDecodeError:
            details = {"raw": output}

    return status(True, "Docker daemon is reachable", details)


def check_uptime() -> dict:
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as uptime_file:
            uptime_seconds = float(uptime_file.read().split()[0])
    except (OSError, ValueError, IndexError):
        try:
            uptime_seconds = time.time() - os.stat("/proc/1").st_ctime
        except OSError as exc:
            return status(False, f"Unable to determine uptime: {exc}")

    return status(
        True,
        format_duration(uptime_seconds),
        {"seconds": int(uptime_seconds)},
    )


def print_report(results: dict[str, dict]) -> None:
    print("Ailun Personal Node Healthcheck")
    print("=" * 35)
    for name, result in results.items():
        print(f"{name.upper():<8} [{result['status']}] {result['message']}")
        for key, value in result["details"].items():
            print(f"         {key}: {value}")


def main() -> int:
    results = {
        "disk": check_disk(),
        "memory": check_memory(),
        "ip": check_ip_address(),
        "docker": check_docker(),
        "uptime": check_uptime(),
    }

    print_report(results)
    return 0 if all(result["ok"] for result in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
