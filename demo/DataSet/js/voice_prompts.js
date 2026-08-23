const STAGES = Object.freeze([
  { key: "dispatch", label: "Leitstelle bestätigen", taskType: "read_aloud" },
  { key: "question", label: "Patient befragen", taskType: "command" },
  { key: "finding", label: "Befund melden", taskType: "read_aloud" },
  { key: "treatment", label: "Maßnahme ansagen", taskType: "command" },
  { key: "handoff", label: "Übergabe funken", taskType: "spontaneous_handoff" },
]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shortVital(view) {
  const values = [];
  if (view.vitals?.HF) values.push(`Puls ${view.vitals.HF}`);
  if (view.vitals?.SpO2) values.push(`Sättigung ${view.vitals.SpO2}`);
  if (view.vitals?.RR) values.push(`Blutdruck ${view.vitals.RR}`);
  return values.slice(0, 2).join(" und ");
}

export function voicePromptsFor(view) {
  const symptom = clean(view.symptoms?.[0]?.de || view.titleDe || "akute Beschwerden");
  const vital = shortVital(view);
  const treatment = clean(view.requiredActionLabels?.[0] || "die angezeigte Notfallmaßnahme");
  const prompts = [
    {
      text: `Leitstelle verstanden. Ich übernehme den Einsatz ${clean(view.titleDe)}.`,
      expectedText: `Leitstelle verstanden. Ich übernehme den Einsatz ${clean(view.titleDe)}.`,
      requiredConcepts: ["leitstelle", clean(view.titleDe)],
    },
    {
      text: `${clean(view.name)}, was ist passiert und wo haben Sie Beschwerden?`,
      expectedText: `${clean(view.name)}, was ist passiert und wo haben Sie Beschwerden?`,
      requiredConcepts: [clean(view.name), "passiert", "beschwerden"],
    },
    {
      text: `Der Patient zeigt ${symptom}${vital ? `, ${vital}` : ""}.`,
      expectedText: `Der Patient zeigt ${symptom}${vital ? `, ${vital}` : ""}.`,
      requiredConcepts: [symptom, vital].filter(Boolean),
    },
    {
      text: `Ich führe jetzt ${treatment} durch.`,
      expectedText: `Ich führe jetzt ${treatment} durch.`,
      requiredConcepts: [treatment],
    },
    {
      text: `Übergib den Fall jetzt in eigenen Worten. Nutze diese Fakten: ${clean(view.hint)}`,
      expectedText: "",
      requiredConcepts: [clean(view.titleDe), symptom, treatment],
    },
  ];
  return STAGES.map((stage, index) => ({
    ...stage,
    ...prompts[index],
    stageIndex: index,
    stageNumber: index + 1,
    stageCount: STAGES.length,
    promptId: `${view.patientId}-${stage.key}`,
  }));
}

export function voicePromptAt(view, index = 0) {
  const prompts = voicePromptsFor(view);
  return prompts[Math.max(0, Math.min(prompts.length - 1, Number(index) || 0))];
}

export function shortenVoicePrompt(prompt) {
  if (!prompt || prompt.shortened) return prompt;
  const concepts = (prompt.requiredConcepts || []).filter(Boolean);
  let expectedText = prompt.expectedText || "";
  let text = prompt.text || expectedText;
  let requiredConcepts = concepts.slice(0, 1);
  if (prompt.key === "dispatch") {
    expectedText = "Leitstelle verstanden. Einsatz übernommen.";
    text = expectedText;
    requiredConcepts = ["leitstelle", "einsatz"];
  } else if (prompt.key === "question") {
    expectedText = "Was ist passiert und wo sind die Beschwerden?";
    text = expectedText;
    requiredConcepts = ["passiert", "beschwerden"];
  } else if (prompt.key === "finding") {
    expectedText = `${expectedText.split(",", 1)[0].replace(/[.!?]+$/, "")}.`;
    text = expectedText;
  } else if (prompt.key === "handoff") {
    requiredConcepts = concepts.slice(0, 2);
    text = `Kurze Übergabe in einem Satz. Nenne: ${requiredConcepts.join(" · ")}`;
  }
  return { ...prompt, text, expectedText, requiredConcepts, shortened: true };
}

export const VOICE_STAGE_COUNT = STAGES.length;
