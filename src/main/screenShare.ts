/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { desktopCapturer, session, Streams } from "electron";
import { release } from "os";
import type { StreamPick } from "renderer/components/ScreenSharePicker";
import { IpcCommands, IpcEvents } from "shared/IpcEvents";

import { sendRendererCommand } from "./ipcCommands";
import { handle } from "./utils/ipcWrappers";

const isWayland =
    process.platform === "linux" && (process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY);

const supportsLoopbackWithoutChrome = process.platform === "win32" && Number(release().split(".").pop()) >= 19045;

// DeadKernel: the picker used to wait for a thumbnail of every window before it opened. On Windows a
// window that won't capture (hidden helper windows: NVIDIA Broadcast, Razer's monitor...) costs about
// a second each before Chromium gives up, so with three of those the picker took 3.5s, and the
// preview step captured everything again at 1080p for another 3.5s. Now the list (no thumbnails,
// ~0.5s) opens the picker; one capture at preview size follows, fills the grid as it lands, and
// serves the preview from memory.
const PREVIEW = { width: 960, height: 540 };
const GRID_WIDTH = 352;
let previews = new Map<string, string>();
let previewsReady: Promise<void> = Promise.resolve();

function capturePreviews(types: ("window" | "screen")[]) {
    previews = new Map();
    previewsReady = desktopCapturer
        .getSources({ types, thumbnailSize: PREVIEW })
        .then(sources => {
            const grid: Record<string, string> = {};
            for (const { id, thumbnail } of sources) {
                if (thumbnail.isEmpty()) continue;
                previews.set(id, thumbnail.toDataURL());
                grid[id] = thumbnail.resize({ width: GRID_WIDTH }).toDataURL();
            }
            sendRendererCommand(IpcCommands.SCREEN_SHARE_THUMBNAILS, grid).catch(() => {});
        })
        .catch(err => console.error("Error capturing screenshare previews", err));
}

export function registerScreenShareHandler() {
    handle(IpcEvents.CAPTURER_GET_LARGE_THUMBNAIL, async (_, id: string) => {
        await previewsReady;
        if (previews.has(id)) return previews.get(id);
        const sources = await desktopCapturer.getSources({
            types: ["window", "screen"],
            thumbnailSize: {
                width: 1920,
                height: 1080
            }
        });
        return sources.find(s => s.id === id)?.thumbnail.toDataURL();
    });

    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        // request full resolution on wayland right away because we always only end up with one result anyway.
        // Elsewhere: names and app icons now, thumbnails right after (capturePreviews)
        const width = isWayland ? 1920 : 0;
        const sources = await desktopCapturer
            .getSources({
                types: ["window", "screen"],
                thumbnailSize: {
                    width,
                    height: width * (9 / 16)
                },
                fetchWindowIcons: !isWayland
            })
            .catch(err => console.error("Error during screenshare picker", err));

        if (!sources) return callback({});
        if (!isWayland) capturePreviews(["window", "screen"]);

        const data = sources.map(({ id, name, thumbnail, appIcon }) => ({
            id,
            name,
            url: isWayland ? thumbnail.toDataURL() : "",
            icon: appIcon && !appIcon.isEmpty() ? appIcon.toDataURL() : undefined
        }));

        if (isWayland) {
            const video = data[0];
            if (video) {
                const stream = await sendRendererCommand<StreamPick>(IpcCommands.SCREEN_SHARE_PICKER, {
                    screens: [video],
                    skipPicker: true
                }).catch(() => null);

                if (stream === null) return callback({});
            }

            callback(video ? { video: sources[0] } : {});
            return;
        }

        const choice = await sendRendererCommand<StreamPick>(IpcCommands.SCREEN_SHARE_PICKER, {
            screens: data,
            skipPicker: false
        }).catch(e => {
            console.error("Error during screenshare picker", e);
            return null;
        });

        if (!choice) return callback({});

        const source = sources.find(s => s.id === choice.id);
        if (!source) return callback({});

        const streams: Streams = {
            video: source
        };
        if (choice.audio && process.platform === "win32") {
            // @ts-expect-error loopbackWithoutChrome is real but not documented
            streams.audio = supportsLoopbackWithoutChrome ? "loopbackWithoutChrome" : "loopback";
        }

        callback(streams);
    });
}
