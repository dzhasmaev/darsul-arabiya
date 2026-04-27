# Дарсу-ль-арабия

Образовательный сайт по Мединскому курсу арабского языка, том II. Тридцать один урок: диалоги, грамматика, словарь, упражнения с проверкой и сохранением прогресса.

🌐 **Сайт:** [dzhasmaev.github.io/darsul-arabiya](https://dzhasmaev.github.io/darsul-arabiya/)

## Структура проекта

```
darsul-arabiya/
├── index.html              # Главная страница (список уроков)
├── lesson.html             # Шаблон страницы урока
├── README.md               # Этот файл
├── assets/
│   ├── css/
│   │   └── styles.css      # Все стили (Apple-style + Liquid Glass)
│   └── js/
│       ├── home.js         # Логика главной страницы
│       └── lesson.js       # Логика страницы урока
└── data/
    ├── lessons.json        # Список всех уроков
    ├── lesson-01.json      # Данные урока 1
    └── lesson-02.json      # Данные урока 2
```

## Как добавить новый урок

1. Создать файл `data/lesson-XX.json` (где XX — номер урока с ведущим нулём)
2. В `data/lessons.json` найти соответствующий урок и поменять `"available": false` на `"available": true`

## Технические особенности

- Чистый HTML/CSS/JavaScript без фреймворков
- Mobile-first дизайн
- Liquid Glass эффект через `backdrop-filter`
- Системные арабские шрифты (SF Arabic / Geeza Pro)
- Прогресс сохраняется в `localStorage`
- Тёмная тема по системному предпочтению

## Лицензия

Все материалы курса принадлежат их авторам. Сайт создан для удобного изучения.
