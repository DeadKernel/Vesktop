/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// DeadKernel's own app. Two ways it runs:
// - BRANDED: the installer friends get (electron-builder.deadkernel.cjs), named per brand.json.
// - Side by side: the owner's dev build, a bare electron.exe started by the Vencord repo's
//   personal/tools/vesktop-dev.ps1.
// Either way it's not Vesktop: its own icon and Windows app id (taskbar, pins, notifications),
// our tray and splash, Vencord from DeadKernel/Vencord's releases, and it leaves discord:// links
// to the real Discord app. Icons: static/deadkernel, drawn by personal/tools/make-icon.mjs.
// Soft branding: the name in brand.json (Accord) is only what Windows shows. The window is titled
// by Discord, and nothing inside the app uses the name.

import { app, BrowserWindow, shell } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import { STATIC_DIR } from "shared/paths";

import brand from "../../brand.json";
import { SIDE_BY_SIDE } from "./constants";

export const BRANDED = app.getName() === brand.name;
export const DEADKERNEL = BRANDED || SIDE_BY_SIDE;
export const OWN_IDENTITY = DEADKERNEL && process.platform === "win32";
/** the installer's shortcut carries the same id (brand.json). The dev build has its own, so the
 * two never share a taskbar button. */
export const APP_ID = BRANDED ? brand.appId : `${brand.appId}.Dev`;
export const ICON = join(STATIC_DIR, "deadkernel", "icon.ico");
export const VENCORD_REPO = DEADKERNEL ? "DeadKernel/Vencord" : "Vendicated/Vencord";
const DEV_NAME = `${brand.name} (dev)`;
/** what Windows shows: the tray's tooltip, the static window title */
export const APP_NAME = DEADKERNEL ? brand.name : "Vesktop";

/** Dev only: how to start it again. vesktop-dev.ps1 passes its own path (it sets the environment
 * this build needs), so a pinned button or the Start Menu shortcut runs that script. */
function relaunch() {
    const launcher = process.env.VESKTOP_LAUNCHER;
    if (BRANDED || !launcher || !existsSync(launcher)) return null;
    const powershell = join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe"
    );
    const args = `-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${launcher}"`;
    return { powershell, args };
}

export function applyIdentity(win: BrowserWindow) {
    if (!OWN_IDENTITY || !existsSync(ICON)) return;
    win.setIcon(ICON);
    const r = relaunch();
    win.setAppDetails({
        appId: APP_ID,
        appIconPath: ICON,
        ...(r && { relaunchCommand: `"${r.powershell}" ${r.args}`, relaunchDisplayName: DEV_NAME })
    });
    // the installer makes the branded app's shortcut; the dev build keeps its own, because Windows
    // names notifications and pinned buttons after the shortcut with the app's id
    if (!r) return;
    const link = join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", `${DEV_NAME}.lnk`);
    try {
        shell.writeShortcutLink(link, existsSync(link) ? "replace" : "create", {
            target: r.powershell,
            args: r.args,
            icon: ICON,
            iconIndex: 0,
            appUserModelId: APP_ID,
            description: DEV_NAME
        });
    } catch (e) {
        console.error("DeadKernel: couldn't write the Start Menu shortcut", e);
    }
}
