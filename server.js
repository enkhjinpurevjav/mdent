import express from "express"; // or const express = require("express");
const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
