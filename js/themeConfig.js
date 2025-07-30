export const colorGroups = [
  {
    name: 'Основни цветове',
    items: [
      { var: 'primary-color', label: 'Основен цвят', description: 'Бутоните и заглавията' },
      { var: 'secondary-color', label: 'Втори цвят', description: 'Линкове и акценти' },
      { var: 'accent-color', label: 'Акцентен цвят', description: 'Икони, маркировки' },
      { var: 'tertiary-color', label: 'Трети цвят', description: 'Допълнителни елементи' }
    ]
  },
  {
    name: 'Текст',
    items: [
      { var: 'text-color-primary', label: 'Основен текст' },
      { var: 'text-color-secondary', label: 'Втори текст' },
      { var: 'text-color-muted', label: 'Олекотен текст' },
      { var: 'text-color-on-primary', label: 'Текст върху основен цвят' }
    ]
  },
  {
    name: 'Фонове',
    items: [
      { var: 'bg-color', label: 'Фон на страницата' },
      { var: 'surface-background', label: 'Фон на съдържание' },
      { var: 'card-bg', label: 'Фон на карти' },
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
      { var: 'progress-end-color', label: 'Краен цвят на прогрес' },
      { var: 'progress-bar-bg-empty', label: 'Празен прогрес бар' }
    ]
  },
  {
    name: 'Цветове на макроси',
    items: [
      { var: 'macro-protein-color', label: 'Белтъчини' },
      { var: 'macro-carbs-color', label: 'Въглехидрати' },
      { var: 'macro-fat-color', label: 'Мазнини' },
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

export const sampleThemes = {
  dashboard: {
    Light: {
      'primary-color': '#3A506B',
      'secondary-color': '#5BC0BE',
      'macro-protein-color': '#5BC0BE',
      'macro-carbs-color': '#FF6B6B',
      'macro-fat-color': '#FFD166',
      'macro-ring-highlight': '#ffffff',
      'macro-stroke-color': '#e0e0e0'
    },
    Dark: {
      'primary-color': '#5BC0BE',
      'secondary-color': '#3A506B',
      'macro-protein-color': '#5BC0BE',
      'macro-carbs-color': '#FF6B6B',
      'macro-fat-color': '#FFD166',
      'macro-ring-highlight': '#1C1F2E',
      'macro-stroke-color': '#444444'
    },
    Vivid: {
      'primary-color': '#5BC0BE',
      'secondary-color': '#FFD166',
      'macro-protein-color': '#5BC0BE',
      'macro-carbs-color': '#FF6B6B',
      'macro-fat-color': '#FFD166',
      'macro-ring-highlight': '#ffffff',
      'macro-stroke-color': '#333333'
    }
  },
  index: {
    Light: {
      'primary-color': '#3A506B',
      'secondary-color': '#5BC0BE'
    },
    Dark: {
      'primary-color': '#5BC0BE',
      'secondary-color': '#3A506B'
    },
    Vivid: {
      'primary-color': '#ff3366',
      'secondary-color': '#00e0ff'
    }
  },
  quest: {
    Light: {
      'accent-primary': '#43a088',
      'bg-primary': '#f4f7f6'
    },
    Dark: {
      'accent-primary': '#4fc3a1',
      'bg-primary': '#121212'
    },
    Vivid: {
      'accent-primary': '#ff3399',
      'bg-primary': '#222244'
    }
  },
  code: {
    Light: {
      'code-bg': '#f5f5f5',
      'code-text-primary': '#333333',
      'code-accent': '#5BC0BE'
    },
    Dark: {
      'code-bg': '#1e1e1e',
      'code-text-primary': '#e0e0e0',
      'code-accent': '#ff3366'
    },
    Vivid: {
      'code-bg': '#001122',
      'code-text-primary': '#ffffff',
      'code-accent': '#ff6600'
    }
  }
};
