"""Default-deny target policy. DNS pinning must also be enforced by the HTTP transport."""
from dataclasses import dataclass, field
from ipaddress import ip_address, ip_network
from urllib.parse import urlsplit
import socket

class ScopeDenied(ValueError): pass

@dataclass(frozen=True)
class ScopePolicy:
    domains: frozenset[str] = field(default_factory=frozenset)
    networks: tuple[str, ...] = ()
    ports: frozenset[int] = field(default_factory=lambda: frozenset({80,443}))
    schemes: frozenset[str] = field(default_factory=lambda: frozenset({"https"}))
    allow_private_lab: bool = False

    def __post_init__(self):
        for n in self.networks: ip_network(n, strict=False)
        if any(not 1 <= p <= 65535 for p in self.ports): raise ValueError("invalid port")
        normalized = frozenset(d.rstrip(".").encode("idna").decode("ascii").lower() for d in self.domains)
        object.__setattr__(self, "domains", normalized)

    def host_allowed(self, host: str) -> bool:
        try: h = host.rstrip(".").encode("idna").decode("ascii").lower()
        except UnicodeError: return False
        if h in self.domains or any(h.endswith("." + d) for d in self.domains): return True
        try: addr = ip_address(h)
        except ValueError: return False
        return any(addr in ip_network(n, strict=False) for n in self.networks)

    def validate_url(self, url: str, *, resolve_dns: bool = False) -> str:
        try: u = urlsplit(url)
        except ValueError as exc: raise ScopeDenied("malformed URL") from exc
        if u.scheme.lower() not in self.schemes: raise ScopeDenied("scheme is not allowed")
        if not u.hostname or u.username is not None or u.password is not None: raise ScopeDenied("invalid URL authority")
        try: port = u.port or (443 if u.scheme.lower() == "https" else 80)
        except ValueError as exc: raise ScopeDenied("invalid port") from exc
        if port not in self.ports: raise ScopeDenied("port is not allowed")
        host = u.hostname.rstrip(".").encode("idna").decode("ascii").lower()
        if not self.host_allowed(host): raise ScopeDenied("host is outside configured scope")
        try: ip = ip_address(host)
        except ValueError: ip = None
        if ip and not self._ip_allowed(ip): raise ScopeDenied("non-public address blocked")
        if resolve_dns and not ip:
            try: answers = {ip_address(x[4][0]) for x in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)}
            except OSError as exc: raise ScopeDenied("DNS resolution failed") from exc
            if not answers or any(not self._ip_allowed(a) for a in answers): raise ScopeDenied("DNS resolved to a blocked address")
        return host

    def _ip_allowed(self, addr) -> bool:
        if self.allow_private_lab:
            return any(addr in ip_network(n, strict=False) for n in self.networks)
        return addr.is_global and not addr.is_multicast and not addr.is_unspecified
