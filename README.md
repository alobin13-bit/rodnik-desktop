# Rodnik Desktop

Rodnik Desktop is the open-source Windows/Electron client for **Rodnik**, a messaging application with private chats, groups, reactions, profiles, file/media sharing, voice calls and screen sharing.

- Website: https://rodnik.space
- License: [MIT](LICENSE)
- Privacy: [PRIVACY.md](PRIVACY.md)
- Security: [SECURITY.md](SECURITY.md)

The Rodnik server/backend is a separate service and is **not** part of this repository or the signed Windows package.

## Build locally

Requirements:

- Node.js 24+
- Windows for the NSIS installer

```powershell
npm install
npm run check
npm run dist:win
```

For local development:

```powershell
npm install
npm start
```

The default service endpoint is `https://rodnik.space`.

## Public build and signing

The repository contains a GitHub Actions workflow that builds the Windows installer on a GitHub-hosted Windows runner. This public CI build path is intended for SignPath origin verification.

## Code signing policy

**Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).**

See [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md) for project roles, signing rules, and privacy information.

## What is intentionally not in this repository

This repository does not contain Rodnik server source code, production databases, server credentials, SSH configuration, TLS private keys, TURN secrets, code-signing private keys, or deployment credentials.
