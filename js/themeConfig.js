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
      "primary-color": "#5BC0BE",
      "secondary-color": "#FFD166",
      "accent-color": "#FF6B6B",
      "bg-color": "#f8f8f8",
      "card-bg": "#fff",
      "text-color-primary": "#333333",
      "text-color-secondary": "#666",
      "border-color": "#eee",
      "color-danger": "#e74c3c",
      "color-success": "#2ecc71"
    },
    "Night": {
      "primary-color": "#22253B",
      "secondary-color": "#9D70FF",
      "accent-color": "#49EEC2",
      "bg-color": "#181A30",
      "card-bg": "#20243B",
      "text-color-primary": "#F2F6FC",
      "text-color-secondary": "#C2CBF5",
      "border-color": "#282C44",
      "color-danger": "#ff3366",
      "color-success": "#49EEC2"
    },
    "Dark": {
      "primary-color": "#4A90E2",
      "secondary-color": "#7ED4E6",
      "accent-color": "#88B8D4",
      "tertiary-color": "#9B8FC5",
      "accent-opacity": "0.9",
      "text-color-primary": "#ECEFF4",
      "text-color-secondary": "#B4BCD0",
      "text-color-muted": "#8892AB",
      "text-color-on-primary": "#1A1F2E",
      "font-color-primary": "#ECEFF4",
      "font-color-secondary": "#B4BCD0",
      "font-color-muted": "#8892AB",
      "font-color-on-primary": "#1A1F2E",
      "bg-color": "#1A1F2E",
      "surface-background": "rgba(35, 42, 58, 0.85)",
      "card-bg": "rgba(35, 42, 58, 0.85)",
      "card-bg-opacity": "0.85",
      "input-bg": "rgba(35, 42, 58, 0.85)",
      "text-color-on-secondary": "#FFFFFF",
      "text-color-disabled": "#6C7A89",
      "border-color": "rgba(126, 212, 230, 0.25)",
      "border-color-soft": "rgba(126, 212, 230, 0.15)",
      "input-bg-disabled": "#2A3142",
      "input-border-color": "rgba(126, 212, 230, 0.3)",
      "progress-color": "#2ecc71",
      "progress-bar-bg-empty": "#2A3142",
      "macro-protein-color": "#4A90E2",
      "macro-carbs-color": "#E88B8C",
      "macro-fat-color": "#F5C26B",
      "macro-fiber-color": "#6FCF97",
      "macro-ring-highlight": "#ECEFF4",
      "macro-stroke-color": "#3A4556"
    },
    "Vivid": {
      "primary-color": "#00D9FF",
      "secondary-color": "#FF6B9D",
      "accent-color": "#FFB800",
      "tertiary-color": "#A78BFA",
      "accent-opacity": "1",
      "text-color-primary": "#F5F7FA",
      "text-color-secondary": "#C4CAD9",
      "text-color-muted": "#9CA3AF",
      "text-color-on-primary": "#0F172A",
      "font-color-primary": "#F5F7FA",
      "font-color-secondary": "#C4CAD9",
      "font-color-muted": "#9CA3AF",
      "font-color-on-primary": "#0F172A",
      "bg-color": "#0F172A",
      "surface-background": "#1E293B",
      "card-bg": "#1E293B",
      "card-bg-opacity": "0.9",
      "input-bg": "#1E293B",
      "text-color-on-secondary": "#FFFFFF",
      "text-color-disabled": "#6B7280",
      "border-color": "rgba(0, 217, 255, 0.3)",
      "border-color-soft": "rgba(0, 217, 255, 0.15)",
      "input-bg-disabled": "#334155",
      "input-border-color": "rgba(0, 217, 255, 0.4)",
      "progress-color": "#10B981",
      "progress-bar-bg-empty": "#334155",
      "macro-protein-color": "#00D9FF",
      "macro-carbs-color": "#FF6B9D",
      "macro-fat-color": "#FFB800",
      "macro-fiber-color": "#10B981",
      "macro-ring-highlight": "#F5F7FA",
      "macro-stroke-color": "#334155"
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
      "primary-color": "#5BC0BE",
      "secondary-color": "#3A506B",
      "accent-color": "#7D9D9C",
      "bg-color": "#F0F4F8",
      "card-bg": "#ffffff",
      "text-color-primary": "#1b263b",
      "text-color-secondary": "#415a77",
      "border-color": "rgba(58, 80, 107, 0.15)",
      "color-danger": "#e74c3c",
      "color-success": "#2ecc71"
    },
    "Dark": {
      "primary-color": "#4A90E2",
      "secondary-color": "#7ED4E6",
      "accent-color": "#88B8D4",
      "bg-color": "#1A1F2E",
      "card-bg": "rgba(35, 42, 58, 0.85)",
      "text-color-primary": "#ECEFF4",
      "text-color-secondary": "#B4BCD0",
      "border-color": "rgba(126, 212, 230, 0.25)",
      "color-danger": "#EF4444",
      "color-success": "#10B981"
    }
  },
  "quest": {
    "Light": {
      "bg-primary": "#f4f7f6",
      "bg-secondary": "#ffffff",
      "bg-surface": "#f2f2f2",
      "accent-primary": "#43a088",
      "accent-secondary": "#3a8c75",
      "text-primary": "#1a1a1a",
      "text-secondary": "#555",
      "border-color": "#ccc",
      "error-color": "#d32f2f",
      "success-color": "#388e3c"
    },
    "Night": {
      "bg-primary": "#181A30",
      "bg-secondary": "#20243B",
      "bg-surface": "#20243B",
      "accent-primary": "#9D70FF",
      "accent-secondary": "#49EEC2",
      "text-primary": "#F2F6FC",
      "text-secondary": "#C2CBF5",
      "border-color": "#282C44",
      "error-color": "#ff3366",
      "success-color": "#49EEC2"
    },
    "Dark": {
      "bg-primary": "#1A1F2E",
      "bg-secondary": "rgba(35, 42, 58, 0.85)",
      "bg-surface": "rgba(35, 42, 58, 0.85)",
      "accent-primary": "#4A90E2",
      "accent-secondary": "#88B8D4",
      "text-primary": "#ECEFF4",
      "text-secondary": "#B4BCD0",
      "border-color": "rgba(126, 212, 230, 0.25)",
      "error-color": "#EF4444",
      "success-color": "#10B981"
    },
    "Vivid": {
      "bg-primary": "#0F172A",
      "bg-secondary": "#1E293B",
      "bg-surface": "#1E293B",
      "accent-primary": "#00D9FF",
      "accent-secondary": "#FFB800",
      "text-primary": "#F5F7FA",
      "text-secondary": "#C4CAD9",
      "border-color": "rgba(0, 217, 255, 0.3)",
      "error-color": "#EF4444",
      "success-color": "#10B981"
    }
  },
  "code": {
    "Light": {
      "code-bg": "#f5f5f5",
      "code-text-primary": "#333333",
      "code-accent": "#5BC0BE"
    },
    "Night": {
      "code-bg": "#181A30",
      "code-text-primary": "#F2F6FC",
      "code-accent": "#9D70FF",
      "code-secondary-accent": "#49EEC2"
    },
    "Dark": {
      "code-bg": "#1A1F2E",
      "code-text-primary": "#ECEFF4",
      "code-accent": "#4A90E2"
    },
    "Vivid": {
      "code-bg": "#0A0F1C",
      "code-text-primary": "#F5F7FA",
      "code-accent": "#00D9FF"
    }
  }
};
