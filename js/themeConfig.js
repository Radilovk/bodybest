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
      "primary-color": "#84A98C",
      "secondary-color": "#E4725C",
      "accent-color": "#B5A3C3",
      "tertiary-color": "#8E6CC3",
      "accent-opacity": "1",
      "text-color-primary": "#F0F2F5",
      "text-color-secondary": "#A0A5B9",
      "text-color-muted": "#bbb",
      "text-color-on-primary": "#1C1F2E",
      "font-color-primary": "#F0F2F5",
      "font-color-secondary": "#A0A5B9",
      "font-color-muted": "#bbb",
      "font-color-on-primary": "#1C1F2E",
      "bg-color": "#1C1F2E",
      "surface-background": "#252A41",
      "card-bg": "#252A41",
      "card-bg-opacity": "0.75",
      "input-bg": "#252A41",
      "text-color-on-secondary": "#FFFFFF",
      "text-color-disabled": "#adb5bd",
      "border-color": "#34374B",
      "border-color-soft": "#2D3044",
      "input-bg-disabled": "#2C3147",
      "input-border-color": "#3C425A",
      "progress-color": "#2ecc71",
      "progress-bar-bg-empty": "#393E57",
      "macro-protein-color": "#5BC0BE",
      "macro-carbs-color": "#FF6B6B",
      "macro-fat-color": "#FFD166",
      "macro-fiber-color": "#6FCF97",
      "macro-ring-highlight": "#1C1F2E",
      "macro-stroke-color": "#444444"
    },
    "Vivid": {
      "primary-color": "#5BC0BE",
      "secondary-color": "#FFD166",
      "accent-color": "#FF6B6B",
      "tertiary-color": "#FF9C9C",
      "accent-opacity": "1",
      "text-color-primary": "#F0F2F5",
      "text-color-secondary": "#A0A5B9",
      "text-color-muted": "#bbb",
      "text-color-on-primary": "#1C1F2E",
      "font-color-primary": "#F0F2F5",
      "font-color-secondary": "#A0A5B9",
      "font-color-muted": "#bbb",
      "font-color-on-primary": "#1C1F2E",
      "bg-color": "#1C1F2E",
      "surface-background": "#252A41",
      "card-bg": "#252A41",
      "card-bg-opacity": "0.75",
      "input-bg": "#252A41",
      "text-color-on-secondary": "#FFFFFF",
      "text-color-disabled": "#adb5bd",
      "border-color": "#34374B",
      "border-color-soft": "#2D3044",
      "input-bg-disabled": "#2C3147",
      "input-border-color": "#3C425A",
      "progress-color": "#80FF80",
      "progress-bar-bg-empty": "#393E57",
      "macro-protein-color": "#5BC0BE",
      "macro-carbs-color": "#FF6B6B",
      "macro-fat-color": "#FFD166",
      "macro-fiber-color": "#6FCF97",
      "macro-ring-highlight": "#1C1F2E",
      "macro-stroke-color": "#444444"
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
      "primary-color": "#3A506B",
      "secondary-color": "#5BC0BE",
      "accent-color": "#778DA9",
      "bg-color": "#F0F4F8",
      "card-bg": "#ffffff",
      "text-color-primary": "#2c3e50",
      "text-color-secondary": "#555",
      "border-color": "#d0d8e0",
      "color-danger": "#e74c3c",
      "color-success": "#2ecc71"
    },
    "Dark": {
      "primary-color": "#84A98C",
      "secondary-color": "#E4725C",
      "accent-color": "#B5A3C3",
      "bg-color": "#1C1F2E",
      "card-bg": "#252A41",
      "text-color-primary": "#F0F2F5",
      "text-color-secondary": "#A0A5B9",
      "border-color": "#34374B",
      "color-danger": "#e74c3c",
      "color-success": "#2ecc71"
    },
    "Vivid": {
      "primary-color": "#5BC0BE",
      "secondary-color": "#FFD166",
      "accent-color": "#FF6B6B",
      "bg-color": "#1C1F2E",
      "card-bg": "#252A41",
      "text-color-primary": "#F0F2F5",
      "text-color-secondary": "#A0A5B9",
      "border-color": "#34374B",
      "color-danger": "#e74c3c",
      "color-success": "#2ecc71"
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
      "bg-primary": "#121212",
      "bg-secondary": "#1e1e1e",
      "bg-surface": "#2a2a2a",
      "accent-primary": "#4fc3a1",
      "accent-secondary": "#80cbc4",
      "text-primary": "#E0E0E0",
      "text-secondary": "#b0b0b0",
      "border-color": "#333",
      "error-color": "#e74c3c",
      "success-color": "#2ecc71"
    },
    "Vivid": {
      "bg-primary": "#222244",
      "bg-secondary": "#1e1e1e",
      "bg-surface": "#2a2a2a",
      "accent-primary": "#ff3399",
      "accent-secondary": "#80cbc4",
      "text-primary": "#E0E0E0",
      "text-secondary": "#b0b0b0",
      "border-color": "#333",
      "error-color": "#e74c3c",
      "success-color": "#2ecc71"
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
      "code-bg": "#1e1e1e",
      "code-text-primary": "#e0e0e0",
      "code-accent": "#ff3366"
    },
    "Vivid": {
      "code-bg": "#001122",
      "code-text-primary": "#ffffff",
      "code-accent": "#ff6600"
    }
  }
};
