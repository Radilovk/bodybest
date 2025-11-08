import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DATA_PATH = path.resolve('docs/change-log-data.json');
const OUTPUT_PATH = path.resolve('docs/change-log.md');

async function loadEntries() {
  const raw = await readFile(DATA_PATH, 'utf8');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    throw new Error('Файлът change-log-data.json трябва да съдържа масив от записи.');
  }
  return entries;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Невалидна дата в журнала: ${timestamp}`);
  }
  const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
  return `${dateFormatter.format(date)} UTC`;
}

function collectCommitStats(commit) {
  let output = '';
  try {
    output = execSync(`git show --numstat --format= --no-color ${commit}`, {
      encoding: 'utf8',
    });
  } catch {
    throw new Error(`Неуспешно извличане на статистика за commit ${commit}.`);
  }

  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const files = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [insertionsRaw, deletionsRaw, ...paths] = parts;
    const insertions = insertionsRaw === '-' ? null : Number.parseInt(insertionsRaw, 10);
    const deletions = deletionsRaw === '-' ? null : Number.parseInt(deletionsRaw, 10);
    const pathLabel = paths.length === 1 ? paths[0] : `${paths[0]} → ${paths[paths.length - 1]}`;
    files.push({
      path: pathLabel,
      insertions: Number.isNaN(insertions) ? null : insertions,
      deletions: Number.isNaN(deletions) ? null : deletions,
    });
  }

  const totals = files.reduce(
    (acc, file) => {
      acc.filesChanged += 1;
      if (typeof file.insertions === 'number') acc.insertions += file.insertions;
      if (typeof file.deletions === 'number') acc.deletions += file.deletions;
      return acc;
    },
    { filesChanged: 0, insertions: 0, deletions: 0 },
  );

  return { files, totals };
}

function renderFileRow(file, notes) {
  const additions = typeof file.insertions === 'number' ? `+${file.insertions}` : '—';
  const removals = typeof file.deletions === 'number' ? `-${file.deletions}` : '—';
  const note = notes[file.path] ?? '—';
  return `| \`${file.path}\` | ${additions} | ${removals} | ${note} |`;
}

function renderEntry(entry) {
  const { commit, request, summary, reason, timestamp, notes = {} } = entry;
  if (!commit || !summary || !reason || !request || !timestamp) {
    throw new Error(`Записът за commit ${commit} е непълен.`);
  }

  const formattedTime = formatTimestamp(timestamp);
  const { files, totals } = collectCommitStats(commit);
  const shortCommit = commit.slice(0, 8);
  const header = `## ${formattedTime} · ${summary}`;
  const metaLines = [
    `- **Commit:** \`${shortCommit}\``,
    `- **Заявка / Request:** ${request}`,
    `- **Причина:** ${reason}`,
  ];

  const statsLines = [
    `- **Засегнати файлове:** ${totals.filesChanged}`,
    `- **Добавени редове:** ${totals.insertions}`,
    `- **Изтрити редове:** ${totals.deletions}`,
  ];

  const tableHeader = '| Файл | Добавени | Изтрити | Бележка |';
  const tableDivider = '| --- | --- | --- | --- |';
  const tableRows = files.map((file) => renderFileRow(file, notes));

  return [
    header,
    '',
    ...metaLines,
    '',
    ...statsLines,
    '',
    tableHeader,
    tableDivider,
    ...tableRows,
    '',
  ].join('\n');
}

async function generate() {
  const entries = await loadEntries();
  if (entries.length === 0) {
    const emptyContent = [
      '# Журнал на последните промени',
      '',
      '> Все още няма записани промени. Добавете записи в `docs/change-log-data.json` и стартирайте `npm run log:generate`.',
      '',
    ].join('\n');
    await writeFile(OUTPUT_PATH, `${emptyContent}\n`, 'utf8');
    return;
  }

  const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const parts = [
    '# Журнал на последните промени',
    '',
    '> Файлът се генерира автоматично от `docs/change-log-data.json` чрез `npm run log:generate`. Не редактирайте ръчно.',
    '',
  ];

  for (const entry of sortedEntries) {
    parts.push(renderEntry(entry));
  }

  const content = `${parts.join('\n')}\n`;
  await writeFile(OUTPUT_PATH, content, 'utf8');
}

generate().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
