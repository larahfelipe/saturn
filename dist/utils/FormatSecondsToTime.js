"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSecondsToTime = void 0;
function formatSecondsToTime(seconds) {
    const convertToDays = Math.floor(seconds / (3600 * 24));
    const convertToHours = Math.floor((seconds % (3600 * 24)) / 3600);
    const convertToMinutes = Math.floor((seconds % 3600) / 60);
    const convertToSeconds = Math.floor(seconds % 60);
    const formatDays = convertToDays.toString().padStart(2, '0');
    const formatHours = convertToHours.toString().padStart(2, '0');
    const formatMinutes = convertToMinutes.toString().padStart(2, '0');
    const formatSeconds = convertToSeconds.toString().padStart(2, '0');
    return `${formatDays}d${formatHours}h${formatMinutes}m${formatSeconds}s`;
}
exports.formatSecondsToTime = formatSecondsToTime;
