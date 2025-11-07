export const colorGroups = [
  {
    name: 'Основни цветове',
    items: [
      { var: 'primary-color', label: 'Основен цвят', description: 'Бутоните и заглавията' },
      { var: 'secondary-color', label: 'Втори цвят', description: 'Линкове и акценти' },
      { var: 'accent-color', label: 'Акцентен цвят', description: 'Икони, маркировки' },
      { var: 'tertiary-color', label: 'Трети цвят', description: 'Допълнителни елементи' },
      { var: 'accent-opacity', label: 'Прозрачност на акцента', type: 'range' }
    ]
  },
  {
    name: 'Текст',
    items: [
      { var: 'text-color-primary', label: 'Основен текст' },
      { var: 'text-color-secondary', label: 'Втори текст' },
      { var: 'text-color-muted', label: 'Олекотен текст' },
      { var: 'text-color-on-primary', label: 'Текст върху основен цвят' },
      { var: 'font-color-primary', label: 'Цвят на шрифт - основен' },
      { var: 'font-color-secondary', label: 'Цвят на шрифт - втори' },
      { var: 'font-color-muted', label: 'Цвят на шрифт - олекотен' },
      { var: 'font-color-on-primary', label: 'Цвят на шрифт върху основен' }
    ]
  },
  {
    name: 'Фонове',
    items: [
      { var: 'bg-color', label: 'Фон на страницата' },
      { var: 'surface-background', label: 'Фон на съдържание' },
      { var: 'card-bg', label: 'Фон на карти' },
      { var: 'card-bg-opacity', label: 'Прозрачност на карти', type: 'range' },
      { var: 'input-bg', label: 'Фон на полета' }
    ]
  },
  {
    name: 'Граници и полета',
    items: [
      { var: 'text-color-on-secondary', label: 'Текст върху втори цвят' },
      { var: 'text-color-disabled', label: 'Неактивен текст' },
      { var: 'border-color', label: 'Цвят на рамките' },
      { var: 'border-color-soft', label: 'Слаб цвят на рамки' },
      { var: 'input-bg-disabled', label: 'Фон на деактивирано поле' },
      { var: 'input-border-color', label: 'Рамка на полета' }
    ]
  },
  {
    name: 'Прогрес барове',
    items: [
      { var: 'progress-color', label: 'Цвят на прогрес' },
      { var: 'progress-bar-bg-empty', label: 'Празен прогрес бар' }
    ]
  },
  {
    name: 'Цветове на макроси',
    items: [
      { var: 'macro-protein-color', label: 'Белтъчини' },
      { var: 'macro-carbs-color', label: 'Въглехидрати' },
      { var: 'macro-fat-color', label: 'Мазнини' },
      { var: 'macro-fiber-color', label: 'Фибри' },
      { var: 'macro-ring-highlight', label: 'Акцент на пръстен' },
      { var: 'macro-stroke-color', label: 'Цвят на рамка' }
    ]
  },
  {
    name: 'Index',
    items: [
      { var: 'primary-color', label: 'Основен цвят' },
      { var: 'secondary-color', label: 'Втори цвят' },
      { var: 'accent-color', label: 'Акцентен цвят' },
      { var: 'bg-color', label: 'Фон на страницата' },
      { var: 'card-bg', label: 'Фон на карти' },
      { var: 'text-color-primary', label: 'Основен текст' },
      { var: 'text-color-secondary', label: 'Втори текст' },
      { var: 'border-color', label: 'Рамки' },
      { var: 'color-danger', label: 'Грешки' },
      { var: 'color-success', label: 'Успехи' }
    ]
  },
  {
    name: 'Quest',
    items: [
      { var: 'bg-primary', label: 'Фон основен' },
      { var: 'bg-secondary', label: 'Фон втори' },
      { var: 'bg-surface', label: 'Фон на съдържание' },
      { var: 'accent-primary', label: 'Акцент' },
      { var: 'accent-secondary', label: 'Допълнителен акцент' },
      { var: 'text-primary', label: 'Основен текст' },
      { var: 'text-secondary', label: 'Втори текст' },
      { var: 'border-color', label: 'Рамки' },
      { var: 'error-color', label: 'Грешки' },
      { var: 'success-color', label: 'Успехи' }
    ]
  },
  {
    name: 'Code',
    items: [
      { var: 'code-bg', label: 'Фон' },
      { var: 'code-text-primary', label: 'Основен текст' },
      { var: 'code-accent', label: 'Акцент' }
    ]
  }
];

