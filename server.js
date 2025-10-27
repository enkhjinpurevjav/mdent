import express from "express"; // or const express = require("express");
const app = express();

app.get("/", (_req, res) => {
  res.json({ name: "M Dent API", status: "ok" }); // (API—программын интерфэйс)
});

const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});





