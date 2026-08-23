function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function voicePromptsFor(view) {
  const report = clean(view?.hint || "");
  return [
    {
      key: "report",
      label: "Bericht sprechen",
      taskType: "read_aloud",
      text: report,
      expectedText: report,
      requiredConcepts: [clean(view?.titleDe)].filter(Boolean),
      stageIndex: 0,
      stageNumber: 1,
      stageCount: 1,
      promptId: `${view?.patientId || "patient"}-report`,
    },
  ];
}

export function voicePromptAt(view, index = 0) {
  const prompts = voicePromptsFor(view);
  return prompts[Math.max(0, Math.min(prompts.length - 1, Number(index) || 0))] || null;
}

export const VOICE_STAGE_COUNT = 1;
