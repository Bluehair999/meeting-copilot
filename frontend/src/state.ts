export const appState = {
  participants: [] as string[],
  script: "",
  analysisResult: "",
  openaiApiKey: "",
  isMobileMode: /Mobi|Android|iPhone/i.test(navigator.userAgent) || (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)
};
