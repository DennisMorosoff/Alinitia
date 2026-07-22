const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data.json');
const IMAGES_PATH = path.join(ROOT, 'images');
const HOST = '127.0.0.1';
const portArg = process.argv.find(argument => argument.startsWith('--port='));
const PORT = Number.parseInt(portArg?.split('=')[1] || '4173', 10);
const EDITOR_TOKEN = crypto.randomBytes(24).toString('hex');
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const ALLOWED_HOSTS = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);
const ALLOWED_ORIGINS = new Set([`http://${HOST}:${PORT}`, `http://localhost:${PORT}`]);
const pendingImageUploads = new Set();
let storyWriteQueue = Promise.resolve();
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif'
};

function sendJson(response, status, payload) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
    sendJson(response, status, { error: message });
}

function isEditorRequest(request) {
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const hasLocalContext = origin
        ? ALLOWED_ORIGINS.has(origin)
        : [...ALLOWED_ORIGINS].some(allowedOrigin => referer?.startsWith(`${allowedOrigin}/edit.html`));
    return hasLocalContext && request.headers['x-alinitia-editor-token'] === EDITOR_TOKEN;
}

function enqueueStoryWrite(task) {
    const queuedTask = storyWriteQueue.then(task, task);
    storyWriteQueue = queuedTask.catch(() => {});
    return queuedTask;
}

function createRevision(rawData) {
    return crypto.createHash('sha256').update(rawData).digest('hex');
}

async function readRequestBody(request, maxBytes) {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
        total += chunk.length;
        if (total > maxBytes) {
            const error = new Error(`Размер запроса превышает ${Math.round(maxBytes / 1024 / 1024)} МБ.`);
            error.statusCode = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function collectGraphErrors(storyData) {
    const ids = new Set(Object.keys(storyData).filter(id => id !== '_quests'));
    const errors = [];
    Object.entries(storyData).forEach(([source, paragraph]) => {
        if (source === '_quests' || !Array.isArray(paragraph?.choices)) return;
        paragraph.choices.forEach((choice, choiceIndex) => {
            [
                ['target', choice.target],
                ['failTarget', choice.skillCheck?.failTarget],
                ['criticalSuccessTarget', choice.skillCheck?.criticalSuccessTarget],
                ['criticalFailureTarget', choice.skillCheck?.criticalFailureTarget]
            ].forEach(([field, target]) => {
                if (target && !ids.has(target)) {
                    errors.push(`${source}.choices[${choiceIndex}].${field} → ${target}`);
                }
            });
        });
    });
    return errors;
}

function validateStoryData(storyData) {
    if (!storyData || typeof storyData !== 'object' || Array.isArray(storyData)) {
        throw new Error('Корень data.json должен быть объектом.');
    }
    if (!storyData._quests || typeof storyData._quests !== 'object' || Array.isArray(storyData._quests)) {
        throw new Error('В data.json отсутствует объект _quests.');
    }
    for (const [id, paragraph] of Object.entries(storyData)) {
        if (id === '_quests') continue;
        if (!paragraph || typeof paragraph !== 'object' || Array.isArray(paragraph)) {
            throw new Error(`Параграф ${id} должен быть объектом.`);
        }
        if (typeof paragraph.text !== 'string') {
            throw new Error(`Параграф ${id} не содержит строковое поле text.`);
        }
        if (paragraph.choices != null && !Array.isArray(paragraph.choices)) {
            throw new Error(`Поле choices параграфа ${id} должно быть массивом.`);
        }
    }
    const graphErrors = collectGraphErrors(storyData);
    if (graphErrors.length > 0) {
        throw new Error(`Обнаружены битые переходы: ${graphErrors.join(', ')}`);
    }
}

async function writeStoryData(storyData, expectedRevision) {
    const serialized = `${JSON.stringify(storyData, null, 2)}\n`;
    const temporaryPath = `${DATA_PATH}.tmp`;
    const backupPath = `${DATA_PATH}.bak`;
    const temporaryFile = await fs.open(temporaryPath, 'w');
    try {
        await temporaryFile.writeFile(serialized, 'utf8');
        await temporaryFile.sync();
    } finally {
        await temporaryFile.close();
    }
    await fs.copyFile(DATA_PATH, backupPath);
    const backedUpData = await fs.readFile(backupPath, 'utf8');
    if (createRevision(backedUpData) !== expectedRevision) {
        await fs.rm(temporaryPath, { force: true });
        const error = new Error('data.json изменился во время сохранения. Правка не записана; обновите страницу.');
        error.statusCode = 409;
        throw error;
    }
    try {
        await fs.rename(temporaryPath, DATA_PATH);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true });
        throw new Error(`Не удалось заменить data.json без риска потери данных: ${error.message}`);
    }
    return { serialized, backupPath };
}

