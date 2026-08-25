# Code Signing Policy

## Free code signing

Free code signing for Rodnik Desktop is intended to be provided by **SignPath.io**, with a certificate provided by the **SignPath Foundation**.

## Source and build provenance

Only binaries produced from the public `alobin13-bit/rodnik-desktop` repository are eligible for official signing.

The canonical Windows build is performed by the GitHub Actions workflow in `.github/workflows/windows-build.yml` on a GitHub-hosted Windows runner. The workflow installs dependencies, runs syntax checks, and builds the NSIS installer with electron-builder.

No production credentials are required to compile the desktop client.

## Roles

- **Project owner / maintainer:** GitHub user `alobin13-bit`.
- **Contributors:** GitHub users whose pull requests are merged into the repository.
- **Release signing:** performed through the SignPath signing workflow once approved by SignPath Foundation.

## Signing rules

- Signing requests must originate from the public CI build for this repository.
- Source code for the signed client must be publicly available under the MIT License.
- No locally modified or privately built binary should be submitted as an official Rodnik release.
- Signing credentials, tokens, and private keys must never be committed to the repository.
- The Rodnik server/backend is outside the scope of the signed desktop client and this repository.

## Privacy

The source repository contains no production database, private messages, account credentials, TLS private keys, TURN secrets, SSH keys, code-signing keys, or deployment passwords.
