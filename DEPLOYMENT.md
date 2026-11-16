# Alinitia: локальная разработка и прод

## Идея

- **Локально** — DDEV: статическая игра + Node-сервер редактора внутри DDEV.
- **На проде** — только статические файлы. Без PHP, Node, Drupal и базы данных.
- `edit.html`, `debug.html`, `combat-test.html` и `combat-tests.json` на прод **не попадают**.

## Локально: DDEV

Нужны Docker Desktop и DDEV.

```bash
ddev start
```

После старта:

- прод-предпросмотр: `https://alinitia.ddev.site`
- редактор: `https://alinitia.ddev.site:3001/edit.html`
- debug: `https://alinitia.ddev.site:3001/debug.html`
- боевой полигон: `https://alinitia.ddev.site:3001/combat-test.html`

Если HTTPS-порт не открывается, используй HTTP:

```text
http://alinitia.ddev.site:3000/edit.html
```

Редактор работает через `scripts/dev-server.js`, запущенный как DDEV-демон. Он пишет `data.json` и `images/` прямо в проект. `data.json.bak` создаётся локально и в git не попадает.

Полезные команды:

```bash
ddev describe          # URL-ы и статус
ddev logs -s web       # логи веб-сервера и Node-редактора
ddev restart
ddev stop
```

Если `ddev start` не запускается — сначала запусти Docker Desktop.

## Прод: Reg.ru

Используется обычный shared-хостинг Reg.ru. Игре нужен только статический docroot.

Рекомендуемая схема:

```text
https://alinitia.dennismorosoff.ru
/var/www/u2415359/data/www/alinitia.dennismorosoff.ru
```

Создай поддомен в панели Reg.ru и назначь ему отдельный docroot. Не клади игру внутрь Drupal-корня: там свои `.htaccess` и rewrite-правила.

### Что уходит на прод

- `.htaccess`
- `index.html`
- `game.js`
- `pathbuilder-adapter.js`
- `style.css`
- `data.json`
- `characters.json`
- `inventory-translations.json`
- `images/`

### Что не уходит

- `edit.html`, `debug.html`, `combat-test.html`
- `combat-tests.json`
- `scripts/`, `.ddev/`, `.github/`, `.git/`
- `*.md`, `AI_CONTEXT.txt`, `data.json.bak`

## Переиспользование доступов из Drupal-проекта

Сервер и ключ те же, что использовались для `D:\drupal`:

- `SSH_HOST=server109.hosting.reg.ru`
- `SSH_USER=u2415359`
- `SSH_PORT=22`
- ключ: `C:\Users\danner\.ssh\github_deploy`
- fingerprint: `SHA256:UoDHUAfUMBQCHUgWtNcJKNZnT2uprOuZ13dfAgbvPy0`

Проверено по SSH: ключ авторизован на сервере (`SSH_OK`, hostname `server109.hosting.reg.ru`). Приватный ключ в репозиторий и чат не попадает.

В Drupal-workflow использовались секреты `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH_PROD` (путь Drupal). Для Alinitia нужны те же первые четыре секрета и **новый** `GAMEBOOK_DEPLOY_PATH` — путь поддомена Alinitia.

Поддомен создан. Фактический docroot:

```text
/var/www/u2415359/data/www/alinitia.dennismorosoff.ru
```

Рабочий адрес сейчас: `http://www.alinitia.dennismorosoff.ru/` (у `www` есть A-запись; у голого `alinitia` пока только AAAA). HTTPS отвечает, но используется **self-signed** сертификат (issuer = subject), поэтому браузеры и `curl` его не доверяют. Нужно выпустить Let's Encrypt в панели Reg.ru для `www.alinitia.dennismorosoff.ru` и `alinitia.dennismorosoff.ru`.

Старая заглушка Reg.ru сохранена в `~/backups/alinitia-default-index-*.html`.

## GitHub Actions

В репозитории есть workflow:

```text
.github/workflows/deploy-gamebook.yml
```

Он запускается вручную (`workflow_dispatch`) и заливает только прод-файлы через `rsync`/SSH.

Нужные GitHub Secrets:

- `SSH_HOST` — например, `server109.hosting.reg.ru`
- `SSH_USER` — пользователь хостинга
- `SSH_PORT` — обычно `22`
- `SSH_PRIVATE_KEY` — приватный ключ для деплоя
- `GAMEBOOK_DEPLOY_PATH` — docroot поддомена на сервере

Секреты добавляются в GitHub → Settings → Secrets and variables → Actions.

Перед первым запуском проверь, что SSH-ключ добавлен в `~/.ssh/authorized_keys` на хостинге.

## Ручной деплой

Если GitHub Actions пока не нужен:

```bash
rsync -avz \
  .htaccess index.html game.js pathbuilder-adapter.js style.css \
  data.json characters.json inventory-translations.json images \
  USER@server109.hosting.reg.ru:/var/www/.../alinitia.dennismorosoff.ru/
```

## После деплоя

1. Открой `https://alinitia.dennismorosoff.ru/`.
2. Проверь консоль браузера: не должно быть 404 по картинкам.
3. Проверь, что `data.json` отдаётся как JSON.
4. Выбери персонажа, пройди пару параграфов, обнови страницу.
5. Убедись, что `edit.html` и `debug.html` с прода недоступны.

## Ограничения

- Прогресс игры хранится в `localStorage` браузера, а не на сервере.
- Редактор работает только локально/DDEV; на проде его нет.
- Имена файлов картинок на Linux чувствительны к регистру. Если на Windows всё работало, а на Reg.ru картинка не грузится — проверь точное имя в `data.json`.
