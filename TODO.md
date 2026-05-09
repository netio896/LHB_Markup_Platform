# Ailun Personal Node TODO

This plan is for a Raspberry Pi 5 8GB personal server running DietPi / Debian at static IP `192.168.88.16`.

## Phase 1: Completed Basics

- [x] Raspberry Pi 5 installed and reachable on the local network.
- [x] Static IP configured: `192.168.88.16`.
- [x] 256GB USB 3.0 SSD available.
- [x] 4GB swap configured.
- [x] Docker installed.
- [x] Codex installed.
- [x] Personal-node purpose defined: assistant, file server, monitoring, notes, reminders, and lightweight automation.
- [x] Confirmed this is not an LHB company system.

## Phase 2: System Verification

- [ ] Run the local healthcheck script.
- [ ] Confirm IP address and hostname.
- [ ] Confirm root filesystem and SSD capacity.
- [ ] Confirm memory and swap availability.
- [ ] Confirm Docker daemon status.
- [ ] Confirm Codex can run only from approved workspaces.
- [ ] Confirm `bubblewrap` availability if sandboxed workflows need it.

## Phase 3: File Browser

- [ ] Decide the approved data directory for File Browser.
- [ ] Create a Docker Compose file or documented Docker run command.
- [ ] Bind File Browser only to intended paths.
- [ ] Set a strong admin password.
- [ ] Confirm access from the local network.
- [ ] Document the service URL and data directory.

## Phase 4: Syncthing

- [ ] Decide whether Syncthing is needed.
- [ ] Choose sync folders and ignore patterns.
- [ ] Install or run Syncthing only when ready.
- [ ] Pair trusted devices only.
- [ ] Confirm no LHB company files are included.
- [ ] Document device IDs and sync folders.

## Phase 5: Telegram Personal Assistant

- [ ] Create a personal Telegram bot token.
- [ ] Store secrets outside the repository.
- [ ] Restrict allowed Telegram user IDs.
- [ ] Implement a minimal command handler.
- [ ] Add commands for notes, reminders, status, and daily summary.
- [ ] Log bot activity without storing sensitive chat content unnecessarily.

## Phase 6: Monitoring And Daily Report

- [ ] Schedule a daily healthcheck report.
- [ ] Track disk, memory, swap, uptime, Docker status, and public IP.
- [ ] Add simple service checks for File Browser and Syncthing if enabled.
- [ ] Send report to a private channel or local log.
- [ ] Alert on low disk, high memory usage, failed Docker, or changed IP.

## Phase 7: Backups And Security Hardening

- [ ] Define what must be backed up.
- [ ] Keep backups separate from the primary SSD.
- [ ] Test restore steps before relying on backups.
- [ ] Enable firewall rules only after confirming required ports.
- [ ] Use SSH keys and disable password login if appropriate.
- [ ] Keep personal-node data separate from LHB company data.
- [ ] Review installed services and exposed ports monthly.
