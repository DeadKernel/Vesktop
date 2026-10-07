/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// DeadKernel side by side, on Windows: its own icon and taskbar identity instead of Electron's
// (the dev build runs a bare electron.exe) or the installed Vesktop's. Windows names and draws
// notifications and pinned buttons from a Start Menu shortcut with the same app id, so this keeps
// one: "Discord (DeadKernel)", which also launches it. Icon: static/deadkernel, drawn by the
// Vencord repo's personal/tools/make-icon.mjs.

import { BrowserWindow, shell } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import { STATIC_DIR } from "shared/paths";

import { SIDE_BY_SIDE } from "./constants";

export const OWN_IDENTITY = SIDE_BY_SIDE && process.platform === "win32";
export const APP_ID = "DeadKernel.Discord";
export const ICON = join(STATIC_DIR, "deadkernel", "icon.ico");
const NAME = "Discord (DeadKernel)";

/** How to start it again: personal/tools/vesktop-dev.ps1 passes its own path (it sets the
 * environment this build needs), so a pinned button or the shortcut runs that script. */
function relaunch() {
    const launcher = process.env.VESKTOP_LAUNCHER;
    if (!launcher || !existsSync(launcher)) return null;
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
        ...(r && { relaunchCommand: `"${r.powershell}" ${r.args}`, relaunchDisplayName: NAME })
    });
    if (!r) return;
    const programs = join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs");
    const link = join(programs, `${NAME}.lnk`);
    try {
        shell.writeShortcutLink(link, existsSync(link) ? "replace" : "create", {
            target: r.powershell,
            args: r.args,
            icon: ICON,
            iconIndex: 0,
            appUserModelId: APP_ID,
            description: NAME
        });
    } catch (e) {
        console.error("DeadKernel: couldn't write the Start Menu shortcut", e);
    }
}
