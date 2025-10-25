const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(M Dent API listening on ${port}));
