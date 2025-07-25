export async function generateProfile(replacements, env, modelName) {
  const template = await env.RESOURCES_KV.get('prompt_generate_profile');
  if (!template) throw new Error('Missing prompt_generate_profile');
  const populated = populatePrompt(template, replacements);
  const raw = await callModel(modelName, populated, env, { temperature: 0.1, maxTokens: 4000 });
  const cleaned = cleanGeminiJson(raw);
  return safeParseJson(cleaned, {});
}

export async function generateMenu(replacements, env, modelName) {
  const template = await env.RESOURCES_KV.get('prompt_generate_menu');
  if (!template) throw new Error('Missing prompt_generate_menu');
  const populated = populatePrompt(template, replacements);
  const raw = await callModel(modelName, populated, env, { temperature: 0.1, maxTokens: 4000 });
  const cleaned = cleanGeminiJson(raw);
  return safeParseJson(cleaned, {});
}

export async function generatePrinciples(replacements, env, modelName) {
  const template = await env.RESOURCES_KV.get('prompt_generate_principles');
  if (!template) throw new Error('Missing prompt_generate_principles');
  const populated = populatePrompt(template, replacements);
  const raw = await callModel(modelName, populated, env, { temperature: 0.1, maxTokens: 4000 });
  const cleaned = cleanGeminiJson(raw);
  return safeParseJson(cleaned, {});
}

export async function generateGuidance(replacements, env, modelName) {
  const template = await env.RESOURCES_KV.get('prompt_generate_guidance');
  if (!template) throw new Error('Missing prompt_generate_guidance');
  const populated = populatePrompt(template, replacements);
  const raw = await callModel(modelName, populated, env, { temperature: 0.1, maxTokens: 4000 });
  const cleaned = cleanGeminiJson(raw);
  return safeParseJson(cleaned, {});
}