export const macroColorVars = ['macro-protein-color', 'macro-carbs-color', 'macro-fat-color', 'macro-fiber-color'];

export const sampleThemes = {
  "dashboard": {
    "Light": {
      "primary-color": "#4A90E2",
      "secondary-color": "#50C9CE",
      "accent-color": "#7B68EE",
      "tertiary-color": "#E89AC7",
      "accent-opacity": "1",
      "text-color-primary": "#1A202C",
      "text-color-secondary": "#4A5568",
      "text-color-muted": "#718096",
      "text-color-on-primary": "#FFFFFF",
      "font-color-primary": "#1A202C",
      "font-color-secondary": "#4A5568",
      "font-color-muted": "#718096",
      "font-color-on-primary": "#FFFFFF",
      "bg-color": "#F7FAFC",
      "surface-background": "#FFFFFF",
      "card-bg": "#ffffff",
      "card-bg-opacity": "0.95",
      "input-bg": "#FFFFFF",
      "text-color-on-secondary": "#FFFFFF",
      "text-color-disabled": "#A0AEC0",
      "border-color": "#E2E8F0",
      "border-color-soft": "#EDF2F7",
      "input-bg-disabled": "#EDF2F7",
      "input-border-color": "#CBD5E0",
      "progress-color": "#10B981",
      "progress-bar-bg-empty": "#E5E7EB",
      "macro-protein-color": "#50C9CE",
      "macro-carbs-color": "#FF6B9D",
      "macro-fat-color": "#FFB84D",
      "macro-fiber-color": "#66D9A6",
      "macro-ring-highlight": "#ffffff",
      "macro-stroke-color": "#E2E8F0"
    },
    "Dark": {
      "primary-color": "#60D394",
      "secondary-color": "#EE6C4D",
      "accent-color": "#C77DFF",
      "tertiary-color": "#A78BFA",
      "accent-opacity": "1",
      "text-color-primary": "#F1F5F9",
      "text-color-secondary": "#CBD5E1",
      "text-color-muted": "#94A3B8",
      "text-color-on-primary": "#0F172A",
      "font-color-primary": "#F1F5F9",
      "font-color-secondary": "#CBD5E1",
      "font-color-muted": "#94A3B8",
      "font-color-on-primary": "#0F172A",
      "bg-color": "#0F172A",
      "surface-background": "#1E293B",
      "card-bg": "#1E293B",
      "card-bg-opacity": "0.85",
      "input-bg": "#1E293B",
      "text-color-on-secondary": "#FFFFFF",
      "text-color-disabled": "#64748B",
      "border-color": "#334155",
      "border-color-soft": "#27364A",
      "input-bg-disabled": "#27364A",
      "input-border-color": "#475569",
      "progress-color": "#10B981",
      "progress-bar-bg-empty": "#334155",
      "macro-protein-color": "#60D394",
      "macro-carbs-color": "#FF6B9D",
      "macro-fat-color": "#FFB84D",
      "macro-fiber-color": "#66D9A6",
      "macro-ring-highlight": "#F1F5F9",
      "macro-stroke-color": "#475569"
    },
    "Vivid": {
      "primary-color": "#22D3EE",
      "secondary-color": "#FBBF24",
      "accent-color": "#F472B6",
      "tertiary-color": "#FB923C",
      "accent-opacity": "1",
      "text-color-primary": "#F1F5F9",
      "text-color-secondary": "#CBD5E1",
      "text-color-muted": "#94A3B8",
      "text-color-on-primary": "#0F172A",
      "font-color-primary": "#F1F5F9",
      "font-color-secondary": "#CBD5E1",
      "font-color-muted": "#94A3B8",
      "font-color-on-primary": "#0F172A",
      "bg-color": "#0F172A",
      "surface-background": "#1E293B",
      "card-bg": "#1E293B",
      "card-bg-opacity": "0.85",
      "input-bg": "#1E293B",
      "text-color-on-secondary": "#0F172A",
      "text-color-disabled": "#64748B",
      "border-color": "#334155",
      "border-color-soft": "#27364A",
      "input-bg-disabled": "#27364A",
      "input-border-color": "#475569",
      "progress-color": "#10B981",
      "progress-bar-bg-empty": "#334155",
      "macro-protein-color": "#22D3EE",
      "macro-carbs-color": "#F472B6",
      "macro-fat-color": "#FBBF24",
      "macro-fiber-color": "#34D399",
      "macro-ring-highlight": "#F1F5F9",
      "macro-stroke-color": "#475569"
    },
    "HighContrast": {
      "primary-color": "#FFFFFF",
      "secondary-color": "#FFD700",
      "accent-color": "#00FFFF",
      "tertiary-color": "#FF00FF",
      "accent-opacity": "1",
      "text-color-primary": "#FFFFFF",
      "text-color-secondary": "#FFD700",
      "text-color-muted": "#AAAAAA",
      "text-color-on-primary": "#000000",
      "font-color-primary": "#FFFFFF",
      "font-color-secondary": "#FFD700",
      "font-color-muted": "#AAAAAA",
      "font-color-on-primary": "#000000",
      "bg-color": "#000000",
      "surface-background": "#000000",
      "card-bg": "#000000",
      "card-bg-opacity": "1",
      "input-bg": "#000000",
      "text-color-on-secondary": "#000000",
      "text-color-disabled": "#666666",
      "border-color": "#FFFFFF",
      "border-color-soft": "#666666",
      "input-bg-disabled": "#333333",
      "input-border-color": "#FFFFFF",
      "progress-color": "#FFFFFF",
      "progress-bar-bg-empty": "#333333",
      "macro-protein-color": "#FFFF00",
      "macro-carbs-color": "#00FFFF",
      "macro-fat-color": "#FF00FF",
      "macro-fiber-color": "#FFFFFF",
      "macro-ring-highlight": "#FFFFFF",
      "macro-stroke-color": "#FFFFFF"
    }
  },
  "index": {
    "Light": {
      "primary-color": "#4A90E2",
      "secondary-color": "#50C9CE",
      "accent-color": "#7B68EE",
      "bg-color": "#F7FAFC",
      "card-bg": "#ffffff",
      "text-color-primary": "#1A202C",
      "text-color-secondary": "#4A5568",
      "border-color": "#E2E8F0",
      "color-danger": "#EF4444",
      "color-success": "#10B981"
    },
    "Dark": {
      "primary-color": "#60D394",
      "secondary-color": "#EE6C4D",
      "accent-color": "#C77DFF",
      "bg-color": "#0F172A",
      "card-bg": "#1E293B",
      "text-color-primary": "#F1F5F9",
      "text-color-secondary": "#CBD5E1",
      "border-color": "#334155",
      "color-danger": "#EF4444",
      "color-success": "#10B981"
    },
    "Vivid": {
      "primary-color": "#22D3EE",
      "secondary-color": "#FBBF24",
      "accent-color": "#F472B6",
      "bg-color": "#0F172A",
      "card-bg": "#1E293B",
      "text-color-primary": "#F1F5F9",
      "text-color-secondary": "#CBD5E1",
      "border-color": "#334155",
      "color-danger": "#EF4444",
      "color-success": "#10B981"
    }
  },
  "quest": {
    "Light": {
      "bg-primary": "#F7FAFC",
      "bg-secondary": "#ffffff",
      "bg-surface": "#EDF2F7",
      "accent-primary": "#4A90E2",
      "accent-secondary": "#50C9CE",
      "text-primary": "#1A202C",
      "text-secondary": "#4A5568",
      "border-color": "#E2E8F0",
      "error-color": "#EF4444",
      "success-color": "#10B981"
    },
    "Dark": {
      "bg-primary": "#0F172A",
      "bg-secondary": "#1E293B",
      "bg-surface": "#27364A",
      "accent-primary": "#60D394",
      "accent-secondary": "#C77DFF",
      "text-primary": "#F1F5F9",
      "text-secondary": "#CBD5E1",
      "border-color": "#334155",
      "error-color": "#EF4444",
      "success-color": "#10B981"
    },
    "Vivid": {
      "bg-primary": "#0F172A",
      "bg-secondary": "#1E293B",
      "bg-surface": "#27364A",
      "accent-primary": "#22D3EE",
      "accent-secondary": "#F472B6",
      "text-primary": "#F1F5F9",
      "text-secondary": "#CBD5E1",
      "border-color": "#334155",
      "error-color": "#EF4444",
      "success-color": "#10B981"
    }
  },
  "code": {
    "Light": {
      "code-bg": "#F8FAFC",
      "code-text-primary": "#334155",
      "code-accent": "#4A90E2"
    },
    "Dark": {
      "code-bg": "#0F172A",
      "code-text-primary": "#E2E8F0",
      "code-accent": "#C77DFF"
    },
    "Vivid": {
      "code-bg": "#0C1222",
      "code-text-primary": "#E2E8F0",
      "code-accent": "#F472B6"
    }
  }
};
