export const isValidURL = async (value: string) => {
  let isValid = true;

  try {
    new URL(value);
  } catch (_) {
    isValid = false;
  }
  return isValid;
};