async function handleEditorStatus(request, response) {
    if (!isEditorRequest(request)) {
        sendError(response, 403, 'Редактирование доступно только из edit.html.');
        return;
    }
    const rawData = await fs.readFile(DATA_PATH, 'utf8');
    sendJson(response, 200, {
        editable: true,
        revision: createRevision(rawData)
    });
}

async function handleParagraphSave(request, response) {
    if (!isEditorRequest(request)) {
        sendError(response, 403, 'Редактирование доступно только из edit.html.');
        return;
    }

    const body = await readRequestBody(request, MAX_JSON_BYTES);
    let payload;
    try {
        payload = JSON.parse(body.toString('utf8'));
    } catch {
        sendError(response, 400, 'Запрос не является корректным JSON.');
        return;
    }

    const { paragraphId, paragraph, expectedRevision } = payload;
    if (typeof paragraphId !== 'string' || paragraphId === '_quests') {
        sendError(response, 400, 'Некорректный идентификатор параграфа.');
        return;
    }
    if (!paragraph || typeof paragraph !== 'object' || Array.isArray(paragraph)) {
        sendError(response, 400, 'Параграф должен быть объектом.');
        return;
    }
    if (typeof expectedRevision !== 'string' || !expectedRevision) {
        sendError(response, 428, 'Для сохранения требуется актуальная ревизия data.json.');
        return;
    }

    const rawData = await fs.readFile(DATA_PATH, 'utf8');
    const currentRevision = createRevision(rawData);
    if (expectedRevision && expectedRevision !== currentRevision) {
        sendJson(response, 409, {
            error: 'data.json изменился после загрузки. Обновите страницу и повторите правку.',
            revision: currentRevision
        });
        return;
    }

    const storyData = JSON.parse(rawData);
    if (!Object.prototype.hasOwnProperty.call(storyData, paragraphId)) {
        sendError(response, 404, `Параграф ${paragraphId} не найден.`);
        return;
    }

    storyData[paragraphId] = paragraph;
    try {
        validateStoryData(storyData);
    } catch (error) {
        sendError(response, 422, error.message);
        return;
    }

    const { serialized } = await writeStoryData(storyData, currentRevision);
    normalizeImageReferences(storyData[paragraphId]).forEach(imagePath => {
        pendingImageUploads.delete(imagePath);
    });
    sendJson(response, 200, {
        saved: true,
        paragraph: storyData[paragraphId],
        revision: createRevision(serialized)
    });
}

function normalizeImageReferences(paragraph) {
    const rawImages = [
        ...(paragraph.image ? [paragraph.image] : []),
        ...(Array.isArray(paragraph.images) ? paragraph.images : [])
    ];
    return rawImages
        .map(image => typeof image === 'string' ? image : image?.src)
        .filter(imagePath => typeof imagePath === 'string' && imagePath.startsWith('images/'));
}

function sanitizeImageName(rawName) {
    const original = path.basename(String(rawName || '').trim());
    const extension = path.extname(original).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
        throw new Error('Разрешены PNG, JPG, WEBP, GIF и AVIF.');
    }
    const stem = path.basename(original, path.extname(original))
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/[. ]+$/g, '')
        .trim();
    if (!stem) throw new Error('У изображения должно быть корректное имя файла.');
    return { stem, extension };
}

