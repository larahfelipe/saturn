const parseTime = (time: number, timeReference: string) => {
  return time === 0 ? '' : time.toString().padStart(2, '0') + timeReference;
};

export const formatSecondsToStdTime = (seconds: number) => {
  const convertToDays = Math.floor(seconds / (3600 * 24));
  const convertToHours = Math.floor((seconds % (3600 * 24)) / 3600);
  const convertToMinutes = Math.floor((seconds % 3600) / 60);
  const convertToSeconds = Math.floor(seconds % 60);

  const formatDays = parseTime(convertToDays, 'd');
  const formatHours = parseTime(convertToHours, 'h');
  const formatMinutes = parseTime(convertToMinutes, 'm');
  const formatSeconds = parseTime(convertToSeconds, 's');

  return `${formatDays}${formatHours}${formatMinutes}${formatSeconds}`;
};
