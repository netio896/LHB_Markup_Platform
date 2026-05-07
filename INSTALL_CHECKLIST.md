# Ailun Personal Node Install Checklist

Run these commands manually from an approved workspace. Review each command before execution.

## IP Address

```bash
hostname -I
ip addr show
ip route
```

Expected local IP: `192.168.88.16`.

## Disk

```bash
df -h
lsblk
findmnt
```

Confirm the 256GB USB 3.0 SSD is mounted where expected.

## Memory And Swap

```bash
free -h
swapon --show
cat /proc/meminfo | head
```

Expected memory: about 8GB RAM. Expected swap: about 4GB.

## Docker

```bash
docker --version
docker info
docker ps
```

Docker should be installed and the daemon should be reachable.

## Codex

```bash
codex --version
which codex
pwd
```

Confirm Codex is being run from an approved workspace, not from `/root` or `/`.

## Bubblewrap

```bash
which bwrap
bwrap --version
```

`bubblewrap` may be required for sandboxed workflows.

## File Browser

```bash
docker ps --filter name=filebrowser
docker logs filebrowser --tail 50
curl -I http://192.168.88.16:8080
```

Adjust the port if File Browser is configured on a different local port.

## Optional Syncthing

```bash
syncthing --version
systemctl status syncthing --no-pager
docker ps --filter name=syncthing
curl -I http://192.168.88.16:8384
```

Use the commands that match the chosen Syncthing installation method.

## Optional Firewall

```bash
sudo ufw status verbose
sudo iptables -L -n -v
sudo ss -tulpn
```

Review open ports before enabling or changing firewall rules.
