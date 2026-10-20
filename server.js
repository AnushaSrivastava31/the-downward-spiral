const express = require('express');
const cors = require('cors');
const database = require('./data.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve HTML, CSS, images, and client JS directly
app.use(express.static(__dirname));

// Randomizer API endpoint
app.get('/api/random', (req, res) => {
  const category = req.query.category || 'fact';
  const pool = database[category];

  if (!pool || pool.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedItem = pool[randomIndex];

  res.json({
    ...selectedItem,
    category
  });
});

app.listen(PORT, () => {
  console.log(`🌌 The Downward Spiral server is running at http://localhost:${PORT}`);
});