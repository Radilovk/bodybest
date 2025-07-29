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
      { var: 'input-bg', label: 'Фон на полета' },
      { var: 'bg-gradient', label: 'Градиент на фон', type: 'text' }
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
      { var: 'progress-bar-bg-empty', label: 'Празен прогрес бар' },
      { var: 'progress-gradient', label: 'Градиент на прогрес', type: 'text' }
    ]
  },
  {
    name: 'Прозрачности',
    items: [
      { var: 'card-bg-opacity', label: 'Прозрачност на карти', type: 'range', min: 0, max: 1, step: 0.05 },
      { var: 'menu-overlay-opacity', label: 'Навигационно затъмнение', type: 'range', min: 0, max: 1, step: 0.05 },
      { var: 'modal-overlay-opacity', label: 'Модално затъмнение', type: 'range', min: 0, max: 1, step: 0.05 }
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
  }
];

export const sampleThemes = {
  dashboard: {
    Light: {
      'primary-color': '#3A506B',
      'secondary-color': '#5BC0BE'
    },
    Dark: {
      'primary-color': '#5BC0BE',
      'secondary-color': '#3A506B'
    },
    Vivid: {
      'primary-color': '#ff0066',
      'secondary-color': '#ffcc00'
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
  }
};
