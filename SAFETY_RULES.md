# Ailun Personal Node Safety Rules

These rules apply to this Raspberry Pi 5 private server. This is a personal node, not an LHB company system.

## Approved Workspaces Only

- Run Codex only inside approved project or test workspaces.
- Do not run Codex from `/root`.
- Do not run Codex from `/`.
- Keep experiments inside clearly named folders.

## System Files

- Do not edit system files unless that is explicitly intended.
- Treat `/etc`, `/boot`, `/usr`, `/var/lib`, and Docker service directories as sensitive.
- Prefer documenting proposed system changes before applying them.
- Back up configuration files before intentional system edits.

## Sandbox And Command Safety

- Do not use dangerous sandbox bypass patterns.
- Do not run commands that hide their real behavior.
- Avoid piping remote scripts directly into a shell.
- Do not run destructive commands unless they are explicitly required and reviewed.
- Review all commands before execution.

## Data Separation

- Keep this personal node separate from LHB company data.
- Do not sync LHB company files to this node.
- Do not paste LHB secrets, credentials, customer data, or internal documents into personal-node tools.
- Keep personal assistant, notes, reminders, file server, and automation data clearly separated from work systems.

## Secrets

- Do not commit secrets to this repository.
- Store API keys, bot tokens, and passwords outside tracked files.
- Restrict Telegram bot access to approved personal user IDs.
- Rotate secrets if they are accidentally exposed.

## Review Before Execution

- Read commands fully before running them.
- Confirm the current directory with `pwd`.
- Confirm target paths before using `rm`, `mv`, `chmod`, `chown`, `dd`, `mkfs`, or package commands.
- When unsure, stop and document the intended change first.
