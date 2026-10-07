/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// DeadKernel's installer for friends: Vesktop's build, renamed (brand.json) and re-iconed, with its
// own Windows app id (taskbar, pins and notifications use our name), installed per user next to
// Vesktop and Discord without touching either. src/main/deadkernel.ts does the rest at runtime.
//   DK_VERSION=2026.1007.1 pnpm electron-builder --win --config electron-builder.deadkernel.cjs
// .github/workflows/dk-app.yml runs this on a v<version> tag and publishes the release that the
// app's own updater (electron-updater) watches.

const base = require("./package.json").build;
const brand = require("./brand.json"); // the name and app id, shared with src/main/deadkernel.ts

const config = {
    ...base,
    appId: brand.appId,
    productName: brand.name,
    executableName: brand.name,
    extraMetadata: {
        name: brand.name.toLowerCase(),
        productName: brand.name,
        ...(process.env.DK_VERSION && { version: process.env.DK_VERSION })
    },
    win: {
        icon: "static/deadkernel/icon.ico",
        target: [{ target: "nsis", arch: ["x64"] }]
    },
    // one click, per user, into its own folder. Not Vesktop's installer.nsh: that pins the install to
    // %LocalAppData%\vesktop, which would overwrite a real Vesktop.
    nsis: {
        oneClick: true,
        perMachine: false,
        artifactName: `${brand.name}-Setup.exe`,
        shortcutName: brand.name,
        uninstallDisplayName: brand.name,
        installerIcon: "static/deadkernel/icon.ico",
        uninstallerIcon: "static/deadkernel/icon.ico"
    },
    publish: { provider: "github", owner: "DeadKernel", repo: "Vesktop", releaseType: "release" }
};
// discord:// links stay with the real Discord app
delete config.protocols;

module.exports = config;
