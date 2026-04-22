export const appState = {
  participants: [] as string[],
  script: "",
  analysisResult: "",
  openaiApiKey: "",
  isMobileMode: /Mobi|Android|iPhone/i.test(navigator.userAgent) || (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia),
  useHighSensitivity: true, // 기본값: 고감도(스피커폰) 모드 활성화
  liveTransData: [] as { original: string, translated: string, timestamp: number, source_lang?: string, target_lang?: string }[],
  liveInputLang: "auto",
  liveTranslateLang: "pl",
  glossary: {} as Record<string, { id: string, source: string, target: string, category: string }[]>
};
