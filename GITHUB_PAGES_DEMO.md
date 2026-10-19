# Публикация AutoStudio demo на GitHub Pages

Репозиторий должен называться `demo-sto`. Workflow `.github/workflows/deploy-demo.yml` собирает только фронтенд в demo-режиме и публикует `frontend/dist`.

1. Загрузи содержимое папки `AutoStudio` в корень репозитория `YourIgoryan/demo-sto`.
2. В GitHub открой **Settings → Pages** и выбери **GitHub Actions** как Build and deployment source.
3. Открой вкладку **Actions** и дождись успешного запуска `Deploy AutoStudio demo to GitHub Pages`.
4. Сайт должен быть доступен по адресу `https://YourIgoryan.github.io/demo-sto/`.

В деморежиме конфигурация берётся из `frontend/src/demo-config.json`, свободные слоты генерируются локально, форма не отправляет и не сохраняет введённые данные, помощник отвечает локально. Backend, бот и база данных не публикуются как исполняемые сервисы на GitHub Pages.
