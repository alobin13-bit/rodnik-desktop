# Privacy

Rodnik Desktop connects to the Rodnik service configured by the user. The default service endpoint is `https://rodnik.space`.

The desktop client stores authentication refresh tokens using Electron `safeStorage`, which uses the operating system's secure storage mechanisms when available. The client also stores local preferences and cached profile information in its application data directory.

Voice calls and screen sharing use WebRTC. Depending on network conditions, media may be routed through TURN infrastructure. The open-source desktop client does not contain production TURN credentials or server-side secrets.

The repository itself contains no user database, production messages, access tokens, passwords, or private server configuration.
