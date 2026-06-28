const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Инициализируем RSS-парсер
const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'NEURAL-FLOW/5.3' }
});

// ---- GET /api/rss ----
// Параметры: url (обязательный), max (опционально, по умолчанию 10)
app.get('/api/rss', async (req, res) => {
  const { url, max = 10 } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" parameter' });
  }

  try {
    const feed = await parser.parseURL(url);
    const items = feed.items.slice(0, Number(max)).map(item => ({
      title: item.title || 'Без заголовка',
      link: item.link || '',
      date: item.pubDate || item.isoDate || new Date().toISOString(),
      description: item.contentSnippet || item.description || item.title || ''
    }));
    res.json(items);
  } catch (err) {
    console.error(`RSS error for ${url}:`, err.message);
    res.status(500).json({ error: 'Failed to parse RSS feed', details: err.message });
  }
});

// ---- GET /api/article ----
// Параметры: url (обязательный)
// Возвращает: { title, description, imageUrl }
app.get('/api/article', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" parameter' });
  }

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'NEURAL-FLOW/5.3' }
    });
    const html = response.data;
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content') ||
                    $('title').text() ||
                    'Без заголовка';
    const ogDescription = $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="description"]').attr('content') ||
                          '';
    const ogImage = $('meta[property="og:image"]').attr('content') ||
                    $('meta[property="og:image:url"]').attr('content') ||
                    null;

    res.json({
      title: ogTitle.trim(),
      description: ogDescription.trim(),
      imageUrl: ogImage ? ogImage.trim() : null
    });
  } catch (err) {
    console.error(`Article fetch error for ${url}:`, err.message);
    // В случае ошибки возвращаем пустые данные, чтобы не ломать пайплайн
    res.status(200).json({
      title: '',
      description: '',
      imageUrl: null,
      error: err.message
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ NEURAL FLOW Proxy server running on http://localhost:${PORT}`);
  console.log(`   - GET /api/rss?url=<rss_url>&max=<n>`);
  console.log(`   - GET /api/article?url=<article_url>`);
});