async function reserveImagePath(stem, extension) {
    for (let index = 1; index < 1000; index += 1) {
        const suffix = index === 1 ? '' : `-${index}`;
        const filename = `${stem}${suffix}${extension}`;
        const absolutePath = path.join(IMAGES_PATH, filename);
        try {
            const fileHandle = await fs.open(absolutePath, 'wx');
            return { filename, absolutePath, fileHandle };
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }
    throw new Error('Не удалось подобрать свободное имя изображения.');
}

async function handleImageUpload(request, response, url) {
    if (!isEditorRequest(request)) {
        sendError(response, 403, 'Загрузка доступна только из edit.html.');
        return;
    }

    let normalizedName;
    try {
        normalizedName = sanitizeImageName(url.searchParams.get('name'));
    } catch (error) {
        sendError(response, 400, error.message);
        return;
    }

    const body = await readRequestBody(request, MAX_IMAGE_BYTES);
    if (body.length === 0) {
        sendError(response, 400, 'Получен пустой файл.');
        return;
    }

    await fs.mkdir(IMAGES_PATH, { recursive: true });
    const reserved = await reserveImagePath(normalizedName.stem, normalizedName.extension);
    try {
        await reserved.fileHandle.writeFile(body);
    } finally {
        await reserved.fileHandle.close();
    }

    pendingImageUploads.add(`images/${reserved.filename}`);
    sendJson(response, 201, {
        uploaded: true,
        path: `images/${reserved.filename}`
    });
}

async function handleImageDelete(request, response, url) {
    if (!isEditorRequest(request)) {
        sendError(response, 403, 'Удаление доступно только из edit.html.');
        return;
    }
    const imagePath = url.searchParams.get('path');
    if (!pendingImageUploads.has(imagePath)) {
        sendError(response, 404, 'Незавершённая загрузка не найдена.');
        return;
    }
    const filename = path.basename(imagePath);
    await fs.rm(path.join(IMAGES_PATH, filename), { force: true });
    pendingImageUploads.delete(imagePath);
    sendJson(response, 200, { deleted: true });
}

function resolveStaticPath(urlPath) {
    if (/^\/(?:index\.html|debug\.html|edit\.html|game\.js|pathbuilder-adapter\.js|style\.css|data\.json|characters\.json|inventory-translations\.json)$/.test(urlPath)) {
        return path.resolve(ROOT, `.${urlPath}`);
    }
    if (!urlPath.startsWith('/images/')) return null;
    const relativePath = urlPath.slice('/images/'.length);
    if (!relativePath || relativePath.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
        return null;
    }
    const absolutePath = path.resolve(IMAGES_PATH, relativePath);
    const imagesPrefix = `${IMAGES_PATH}${path.sep}`.toLowerCase();
    if (!absolutePath.toLowerCase().startsWith(imagesPrefix)) return null;
    if (!ALLOWED_IMAGE_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) return null;
    return absolutePath;
}

async function serveStatic(request, response, url) {
    let urlPath = decodeURIComponent(url.pathname);
    if (urlPath === '/') urlPath = '/index.html';
    if (urlPath === '/edit.html'
        && request.headers['sec-fetch-dest']
        && request.headers['sec-fetch-dest'] !== 'document') {
        sendError(response, 403, 'Редактор можно открывать только как отдельный документ.');
        return;
    }
    const absolutePath = resolveStaticPath(urlPath);
    if (!absolutePath) {
        sendError(response, 404, 'Файл не найден.');
        return;
    }

    let body;
    try {
        body = await fs.readFile(absolutePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            sendError(response, 404, 'Файл не найден.');
            return;
        }
        throw error;
    }

    if (urlPath === '/edit.html') {
        const html = body.toString('utf8').replace(
            '</head>',
            `    <meta name="alinitia-editor-token" content="${EDITOR_TOKEN}">\n</head>`
        );
        body = Buffer.from(html);
    }

    const headers = {
        'Content-Type': MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff'
    };
    if (urlPath === '/data.json') {
        headers.ETag = `"${createRevision(body)}"`;
    }
    response.writeHead(200, headers);
    response.end(body);
}

const server = http.createServer(async (request, response) => {
    try {
        if (!ALLOWED_HOSTS.has(request.headers.host)) {
            sendError(response, 403, 'Сервер доступен только через localhost.');
            return;
        }
        const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
        if (request.method === 'GET' && url.pathname === '/api/editor/status') {
            await handleEditorStatus(request, response);
            return;
        }
        if (request.method === 'POST' && url.pathname === '/api/editor/paragraph') {
            await enqueueStoryWrite(() => handleParagraphSave(request, response));
            return;
        }
        if (request.method === 'POST' && url.pathname === '/api/editor/image') {
            await handleImageUpload(request, response, url);
            return;
        }
        if (request.method === 'DELETE' && url.pathname === '/api/editor/image') {
            await handleImageDelete(request, response, url);
            return;
        }
        if (request.method === 'GET' || request.method === 'HEAD') {
            await serveStatic(request, response, url);
            return;
        }
        sendError(response, 405, 'Метод не поддерживается.');
    } catch (error) {
        console.error(error);
        sendError(response, error.statusCode || 500, error.message || 'Внутренняя ошибка сервера.');
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Обычная игра: http://${HOST}:${PORT}/`);
    console.log(`Debug-режим: http://${HOST}:${PORT}/debug.html`);
    console.log(`Редактор: http://${HOST}:${PORT}/edit.html`);
    console.log('Сервер принимает соединения только с этого компьютера.');
});
